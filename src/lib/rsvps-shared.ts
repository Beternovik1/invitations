/**
 * Runtime-safe RSVP constants and types shared by the server boundary
 * (`src/lib/rsvps.ts`) and the client UI (`src/components/sections/Rsvp.tsx`).
 *
 * This module MUST stay free of any server-only or Supabase imports — including
 * dynamic `import("@/lib/supabase/server")`. The boundary module re-exports
 * these symbols, but it ALSO exports server functions that dynamically import
 * the server-only Supabase client. If a client component imported a RUNTIME
 * value (not a type) from `rsvps.ts`, Turbopack would be forced to pull the
 * whole module into the client bundle graph, follow that dynamic import into
 * `server.ts` (which has `import "server-only"`), and the build would fail.
 *
 * The codebase's existing convention is that client components only
 * `import type` from boundary modules (see `EnvelopeGate` importing the
 * `GuestGroup` type from `@/lib/guest-groups`). This module exists so the
 * client can also read the ONE runtime value it needs (the message length cap
 * for the textarea `maxLength`) without crossing that line.
 */

/** Maximum length (in characters) of the optional RSVP message, after trimming.
 *  Used server-side for validation and client-side for the `maxLength` attr, so
 *  the two limits can never drift apart. */
export const MAX_RSVP_MESSAGE_LENGTH = 1000;

export interface Rsvp {
  /** Legacy guest-group slug retained in the public RSVP payload. */
  guestGroupSlug: string;
  /** How many seats the group confirms. */
  attendingCount: number;
  /** Optional trimmed message to the host, or `null`. */
  message: string | null;
  /** ISO timestamp the row was created. */
  createdAt: string;
  /** ISO timestamp the row was last updated. */
  updatedAt: string;
}

export interface RsvpInput {
  attendingCount: number;
  message?: string | null;
}

/** Stable machine codes so the UI can branch without parsing strings. */
export type RsvpErrorCode =
  | "group_not_found"
  | "seats_pending"
  | "count_out_of_range"
  | "message_too_long"
  | "unavailable"
  | "unexpected";

export interface RsvpError {
  code: RsvpErrorCode;
  /** Spanish, guest-facing message. */
  message: string;
  /** Field-level hints for inline form feedback, keyed by field name. */
  fields?: Partial<Record<"attendingCount" | "message", string>>;
}

/** Validation succeeds and returns the persisted RSVP. */
export type RsvpActionResult =
  | { ok: true; rsvp: Rsvp }
  | { ok: false; error: RsvpError };

/**
 * Form state exchanged between the RSVP Server Action and the client form via
 * `useActionState`. The `rsvp` field carries the latest known confirmation so
 * the UI can prefill / show the current response across idles and errors (and
 * refresh it on success).
 */
export type RsvpFormState =
  | { status: "idle"; rsvp: Rsvp | null }
  | { status: "success"; rsvp: Rsvp }
  | { status: "error"; error: RsvpError; rsvp: Rsvp | null };
