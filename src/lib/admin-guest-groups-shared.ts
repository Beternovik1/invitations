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
 *  Used server-side for validation and client-side for the `maxLength` attr,
 *  so the two limits can never drift apart. */
export const MAX_SEATS_NOTE_LENGTH = 200;

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
  // `seatsNote` exceeds the max length after trimming.
  | "seats_note_too_long"
  // Supabase is not configured (local / zero-config builds never pretend a
  // mock write succeeded).
  | "unavailable"
  // Any transport-level failure not covered above.
  | "unexpected";

export interface AdminGuestGroupError {
  code: AdminGuestGroupErrorCode;
  /** English, admin-facing message. */
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
