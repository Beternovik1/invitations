/**
 * Admin guest-group data boundary (create, update, and soft-delete groups).
 *
 * This module is the single source of truth the official `/admin/confirmaciones`
 * page's Server Actions use to create invitations, reactivate inactive rows,
 * patch mutable fields, and soft-delete groups. It mirrors the other boundaries
 * (`guest-groups.ts`, `rsvps.ts`, `admin-overview.ts`):
 *
 * - When Supabase is configured (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`),
 *   the list and writes go through the REST API with the service-role key (see
 *   `src/lib/supabase/server.ts`). The key is read from `SUPABASE_SERVICE_ROLE_KEY`
 *   (no `NEXT_PUBLIC_` prefix), so it is `undefined` on the client and never
 *   inlined into a client bundle.
 * - When those variables are absent, the list falls back to the in-repo mock
 *   data (`GUEST_GROUPS`) so a zero-config build/dev can still open the editor.
 *   Writes NEVER pretend to succeed in mock mode: `updateGuestGroupForAdmin`
 *   returns an `unavailable` error, exactly like the RSVP boundary. Local builds
 *   stay honest — the editor shows the groups and the disabled state, but it
 *   never lies that a save landed.
 *
 * This module deliberately does NOT import `server-only`: like `rsvps.ts` and
 * `admin-overview.ts`, it stays importable for type-only client usage. The
 * runtime functions only ever run on the server (from the page Server Component
 * or the Server Action), and the Supabase module is pulled in with a dynamic
 * `import()`, which — combined with the `import "server-only"` at the top of
 * `supabase/server.ts` — keeps the service-key off the client.
 *
 * The runtime-safe constants/types live in `@/lib/admin-guest-groups-shared` so
 * the client editor can read `MAX_SEATS_NOTE_LENGTH` / `MAX_DISPLAY_NAME_LENGTH`
 * (runtime values) without importing this module and dragging the dynamic
 * Supabase import into its bundle graph. They are re-exported here so server
 * callers have a single import surface.
 */

import { cache } from "react";

import {
  GUEST_GROUPS,
  isSupabaseConfigured,
  type GuestGroup,
} from "@/lib/guest-groups";
import {
  MAX_ASSIGNED_SEATS,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_SEATS_NOTE_LENGTH,
  MAX_SLUG_LENGTH,
  slugifyGuestGroupName,
  type AdminGuestGroupActionResult,
  type AdminGuestGroupCreateInput,
  type AdminGuestGroupDeleteResult,
  type AdminGuestGroupError,
  type AdminGuestGroupErrorCode,
  type AdminGuestGroupInput,
  type AdminGuestGroupToggleSentResult,
  type GuestGroupToggleSentActionResult,
  type GuestGroupCreateFormState,
  type GuestGroupDeleteFormState,
  type GuestGroupFormState,
} from "@/lib/admin-guest-groups-shared";

// Re-export the shared symbols so server callers can import everything from
// `@/lib/admin-guest-groups` (the boundary's public surface) without also
// needing to know about the shared module.
export {
  MAX_ASSIGNED_SEATS,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_SEATS_NOTE_LENGTH,
  MAX_SLUG_LENGTH,
  slugifyGuestGroupName,
  type AdminGuestGroupActionResult,
  type AdminGuestGroupCreateInput,
  type AdminGuestGroupDeleteResult,
  type AdminGuestGroupError,
  type AdminGuestGroupErrorCode,
  type AdminGuestGroupInput,
  type AdminGuestGroupToggleSentResult,
  type GuestGroupToggleSentActionResult,
  type GuestGroupCreateFormState,
  type GuestGroupDeleteFormState,
  type GuestGroupFormState,
};

/** Copia en español para los errores de validación esperados, indexada por
 *  código. Mantenerla aquí hace que la frontera sea la única dueña del texto
 *  de los errores de administración. */
