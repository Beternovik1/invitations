/**
 * Runtime-safe constants and types shared by the admin guest-group editor
 * server boundary (`src/lib/admin-guest-groups.ts`) and the client editor UI
 * (`src/app/admin/(dashboard)/guest-groups/GuestGroupEditor.tsx`).
 *
 * This module MUST stay free of any server-only or Supabase imports — including
 * dynamic `import("@/lib/supabase/server")`. The boundary module re-exports
 * these symbols, but it ALSO exports server functions that dynamically import
 * the server-only Supabase client. If a client component imported a RUNTIME
 * value (not a type) from the boundary, Turbopack would be forced to pull the
 * whole module into the client bundle graph, follow that dynamic import into
 * `server.ts` (which has `import "server-only"`), and the build would fail.
 *
 * This mirrors the `rsvps-shared.ts` convention for the guest-facing RSVP form:
 * the ONE runtime value the client needs (the seats-note length cap) lives here
 * so the two limits can never drift apart.
 */

/** Maximum length (in characters) of the display name, after trimming. A guest
 *  group name is a short family or named-invitee label, so 100 is generous and
 *  keeps the envelope line from overflowing. Used server-side for validation
 *  and client-side for the input `maxLength` so the two limits never drift. */
export const MAX_DISPLAY_NAME_LENGTH = 100;

/** Maximum length (in characters) of the optional seats note, after trimming.
 *  Used server-side for validation and client-side the `maxLength` attr,
 *  so the two limits never drift apart. */
export const MAX_SEATS_NOTE_LENGTH = 200;

/** Maximum length (in characters) of a generated slug. Slugs are derived from
 *  `displayName` (capped at `MAX_DISPLAY_NAME_LENGTH`), so 100 is already
 *  generous; this is a defensive ceiling in case the slug pipeline ever grows
 *  a suffix. Used by the server boundary only. */
export const MAX_SLUG_LENGTH = 100;

/** Maximum number of assigned seats per invitation. The host asked for a hard
 *  cap of 20 because a tested 100-guest invitation was unrealistic — a single
 *  family/group card represents a small party, not a banquet hall. Used
 *  server-side for validation AND client-side for the input `max` attribute so
 *  the two limits can never drift apart (same convention as
 *  `MAX_DISPLAY_NAME_LENGTH`). Blank still means "pending" (null). */
export const MAX_ASSIGNED_SEATS = 20;

export interface AdminGuestGroupInput {
  displayName: string;
  assignedSeats: number | null;
  seatsNote: string | null;
  isActive: boolean;
}

/** Stable machine codes so the UI can branch without parsing strings. */
export type AdminGuestGroupErrorCode =
  // The slug no longer exists (deleted out-of-band between page load and save).
  | "group_not_found"
  // `displayName` is empty or whitespace-only after trimming.
  | "display_name_empty"
  // `assignedSeats` is present but not a non-negative integer.
  | "assigned_seats_invalid"
  // `assignedSeats` exceeds the per-invitation cap (`MAX_ASSIGNED_SEATS`).
  | "assigned_seats_too_many"
  // `seatsNote` exceeds the max length after trimming.
  | "seats_note_too_long"
  // The generated slug is empty after slugification (input had no alphanumerics).
  | "slug_empty"
  // The generated slug is already in use by an ACTIVE group — creating would
  // collide, so the host must rename or edit the existing group instead.
  | "slug_taken"
  // Supabase is not configured (local / zero-config builds never pretend a
  // mock write succeeded).
  | "unavailable"
  // Any transport-level failure not covered above.
  | "unexpected";

export interface AdminGuestGroupError {
  code: AdminGuestGroupErrorCode;
  /** Mensaje en español para el administrador. */
  message: string;
  /** Field-level hints for inline form feedback, keyed by field name. */
  fields?: Partial<
    Record<"displayName" | "assignedSeats" | "seatsNote", string>
  >;
}

/** Validation succeeds and returns the updated guest group. The returned group
 *  is the boundary's own `GuestGroup` shape (snake-case values camelCased). */
