import "server-only";

import type { GuestGroup } from "@/lib/guest-groups";

/**
 * Server-only Supabase data access for guest groups.
 *
 * This module talks to the Supabase REST (PostgREST) API using the service-role
 * key. It MUST never reach the client bundle:
 *
 * - `import "server-only"` makes any client-side import fail at build time.
 * - `guest-groups.ts` loads this module with a dynamic `import()` only when
 *   Supabase is configured and only inside server components, so there is no
 *   static dependency from client code.
 * - The service-role key is read from `SUPABASE_SERVICE_ROLE_KEY` (no
 *   NEXT_PUBLIC_ prefix), so Next.js never inlines it into client bundles.
 *
 * No `@supabase/supabase-js` dependency is needed: the boundary only reads
 * guest groups by slug and lists active slugs, which the REST API handles with
 * plain `fetch`.
 */

const REST_PATH = "/rest/v1/guest_groups";
const COLUMNS = "slug,display_name,assigned_seats,is_active,seats_note,notes";

interface SupabaseConfig {
  baseUrl: string;
  serviceRoleKey: string;
}

function getConfig(): SupabaseConfig {
  const baseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRoleKey) {
    // The boundary checks isSupabaseConfigured() before calling here, so this
    // is a defensive guard against direct misuse of this module.
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), serviceRoleKey };
}

function authHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

/** Row shape returned by the `guest_groups` REST endpoint. */
interface GuestGroupRow {
  slug: string;
  display_name: string;
  assigned_seats: number | null;
  is_active: boolean;
  seats_note: string | null;
  notes: string | null;
}

function mapRow(row: GuestGroupRow): GuestGroup {
  return {
    slug: row.slug,
    displayName: row.display_name,
    assignedSeats: row.assigned_seats,
    seatsNote: row.seats_note ?? undefined,
    notes: row.notes ?? null,
    isActive: row.is_active,
  };
}

/**
 * Fetch a single guest group by slug.
 *
 * Returns `null` when the slug does not exist OR when the group is inactive
 * (`is_active = false`). Inactive links must not render a personalized
 * invitation, so the route treats "missing" and "disabled" identically.
 *
 * `cache: "no-store"` keeps soft-deletes and admin edits immediate on every
 * request (the route is `force-dynamic` in Supabase mode).
 */
export async function fetchGuestGroupBySlugFromSupabase(
  slug: string
): Promise<GuestGroup | null> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=${COLUMNS}` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase request for guest group "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  if (!row.is_active) return null;
  return mapRow(row);
}

/**
 * All slugs for active guest groups, ascending. Inactive groups are excluded.
 * Used for enumeration (e.g. a future sitemap or admin list).
 */
export async function fetchAllActiveGuestGroupSlugsFromSupabase(): Promise<
  string[]
> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` +
    `?is_active=eq.true` +
    `&select=slug` +
    `&order=slug.asc`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase request for guest group slugs failed: ${res.status} ${body}`
    );
  }

  const rows: { slug: string }[] = await res.json();
  return rows.map((row) => row.slug);
}