const ERROR_MESSAGES: Record<AdminGuestGroupErrorCode, string> = {
  group_not_found:
    "Este grupo ya no existe. Puede que se haya eliminado desde que abriste el editor. Recarga la página para actualizar la lista.",
  display_name_empty: "El nombre del grupo no puede estar vacío.",
  assigned_seats_invalid:
    "Los lugares asignados deben ser un número entero de 0 o más, o dejarse vacío cuando están por confirmar.",
  assigned_seats_too_many: `No puedes asignar más de ${MAX_ASSIGNED_SEATS} lugares por invitación.`,
  seats_note_too_long: `La nota de lugares debe tener ${MAX_SEATS_NOTE_LENGTH} caracteres o menos.`,
  slug_empty:
    "El nombre no genera un identificador válido. Usa al menos una letra o número.",
  slug_taken:
    "Ya existe una invitación activa con ese nombre. Elige otro nombre o edita el grupo existente.",
  unavailable:
    "La edición no está disponible en este entorno. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para activar las ediciones.",
  unexpected:
    "Ocurrió un problema al guardar este grupo. Inténtalo de nuevo en un momento.",
};

function error(
  code: AdminGuestGroupErrorCode,
  fields?: AdminGuestGroupError["fields"]
): AdminGuestGroupError {
  return { code, message: ERROR_MESSAGES[code], fields };
}

/**
 * All guest groups for the admin editor, ascending by slug.
 *
 * Unlike the read-only overview (`getActiveGuestGroupsWithRsvp`), this includes
 * INACTIVE groups (`is_active = false`): the editor's whole point is to let the
 * host edit a label or re-enable a disabled link without a DB round-trip. The
 * `isActive` flag is preserved on each returned object so the UI can flag
 * inactive rows.
 *
 * In mock mode (Supabase not configured), the in-repo `GUEST_GROUPS` is returned
 * with `isActive: true` — mock data models every group as active, so the editor
 * shows the full list. Memoized per request with React `cache` so the page and
 * any helper in the same render share a single fetch.
 */
export const getAllGuestGroupsForAdmin = cache(
  async (): Promise<GuestGroup[]> => {
    if (!isSupabaseConfigured()) {
      // Mock entries omit `isActive`; model them as active so the editor's
      // "inactive groups stop invitation links" note stays truthful.
      return GUEST_GROUPS.map((group) => ({ ...group, isActive: true }));
    }
    const { fetchAllGuestGroupsFromSupabase } = await import(
      "@/lib/supabase/server"
    );
    return fetchAllGuestGroupsFromSupabase();
  }
);

/**
 * Validate and persist edits to a guest group by slug.
 *
 * Never throws for expected validation failures — it returns a structured
 * `{ ok: false, error }` instead, so the Server Action can surface them to the
 * card form without a try/catch that swallows admin-facing problems. Only
 * truly unexpected failures (e.g. a Supabase outage) throw, and the Server
 * Action converts those into an `unexpected` result.
 *
 * Validation order (fail fast):
 *   1. `displayName` is trimmed; empty/whitespace-only is rejected. Capped at
 *      `MAX_DISPLAY_NAME_LENGTH` after trimming.
 *   2. `assignedSeats` is `null` (pending) or a non-negative integer. Decimals,
 *      negatives, and other shapes are rejected.
 *   3. `seatsNote` is trimmed; `null`/empty becomes `null`. Capped at
 *      `MAX_SEATS_NOTE_LENGTH` after trimming.
 *   4. `isActive` must be a boolean (the action parses the checkbox).
 *   5. Supabase must be configured for writes — mock mode never pretends a save
 *      landed (`unavailable`).
 *
 * The slug never appears in the body: it is the immutable identifier that
 * selects the row. `updateGuestGroupInSupabase` returns `null` when no row
 * matched (a group deleted out-of-band between page load and save); that is
 * mapped to a `group_not_found` validation error rather than a throw.
 */