export type AdminGuestGroupActionResult =
  // `GuestGroup` is imported as a type-only re-export below to avoid pulling
  // the mock-data module's runtime side (it is small, but staying type-only
  // keeps the contract explicit).
  | { ok: true; group: import("@/lib/guest-groups").GuestGroup }
  | { ok: false; error: AdminGuestGroupError };

/**
 * Form state exchanged between the editor Server Action and the client card
 * via `useActionState`. `slug` is carried back so a single state reducer can
 * fan feedback out to the matching card even though all cards share an action.
 *
 *   - `idle`: initial render, no feedback yet.
 *   - `success`: the save landed; `revalidatePath` has refreshed the list, so
 *     the card already shows the persisted values.
 *   - `error`: validation or transport failure; `error` carries the structured
 *     result for inline field/general feedback.
 */
export type GuestGroupFormState =
  | { status: "idle"; slug: string }
  | { status: "success"; slug: string }
  | { status: "error"; slug: string; error: AdminGuestGroupError };

export const INITIAL_GUEST_GROUP_FORM_STATE: GuestGroupFormState = {
  status: "idle",
  slug: "",
};

/* -------------------------------------------------------------------------- */
/*  Create / reactivate flow                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build the canonical URL-safe slug for a guest group display name.
 *
 * The slug is the immutable `/i/[slug]` identifier, so it MUST be:
 *   - lowercase
 *   - accent/diacritic-free (NFD decomposition, combining marks stripped)
 *   - punctuation-free: dots, commas, periods, quotes … are dropped so
 *     `Ma. de Jesús` -> `ma-de-jesus` and `Fco. Rico` -> `fco-rico`
 *   - whitespace collapsed to a single hyphen
 *   - trimmed of leading/trailing hyphens
 *
 * Pure and deterministic so the client can preview the slug as the host types
 * and the server can re-derive the canonical slug on submit (the client value
 * is never trusted as the identifier — the boundary recomputes it from the
 * submitted `displayName`). Matches the existing mock slugs in
 * `src/lib/guest-groups.ts` (`ma-de-jesus-almanza-y-fam`, `fco-rico-hernandez`,
 * `tia-chuy`, …) so the new create flow produces identifiers consistent with
 * the seeded list.
 */
export function slugifyGuestGroupName(name: string): string {
  return name
    .normalize("NFD")
    // Strip combining marks (accents/diacritics) produced by NFD.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Drop anything that is not a lowercase ASCII letter, digit, whitespace,
    // or hyphen. This removes punctuation (`.` `,` `'` `¡` `¿` …) in one
    // pass without turning each punctuation char into a hyphen (which would
    // produce `fco--rico`-style ugly slugs).
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    // Collapse runs of whitespace and/or hyphens into a single hyphen so
    // double spaces and existing hyphens normalize together.
    .replace(/[\s-]+/g, "-")
    // Trim leading/trailing hyphens left by surrounding punctuation/spaces.
    .replace(/^-+|-+$/g, "");
}

export interface AdminGuestGroupCreateInput {
  displayName: string;
  /** Optional assigned seats; `null` means "pending" (no seats yet). */
  assignedSeats: number | null;
}

/**
 * Form state exchanged between the `Nueva invitación` Server Action and the
 * inline create panel via `useActionState`.
 *
 * Unlike the update form, the create flow has no `slug` to fan feedback by
 * (the slug is derived server-side from the submitted `displayName`), so the
 * state shape is simpler. On success the server returns the freshly created or
 * reactivated slug so the panel can show the resulting `/i/[slug]` link and
 * (after `revalidatePath`) the card appears in the list.
 */
export type GuestGroupCreateFormState =
  | { status: "idle" }
  | { status: "success"; slug: string }
  | { status: "error"; error: AdminGuestGroupError };

export const INITIAL_GUEST_GROUP_CREATE_FORM_STATE: GuestGroupCreateFormState = {
  status: "idle",
};
