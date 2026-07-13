/**
 * Mock guest group data for personalized invitations.
 *
 * Each entry models a family or group that receives its own invitation link at
 * `/i/[slug]`. The slug identifies the group (a family or a named invitee like
 * "Tía Chuy"), never an individual person, so one link can serve a whole
 * household and their assigned seats.
 *
 * THIS IS MOCK DATA. It exists to drive the personalized-envelope slice before
 * any backend exists. Replace `GUEST_GROUPS` with the real list (and later with
 * a Supabase query) before going live. The shape is intentionally simple so the
 * future backend can populate it without changing the route or components.
 *
 * Real totals captured from the host's list:
 *   - Assigned seats with explicit counts: 184
 *   - Venue capacity: 200
 *   - Groups whose count is still pending: "Cabrera García", "García López",
 *     and "Tía Chuy" — modelled here with `assignedSeats: null` so the envelope
 *     shows a clear "por confirmar" state instead of a wrong number.
 *
 * The placeholder groups below the three real ones are stand-ins to demonstrate
 * the known-count branch of the envelope UI; their names and counts are NOT real
 * and must be replaced with the actual families and seat counts.
 */

export interface GuestGroup {
  /** URL-safe identifier used in the `/i/[slug]` route. Stable across renames
   *  of the display name so links keep working when mom edits a label. */
  slug: string;
  /** Name shown on the envelope. A family name or a named invitee. */
  displayName: string;
  /** Seats assigned to this group, or `null` when the count is not yet
   *  confirmed. `null` is the explicit "pending" state — never 0 or a guess. */
  assignedSeats: number | null;
  /** Short note shown under the seats line when `assignedSeats` is null. */
  seatsNote?: string;
}

export const GUEST_GROUPS: GuestGroup[] = [
  // --- Real entries: seat count still pending confirmation -------------------
  {
    slug: "cabrera-garcia",
    displayName: "Cabrera García",
    assignedSeats: null,
    seatsNote: "Por confirmar",
  },
  {
    slug: "garcia-lopez",
    displayName: "García López",
    assignedSeats: null,
    seatsNote: "Por confirmar",
  },
  {
    slug: "tia-chuy",
    displayName: "Tía Chuy",
    assignedSeats: null,
    seatsNote: "Por confirmar",
  },

  // --- Placeholder groups (TODO: replace with real names and counts) ---------
  { slug: "familia-hernandez", displayName: "Familia Hernández", assignedSeats: 6 },
  { slug: "familia-martinez", displayName: "Familia Martínez", assignedSeats: 4 },
  { slug: "familia-ramirez", displayName: "Familia Ramírez", assignedSeats: 5 },
  { slug: "familia-torres", displayName: "Familia Torres", assignedSeats: 3 },
  { slug: "familia-castro", displayName: "Familia Castro", assignedSeats: 8 },
  { slug: "familia-vega", displayName: "Familia Vega", assignedSeats: 5 },
];

/** Find a guest group by its route slug. Returns `undefined` for unknown slugs
 *  so the route can call `notFound()`. */
export function getGuestGroupBySlug(slug: string): GuestGroup | undefined {
  return GUEST_GROUPS.find((group) => group.slug === slug);
}

/** All slugs, used by `generateStaticParams` so every personalized page is
 *  prerendered at build time. */
export function getAllGuestGroupSlugs(): string[] {
  return GUEST_GROUPS.map((group) => group.slug);
}