export async function updateGuestGroupForAdmin(
  slug: string,
  input: AdminGuestGroupInput
): Promise<AdminGuestGroupActionResult> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return {
      ok: false,
      error: error("display_name_empty", {
        displayName: "Ingresa un nombre para este grupo.",
      }),
    };
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      ok: false,
      error: error("display_name_empty", {
        displayName: `Mantén el nombre en ${MAX_DISPLAY_NAME_LENGTH} caracteres o menos.`,
      }),
    };
  }

  const assignedSeats = input.assignedSeats;
  if (
    assignedSeats !== null &&
    (!Number.isInteger(assignedSeats) || assignedSeats < 0)
  ) {
    return {
      ok: false,
      error: error("assigned_seats_invalid", {
        assignedSeats: "Usa un número entero de 0 o más, o déjalo vacío.",
      }),
    };
  }
  if (assignedSeats !== null && assignedSeats > MAX_ASSIGNED_SEATS) {
    return {
      ok: false,
      error: error("assigned_seats_too_many", {
        assignedSeats: `No puedes asignar más de ${MAX_ASSIGNED_SEATS} lugares por invitación.`,
      }),
    };
  }

  const trimmedNote =
    typeof input.seatsNote === "string" ? input.seatsNote.trim() : "";
  if (trimmedNote.length > MAX_SEATS_NOTE_LENGTH) {
    return { ok: false, error: error("seats_note_too_long") };
  }
  const seatsNote = trimmedNote.length > 0 ? trimmedNote : null;

  if (typeof input.isActive !== "boolean") {
    // Defensive: the action always parses the checkbox to a boolean, so this
    // only fires if the boundary is called from somewhere that didn't.
    return { ok: false, error: error("unexpected") };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: error("unavailable") };
  }

  try {
    const { updateGuestGroupInSupabase } = await import(
      "@/lib/supabase/server"
    );
    const group = await updateGuestGroupInSupabase(slug, {
      displayName,
      assignedSeats,
      seatsNote,
      isActive: input.isActive,
    });
    if (!group) {
      return { ok: false, error: error("group_not_found") };
    }
    return { ok: true, group };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}

/**
 * Create a new guest group, or REACTIVATE an inactive one with the same slug.
 *
 * Unlike `updateGuestGroupForAdmin`, the slug is NOT supplied by the caller:
 * it is derived deterministically from `displayName` via `slugifyGuestGroupName`
 * so the host only types a name and gets a stable `/i/[slug]` link. Because the
 * boundary recomputes the slug on the server from the submitted name, a
 * tampered client-supplied slug cannot poison the identifier.
 *
 * Lifecycle against the current row state for the derived slug:
 *   - No row exists       -> INSERT a new active group.
 *   - Inactive row exists -> reactivate: PATCH `is_active = true` and overwrite
 *     `display_name` + `assigned_seats` with the submitted values (preserving
 *     the existing `seats_note`/`notes`), so creating "García" again after a
 *     soft-delete just brings the old link back with the new label/seats
 *     instead of failing as a duplicate.
 *   - Active row exists    -> return a `slug_taken` validation error so the
 *     host is told clearly to rename or edit the existing group, rather than
 *     silently overwriting someone else's invitation link.
 *
 * Validation order (fail fast):
 *   1. `displayName` trimmed + non-empty + <= `MAX_DISPLAY_NAME_LENGTH`.
 *   2. `assignedSeats` is `null` or a non-negative integer.
 *   3. `slug = slugifyGuestGroupName(displayName)` is non-empty and <=
 *      `MAX_SLUG_LENGTH`.
 *   4. Supabase must be configured for writes (mock mode never lies).
 *
 * Never throws for expected validation failures — returns a structured
 * `{ ok: false, error }` so the Server Action can surface them inline. Only
 * truly unexpected transport failures throw, and the action converts those
 * into `unexpected`.
 */
