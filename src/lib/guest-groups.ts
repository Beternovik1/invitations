/**
 * Guest group data boundary for personalized invitations.
 *
 * This module is the single source of truth the `/i/[slug]` route uses to
 * resolve a guest group. Supabase rows carry the internal UUID (`id`) used by
 * RSVP/admin relationships, while the public route segment remains a link
 * identifier: `access_token` first, then legacy `slug` fallback so old links
 * keep working. It abstracts WHERE the group comes from so the route and
 * components do not change when the data source gains writes (RSVP, admin
 * editing):
 *
 * - When Supabase environment variables are present (`SUPABASE_URL` and
 *   `SUPABASE_SERVICE_ROLE_KEY`), groups are read from the `guest_groups` table
 *   (see `supabase/migrations/`). Inactive rows (`is_active = false`) behave as
 *   not found, so soft-deleted or disabled links do not render a personalized
 *   invitation.
 * - When those variables are absent, the in-repo mock data (`GUEST_GROUPS`) is
 *   used, so local development and production builds work with zero config and
 *   no backend.
 *
 * The Supabase path is server-only and dynamically imported, so the
 * service-role key never reaches the client bundle. See
 * `src/lib/supabase/server.ts`.
 *
 * Real totals captured from the host's list:
 *   - Assigned seats with explicit counts: 184 (across 48 groups)
 *   - Venue capacity: 200
 *   - Groups whose count is still pending: "Cabrera García", "García López",
 *     and "Tía Chuy" — modelled here with `assignedSeats: null` so the envelope
 *     shows a clear "por confirmar" state instead of a wrong number.
 *
 * `displayName` values are reproduced exactly as the host wrote them,
 * including accents ("Jiménez", "Hernández"), abbreviations ("Hdez.", "Ma.",
 * "Fco."), and the trailing "y fam." used for "+ family" groupings. `slug`
 * values are the URL-safe, lowercase, accent-free, hyphenated form of the same
 * name and are unique across the list.
 *
 * Guest groups now carry an admin-facing `category` label. The public invitation
 * route does not render it; `/admin/confirmaciones` edits it so a later Mesas
 * slice can filter assignment work by group category.
 */

import { cache } from "react";

import { DEFAULT_GUEST_GROUP_CATEGORY } from "@/lib/guest-group-categories";

export interface GuestGroup {
  /** Stable internal UUID from `guest_groups.id`. Present only in Supabase mode;
   *  mock entries omit it so zero-config mode never pretends DB identity exists. */
  id?: string;
  /** Legacy URL/link identifier used by `/i/[slug]` fallback and compatibility
   *  reads. It is not the internal RSVP/admin identity when Supabase provides
   *  `id`. */
  slug: string;
  /** Random invitation identifier copied from the admin panel when Supabase is
   *  configured. Mock entries omit it and keep using slug links. */
  accessToken?: string;
  /** Name shown on the envelope. A family name or a named invitee. */
  displayName: string;
  /** Seats assigned to this group, or `null` when the count is not yet
   *  confirmed. `null` is the explicit "pending" state — never 0 or a guess. */
  assignedSeats: number | null;
  /** Short note shown under the seats line when `assignedSeats` is null. */
  seatsNote?: string;
  /** Free-form admin note from the DB. Not shown to guests yet; reserved for
   *  the future admin/RSVP slice. Mock entries omit it. */
  notes?: string | null;
  /** Human-facing category for grouping invitations in admin workflows. */
  category?: string;
  /** Event root used to scope reusable admin data such as category labels. */
  eventId?: string;
  /** Soft-delete/disable flag from the DB. The boundary already hides inactive
   *  groups (returns `null`), so this is informational on the returned object.
   *  Mock entries omit it (mock mode treats all groups as active). */
  isActive?: boolean;
  /** Server timestamp (UTC ISO) the host marked this invitation as sent (e.g.
   *  via WhatsApp), or `null` when not sent yet. Added by migration 0005;
   *  mock entries omit it (the in-repo mock never persists the toggle, and
   *  the boundary refuses to fabricate a sent state in zero-config mode).
   *  See `src/app/admin/(dashboard)/confirmaciones/ConfirmationsView.tsx`. */
  sentAt?: string | null;
}

/**
 * Mock guest groups. Used when Supabase is not configured (local dev / build
 * with zero config). Kept in sync with `supabase/seed.sql`.
 */
