import { cache } from "react";

import { getGuestGroupBySlug, isSupabaseConfigured } from "@/lib/guest-groups";
import {
  MAX_RSVP_MESSAGE_LENGTH,
  type Rsvp,
  type RsvpActionResult,
  type RsvpError,
  type RsvpErrorCode,
  type RsvpFormState,
  type RsvpInput,
} from "@/lib/rsvps-shared";

/**
 * RSVP data boundary for personalized invitations.
 *
 * This module is the single source of truth the `/i/[slug]` route and its Server
 * Action use to read and write a guest group's RSVP. It mirrors the guest-group
 * boundary (`src/lib/guest-groups.ts`):
 *
 * - When Supabase is configured (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`),
 *   RSVPs are read from and written to the `rsvps` table (see
 *   `supabase/migrations/0002_create_rsvps.sql`) over the Supabase REST API
 *   using the service-role key.
 * - When those variables are absent, the boundary refuses to pretend
 *   persistence works: `getRsvpBySlug` returns `null` and `submitRsvp` returns
 *   an `unavailable` error. The personalized route then renders a clear local
 *   notice instead of a working form, so local/zero-config builds never lie
 *   about saved data.
 *
 * The Supabase path is server-only and dynamically imported, so the
 * service-role key never reaches the client bundle (see
 * `src/lib/supabase/server.ts`). This module deliberately does NOT import
 * `server-only` so that client components may type-import its interfaces; the
 * runtime functions only ever run on the server (from a Server Action or a
 * Server Component).
 *
 * The shared, runtime-safe constants and types live in `@/lib/rsvps-shared`
 * so the client UI can read `MAX_RSVP_MESSAGE_LENGTH` (a runtime value) without
 * pulling this module — and therefore the dynamic `import("@/lib/supabase/server")`
 * — into the client bundle. They are re-exported here so server callers have a
 * single import surface.
 */

// Re-export the shared symbols so server callers can import everything from
// `@/lib/rsvps` (the boundary's public surface) without also needing to know
// about the shared module.
export {
  MAX_RSVP_MESSAGE_LENGTH,
  type Rsvp,
  type RsvpActionResult,
  type RsvpError,
  type RsvpErrorCode,
  type RsvpFormState,
  type RsvpInput,
};

/** Spanish copy for expected validation failures, keyed by code. Keeps the
 *  boundary the single owner of guest-facing error wording. */
const ERROR_MESSAGES: Record<RsvpErrorCode, string> = {
  group_not_found:
    "No encontramos tu invitación. Revisa el enlace o pídelo de nuevo.",
  seats_pending:
    "Aún estamos confirmando el número de lugares para tu grupo. Te avisaremos cuando puedas confirmar tu asistencia.",
  count_out_of_range:
    "El número de asistentes no es válido para los lugares que tienes reservados.",
  message_too_long:
    "Tu mensaje es demasiado largo. Por favor, resúmelo en menos de 1000 caracteres.",
  unavailable:
    "La confirmación de asistencia no está disponible en este entorno.",
  unexpected:
    "Ocurrió un problema al guardar tu confirmación. Inténtalo de nuevo en un momento.",
};

function error(
  code: RsvpErrorCode,
  fields?: RsvpError["fields"]
): RsvpError {
  return { code, message: ERROR_MESSAGES[code], fields };
}

/**
 * Read a guest group's existing RSVP by slug.
 *
 * Returns `null` when no RSVP exists OR when Supabase is not configured (so the
 * route shows no prefilled confirmation in mock mode). Memoized per request with
 * React `cache` so `generateMetadata` and the page share a single fetch.
 */
export const getRsvpBySlug = cache(
  async (slug: string): Promise<Rsvp | null> => {
    if (!isSupabaseConfigured()) return null;
    const { fetchRsvpBySlugFromSupabase } = await import(
      "@/lib/supabase/server"
    );
    return fetchRsvpBySlugFromSupabase(slug);
  }
);

/**
 * Validate and persist a guest group's RSVP.
 *
 * Never throws for expected validation failures — it returns a structured
 * `{ ok: false, error }` instead, so the Server Action can surface them to the
 * form without a try/catch that swallows user-facing problems. Only truly
 * unexpected failures (e.g. a Supabase outage) throw, and the Server Action
 * converts those into an `unexpected` result.
 *
 * Validation order (fail fast):
 *   1. The group must exist and be active. Unknown/inactive slugs resolve to
 *      `group_not_found` (the route itself 404s these, but the boundary stays
 *      defensive since a Server Action can be invoked after a group is
 *      deactivated).
 *   2. `assignedSeats` must not be null. Pending-seat groups cannot RSVP yet.
 *   3. `attendingCount` must be an integer in `[0, assignedSeats]`.
 *   4. `message` is trimmed; if it exceeds the max length it is rejected.
 */
export async function submitRsvp(
  slug: string,
  input: RsvpInput
): Promise<RsvpActionResult> {
  const attendingCount = input.attendingCount;

  const group = await getGuestGroupBySlug(slug);
  if (!group) {
    return { ok: false, error: error("group_not_found") };
  }

  if (group.assignedSeats == null) {
    return { ok: false, error: error("seats_pending") };
  }

  if (
    !Number.isInteger(attendingCount) ||
    attendingCount < 0 ||
    attendingCount > group.assignedSeats
  ) {
    return {
      ok: false,
      error: error("count_out_of_range", {
        attendingCount: `Ingresa un número entre 0 y ${group.assignedSeats}.`,
      }),
    };
  }

  const trimmedMessage =
    typeof input.message === "string" ? input.message.trim() : "";
  if (trimmedMessage.length > MAX_RSVP_MESSAGE_LENGTH) {
    return { ok: false, error: error("message_too_long") };
  }
  // Supabase TEXT is happy with "", but store null for empty so "no message" is
  // distinguishable from "a message of spaces" was trimmed to nothing.
  const message = trimmedMessage.length > 0 ? trimmedMessage : null;

  if (!isSupabaseConfigured()) {
    return { ok: false, error: error("unavailable") };
  }

  const { upsertRsvpInSupabase } = await import("@/lib/supabase/server");
  const rsvp = await upsertRsvpInSupabase(slug, attendingCount, message);
  return { ok: true, rsvp };
}