export async function createOrReactivateGuestGroupForAdmin(
  input: AdminGuestGroupCreateInput
): Promise<AdminGuestGroupActionResult> {
  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return {
      ok: false,
      error: error("display_name_empty", {
        displayName: "Ingresa un nombre para este grupo.",
      }),
    };
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return {
      ok: false,
      error: error("display_name_empty", {
        displayName: `Mantén el nombre en ${MAX_DISPLAY_NAME_LENGTH} caracteres o menos.`,
      }),
    };
  }

  const assignedSeats = input.assignedSeats;
  if (
    assignedSeats !== null &&
    (!Number.isInteger(assignedSeats) || assignedSeats < 0)
  ) {
    return {
      ok: false,
      error: error("assigned_seats_invalid", {
        assignedSeats: "Usa un número entero de 0 o más, o déjalo vacío.",
      }),
    };
  }
  if (assignedSeats !== null && assignedSeats > MAX_ASSIGNED_SEATS) {
    return {
      ok: false,
      error: error("assigned_seats_too_many", {
        assignedSeats: `No puedes asignar más de ${MAX_ASSIGNED_SEATS} lugares por invitación.`,
      }),
    };
  }

  const slug = slugifyGuestGroupName(displayName);
  if (slug.length === 0) {
    return {
      ok: false,
      error: error("slug_empty", {
        displayName:
          "El nombre debe incluir al menos una letra o número para generar un enlace.",
      }),
    };
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return {
      ok: false,
      error: error("display_name_empty", {
        displayName: `El nombre genera un identificador demasiado largo. Acórtalo a ${MAX_SLUG_LENGTH} caracteres o menos.`,
      }),
    };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: error("unavailable") };
  }

  try {
    const {
      insertGuestGroupInSupabase,
      findGuestGroupBySlugIncludingInactiveFromSupabase,
      updateGuestGroupInSupabase,
    } = await import("@/lib/supabase/server");

    // Check for an existing row with the same slug REGARDLESS of active state:
    // an inactive row is a reactivation candidate, an active row is a hard
    // collision. This SELECT precedes the write to keep the two branches
    // readable; under PostgREST a single POST with on-conflict merge cannot
    // express the "only if inactive" predicate, so we branch explicitly.
    const existing = await findGuestGroupBySlugIncludingInactiveFromSupabase(
      slug
    );

    if (existing) {
      if (existing.isActive) {
        // Hard collision: another invitation link is already live at this
        // slug. Reuse the Spanish error text keyed by `slug_taken`.
        return { ok: false, error: error("slug_taken") };
      }
      // Reactivate: flip is_active back on and overwrite the label/seats with
      // the new values. Preserve `seats_note` and `notes` (notes is not part
      // of this boundary's update surface, so it is left untouched by the
      // PATCH). The `notes` column is intentionally not echoed because the
      // shared `GuestGroupUpdateInput` does not carry it.
      const reactivated = await updateGuestGroupInSupabase(slug, {
        displayName,
        assignedSeats,
        seatsNote: existing.seatsNote ?? null,
        isActive: true,
      });
      if (!reactivated) {
        // The row was deleted between our SELECT and PATCH — treat as not
        // found and ask the host to retry; the next attempt will INSERT.
        return { ok: false, error: error("group_not_found") };
      }
      return { ok: true, group: reactivated };
    }

    const created = await insertGuestGroupInSupabase(slug, {
      displayName,
      assignedSeats,
      seatsNote: null,
    });
    return { ok: true, group: created };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}

/**
 * Soft-delete a guest group by slug: flip `is_active` to `false`.
 *
 * Why soft-delete and not DELETE:
 *   - The `Nueva invitación` flow can REACTIVATE a row whose `is_active` was
 *     flipped to `false` (reusing the same slug), so the host's previous
 *     `display_name`/`assigned_seats`/`seats_note` survive a temporary delete
 *     instead of being irrecoverably dropped. A hard DELETE would lose them and
 *     force the host to re-enter everything when "García" eventually replies
 *     again.
 *   - No RSVP rows are destroyed: `rsvps.guest_group_slug` keeps its FK target
 *     (the row still exists, just inactive), so an existing confirmation
 *     remains intact and is restored automatically on reactivation. The
 *     existing architecture never cascades RSVPs on a deactivate; this boundary
 *     preserves that contract and only mutates the `guest_groups` row.
 *   - The existing UPDATE grant from migration 0003 covers PATCHing
 *     `is_active`, so no new migration and no DELETE/INSERT grant is required.
 *
 * Never throws for expected failures — returns a structured
 * `{ ok: false, error }` so the Server Action can surface them inline:
 *   - empty slug  -> `group_not_found` (defensive; the action also guards this
 *     and returns idle for a tampered form, but the boundary stays honest if
 *     called directly).
 *   - no row matched the slug (deleted out-of-band between page load and
 *     click) -> `group_not_found`.
 *   - mock mode (Supabase not configured) -> `unavailable`.
 *
 * Only truly unexpected transport failures throw, and the Server Action
 * converts those into an `unexpected` result.
 *
 * The returned shape is `AdminGuestGroupDeleteResult` (no `group` payload on
 * success) because the UI only fans feedback by `slug` — `revalidatePath`
 * refreshes the list, not the returned row.
 */