export const GUEST_GROUPS: GuestGroup[] = [
  // --- Familia Alfaro (29) --------------------------------------------------
  { slug: "alfaro-padilla", displayName: "Alfaro Padilla", assignedSeats: 5 },
  { slug: "alfaro-santoyo", displayName: "Alfaro Santoyo", assignedSeats: 5 },
  { slug: "alfaro-jimenez", displayName: "Alfaro Jiménez", assignedSeats: 4 },
  { slug: "alfaro-gil", displayName: "Alfaro Gil", assignedSeats: 5 },
  { slug: "alfaro-garcia", displayName: "Alfaro García", assignedSeats: 1 },
  { slug: "sanchez-alfaro", displayName: "Sánchez Alfaro", assignedSeats: 2 },
  { slug: "nieto-sanchez", displayName: "Nieto Sánchez", assignedSeats: 4 },
  { slug: "sanchez-ruiz", displayName: "Sánchez Ruiz", assignedSeats: 3 },

  // --- Familia Vital (27) ---------------------------------------------------
  { slug: "vital-hernandez", displayName: "Vital Hernández", assignedSeats: 6 },
  { slug: "vital-menchaca", displayName: "Vital Menchaca", assignedSeats: 8 },
  { slug: "guadalupe-vital", displayName: "Guadalupe Vital", assignedSeats: 4 },
  { slug: "doris", displayName: "Doris", assignedSeats: 1 },
  { slug: "pedro-vital-y-fam", displayName: "Pedro Vital y fam.", assignedSeats: 4 },
  { slug: "san-juana", displayName: "San Juana", assignedSeats: 4 },

  // --- Familia Herrera (19) -------------------------------------------------
  { slug: "santacruz-hernandez", displayName: "Santacruz Hernández", assignedSeats: 4 },
  { slug: "avila-hernandez", displayName: "Ávila Hernández", assignedSeats: 2 },
  { slug: "herrera-avila", displayName: "Herrera Ávila", assignedSeats: 4 },
  { slug: "herrera-cendejas", displayName: "Herrera Cendejas", assignedSeats: 2 },
  { slug: "javier-herrera-y-fam", displayName: "Javier Herrera y fam.", assignedSeats: 2 },
  { slug: "adriana-herrera-y-fam", displayName: "Adriana Herrera y fam.", assignedSeats: 5 },

  // --- Familia Hernández Rocha (9) ------------------------------------------
  { slug: "hernandez-rocha", displayName: "Hernández Rocha", assignedSeats: 3 },
  { slug: "jaime-hdez-y-fam", displayName: "Jaime Hdez. y fam.", assignedSeats: 3 },
  { slug: "carmen-hdez-y-fam", displayName: "Carmen Hdez. y fam.", assignedSeats: 3 },

  // --- Familia Gaytán García (8) --------------------------------------------
  { slug: "gaytan-garcia", displayName: "Gaytán García", assignedSeats: 8 },

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

  // --- Familia Martínez / Hernández (26) ------------------------------------
  { slug: "jorge-martinez-y-fam", displayName: "Jorge Martínez y fam.", assignedSeats: 6 },
  { slug: "luis-marcela-y-fam", displayName: "Luis, Marcela y fam.", assignedSeats: 5 },
  { slug: "patricia-hernandez-y-fam", displayName: "Patricia Hernández y fam.", assignedSeats: 6 },
  { slug: "jesica-hernandez-y-fam", displayName: "Jesica Hernández y fam.", assignedSeats: 3 },
  { slug: "brenda-hernandez-y-fam", displayName: "Brenda Hernández y fam.", assignedSeats: 2 },
  { slug: "ismael-hernandez-y-fam", displayName: "Ismael Hernández y fam.", assignedSeats: 2 },
  { slug: "rosalba-hernandez-y-fam", displayName: "Rosalba Hernández y fam.", assignedSeats: 2 },

  // --- Familia Almanza (16) --------------------------------------------------
  { slug: "miguel-angel-almanza-y-fam", displayName: "Miguel Ángel Almanza y fam.", assignedSeats: 3 },
  { slug: "clara-almanza-y-fam", displayName: "Clara Almanza y fam.", assignedSeats: 3 },
  { slug: "ma-de-jesus-almanza-y-fam", displayName: "Ma. de Jesús Almanza y fam.", assignedSeats: 4 },
  { slug: "monserrat-almanza-y-fam", displayName: "Monserrat Almanza y fam.", assignedSeats: 4 },
  { slug: "javier-almanza-y-fam", displayName: "Javier Almanza y fam.", assignedSeats: 2 },

  // --- Familia Trejo (6) -----------------------------------------------------
  { slug: "audiel-trejo-y-fam", displayName: "Audiel Trejo y fam.", assignedSeats: 4 },
  { slug: "cande-trejo-y-fam", displayName: "Cande Trejo y fam.", assignedSeats: 2 },

  // --- Familia Hernández Mandilla (22) --------------------------------------
  { slug: "antonio-hernandez-y-fam", displayName: "Antonio Hernández y fam.", assignedSeats: 3 },
  { slug: "abel-almanza-hernandez", displayName: "Abel Almanza Hernández", assignedSeats: 4 },
  { slug: "diego-almanza-y-fam", displayName: "Diego Almanza y fam.", assignedSeats: 4 },
  { slug: "raul-hernandez-y-fam", displayName: "Raúl Hernández y fam.", assignedSeats: 3 },
  { slug: "ma-de-la-luz-hernandez-y-fam", displayName: "Ma. de la Luz Hernández y fam.", assignedSeats: 4 },
  { slug: "fco-rico-hernandez", displayName: "Fco. Rico Hernández", assignedSeats: 4 },

  // --- Familia Faustino Barroso (6) -----------------------------------------
  { slug: "faustino-barroso", displayName: "Faustino Barroso", assignedSeats: 6 },

  // --- Familia Ángeles (16) --------------------------------------------------
  { slug: "ivana-magdalena-hdez-y-fam", displayName: "Ivana Magdalena Hdez. y fam.", assignedSeats: 5 },
  { slug: "gutierrez-mosqueda", displayName: "Gutiérrez Mosqueda", assignedSeats: 8 },
  { slug: "alberto-gutierrez-y-fam", displayName: "Alberto Gutiérrez y fam.", assignedSeats: 3 },
];

