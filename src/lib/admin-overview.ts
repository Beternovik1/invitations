/**
 * Admin overview data boundary (read-only).
 *
 * This module is the single source of truth the read-only `/admin/rsvps` route
 * uses to load every active guest group alongside its RSVP for mom's overview.
 * It mirrors the other boundaries (`guest-groups.ts`, `rsvps.ts`):
 *
 * - When Supabase is configured (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`),
 *   it asks PostgREST for all active guest groups with their RSVP joined in via
 *   an embedded resource, so the join happens in one round-trip and the
 *   service-role key stays server-only (see `src/lib/supabase/server.ts`).
 * - When those variables are absent, it falls back to the in-repo mock guest
 *   groups (`GUEST_GROUPS`) with `rsvp: null` for every group, so a zero-config
 *   build/dev can still open the admin overview without a backend. This is
 *   consistent with the RSVP boundary, which refuses to pretend persistence
 *   works in mock mode: the admin overview shows groups but no confirmations.
 *
 * Like `rsvps.ts`, this module deliberately does NOT import `server-only` so
 * client components may type-import its interfaces; the runtime functions only
 * ever run on the server (this overview is rendered by a Server Component).
 * The dynamic `import("@/lib/supabase/server")` keeps the service-role key and
 * the `server-only` guard out of any client bundle graph that imports types
 * from here.
 */

import { cache } from "react";

import {
  GUEST_GROUPS,
  isSupabaseConfigured,
  type GuestGroup,
} from "@/lib/guest-groups";
import type { Rsvp } from "@/lib/rsvps-shared";

/**
 * A guest group joined with its RSVP for the admin overview.
 *
 * `rsvp` is `null` when the group has not responded yet OR when the boundary
 * is running in mock mode (mock refuses to fabricate persisted confirmations).
 * The overview distinguishes three statuses from `(assignedSeats, rsvp)`:
 *
 *   - "confirmed"     -> rsvp != null
 *   - "no response"   -> rsvp == null && assignedSeats != null
 *   - "seats pending" -> assignedSeats == null (cannot RSVP until resolved)
 *
 * All `GuestGroup` fields are present here too because the boundary already
 * resolves them (the embedded query returns the same columns), so the admin UI
 * never needs to call `getGuestGroupBySlug` separately.
 */
export interface AdminGuestGroup extends GuestGroup {
  rsvp: Rsvp | null;
}

/**
 * Compute the read-only view status for a group from its `(assignedSeats,
 * rsvp)` pair. Kept here so the page and any future summary helpers share one
 * definition of "what does this row mean?".
 */
export type RsvpStatus = "confirmed" | "no_response" | "seats_pending";

export function rsvpStatusFor(group: AdminGuestGroup): RsvpStatus {
  if (group.assignedSeats == null) return "seats_pending";
  return group.rsvp ? "confirmed" : "no_response";
}

/**
 * All active guest groups with their RSVP joined in, ascending by slug.
 *
 * Inactive groups are excluded (the admin overview must not list soft-deleted
 * links). Groups with no RSVP and pending-seat groups are included — the
 * overview's whole point is "who has confirmed, who hasn't, who can't yet".
 *
 * Memoized per request with React `cache` so the page and any summary helpers
 * in the same render share a single Supabase call.
 */
export const getActiveGuestGroupsWithRsvp = cache(
  async (): Promise<AdminGuestGroup[]> => {
    if (!isSupabaseConfigured()) {
      return GUEST_GROUPS.map((group) => ({ ...group, rsvp: null }));
    }
    const { fetchAllActiveGuestGroupsWithRsvpFromSupabase } = await import(
      "@/lib/supabase/server"
    );
    return fetchAllActiveGuestGroupsWithRsvpFromSupabase();
  }
);