export async function deleteGuestGroupForAdmin(
  slug: string
): Promise<AdminGuestGroupDeleteResult> {
  const trimmedSlug = slug.trim();
  if (trimmedSlug.length === 0) {
    return { ok: false, error: error("group_not_found") };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: error("unavailable") };
  }

  try {
    const { softDeleteGuestGroupInSupabase } = await import(
      "@/lib/supabase/server"
    );
    const deleted = await softDeleteGuestGroupInSupabase(trimmedSlug);
    if (!deleted) {
      return { ok: false, error: error("group_not_found") };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}

/**
 * Persist the host's "Enviada" toggle for a guest group.
 *
 * Backs the `toggleGuestGroupSentAction` Server Action invoked from the
 * iPhone-style `Enviada` switch on each `/admin/confirmaciones` card. The
 * toggle replaces the session-only `sentSlugs` set the previous slice used as
 * a placeholder, now that migration 0005 adds the backing `sent_at` column.
 *
 *   - `sent === true`  -> PATCH `sent_at = <server-generated UTC ISO>`. The
 *     timestamp is computed HERE (the server boundary owns "now") so a tampered
 *     client cannot pick it, and so all clients share one host's notion of the
 *     moment the link was sent. We use `new Date().toISOString()` (stable, UTC,
 *     ISO 8601) rather than `now()` on Postgres to keep the timestamp value
 *     visible to the boundary for logs/tests without a second read.
 *   - `sent === false` -> PATCH `sent_at = null` to clear the marker.
 *
 * The boundary reuses the dedicated `setGuestGroupSentAtInSupabase` helper
 * (NOT the full-row `updateGuestGroupInSupabase`) so this PATCH never mutates
 * `display_name` / `assigned_seats` / `seats_note` / `is_active`. The existing
 * UPDATE grant from migration 0003 covers a PATCH of `sent_at`, so no new
 * grant is required; migration 0005 only DDLs the column.
 *
 * Validation order (fail fast):
 *   - empty slug            -> `group_not_found` (defensive; the action also
 *     guards and the toggle UI never sends an empty slug, but the boundary
 *     stays honest if called directly).
 *   - mock mode (no
 *     SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY) -> `unavailable`. The zero-config
 *     build refuses to fabricate a sent state, exactly like the update/create/
 *     delete boundaries refuse mock mutations.
 *   - no row matched the slug (deleted out-of-band between page load and tap)
 *     -> `group_not_found`.
 *
 * Never throws for expected failures — returns a structured
 * `{ ok: false, error }` so the Server Action can surface them inline on the
 * card. Only truly unexpected transport failures throw, and the Server Action
 * converts those into `unexpected`. The returned shape is
 * `AdminGuestGroupToggleSentResult` (success carries no payload): on success
 * `revalidatePath` refreshes the card from persisted data, so the boundary
 * does not need to echo the row back.
 */
export async function setGuestGroupSentAtForAdmin(
  slug: string,
  sent: boolean
): Promise<AdminGuestGroupToggleSentResult> {
  const trimmedSlug = slug.trim();
  if (trimmedSlug.length === 0) {
    return { ok: false, error: error("group_not_found") };
  }

  if (!isSupabaseConfigured()) {
    return { ok: false, error: error("unavailable") };
  }

  // Compute the timestamp on the server so all clients agree and a tampered
  // client cannot pick it. `toISOString()` is stable, UTC, ISO 8601 — the same
  // form PostgREST sends back on read. Clearing (`sent === false`) sends
  // `null` so the column returns to its "not sent yet" default.
  const sentAt = sent ? new Date().toISOString() : null;

  try {
    const { setGuestGroupSentAtInSupabase } = await import(
      "@/lib/supabase/server"
    );
    const updated = await setGuestGroupSentAtInSupabase(trimmedSlug, sentAt);
    if (!updated) {
      return { ok: false, error: error("group_not_found") };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}