/**
 * Whether Supabase is configured. Reads `process.env` directly (no `server-only`
 * import) so this module stays safe to type-import from client components.
 * Variables without a `NEXT_PUBLIC_` prefix are `undefined` on the client, so
 * this returns `false` there regardless — the boundary simply never runs on the
 * client.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getMockGuestGroupBySlug(slug: string): GuestGroup | undefined {
  const group = GUEST_GROUPS.find((entry) => entry.slug === slug);
  return group ? { ...group, category: DEFAULT_GUEST_GROUP_CATEGORY } : undefined;
}

function getAllMockGuestGroupSlugs(): string[] {
  return GUEST_GROUPS.map((group) => group.slug);
}

/**
 * Resolve a guest group by public invitation identifier.
 *
 * In Supabase mode this checks `access_token` first, then legacy `slug` as a
 * temporary compatibility fallback. RSVP writes still use the resolved group's
 * `slug`; this lookup only changes how the public route finds the group.
 * Returns `null` when the identifier is unknown OR the group is inactive, so
 * the route can call `notFound()`. Memoized per request with React `cache` so
 * `generateMetadata` and the page share a single fetch in Supabase mode.
 */
export const getGuestGroupByIdentifier = cache(
  async (identifier: string): Promise<GuestGroup | null> => {
    if (!isSupabaseConfigured()) {
      return getMockGuestGroupBySlug(identifier) ?? null;
    }
    const { fetchGuestGroupByIdentifierFromSupabase } = await import(
      "@/lib/supabase/server"
    );
    return fetchGuestGroupByIdentifierFromSupabase(identifier);
  }
);

/** Resolve a guest group by legacy slug for RSVP compatibility reads/writes. */
export const getGuestGroupBySlug = cache(
  async (slug: string): Promise<GuestGroup | null> => {
    if (!isSupabaseConfigured()) {
      return getMockGuestGroupBySlug(slug) ?? null;
    }
    const { fetchGuestGroupBySlugFromSupabase } = await import(
      "@/lib/supabase/server"
    );
    return fetchGuestGroupBySlugFromSupabase(slug);
  }
);

/**
 * All guest group slugs. In Supabase mode, only active groups. Memoized per
 * request with React `cache`.
 *
 * Used for enumeration (a future sitemap or admin list). The `/i/[slug]` route
 * is `force-dynamic` and does not prerender, so it does not call this — it is
 * kept here as the boundary's enumeration API for upcoming slices.
 */
export const getAllGuestGroupSlugs = cache(
  async (): Promise<string[]> => {
    if (!isSupabaseConfigured()) {
      return getAllMockGuestGroupSlugs();
    }
    const { fetchAllActiveGuestGroupSlugsFromSupabase } = await import(
      "@/lib/supabase/server"
    );
    return fetchAllActiveGuestGroupSlugsFromSupabase();
  }
);
