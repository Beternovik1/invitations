import "server-only";

import type { GuestGroup } from "@/lib/guest-groups";
import type { AdminGuestGroup } from "@/lib/admin-overview";
import type { Rsvp } from "@/lib/rsvps";

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
 * guest groups by slug, lists active slugs, and reads/writes a group's RSVP,
 * which the REST API handles with plain `fetch`.
 */

const REST_PATH = "/rest/v1/guest_groups";
const RSVP_REST_PATH = "/rest/v1/rsvps";
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

/* -------------------------------------------------------------------------- */
/*  RSVPs                                                                     */
/* -------------------------------------------------------------------------- */

/** Columns returned for an RSVP row. Snake-case mirrors the DB schema. */
const RSVP_COLUMNS =
  "guest_group_slug,attending_count,message,created_at,updated_at";

/** Row shape returned by the `rsvps` REST endpoint. */
interface RsvpRow {
  guest_group_slug: string;
  attending_count: number;
  message: string | null;
  created_at: string;
  updated_at: string;
}

function mapRsvpRow(row: RsvpRow): Rsvp {
  return {
    guestGroupSlug: row.guest_group_slug,
    attendingCount: row.attending_count,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch a guest group's existing RSVP by slug.
 *
 * Returns `null` when no RSVP exists for the group. `cache: "no-store"` keeps
 * the read fresh so an upsert from the Server Action is immediately visible on
 * the next request.
 */
export async function fetchRsvpBySlugFromSupabase(
  slug: string
): Promise<Rsvp | null> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${RSVP_REST_PATH}` +
    `?guest_group_slug=eq.${encodeURIComponent(slug)}` +
    `&select=${RSVP_COLUMNS}` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase request for RSVP "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: RsvpRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  return mapRsvpRow(row);
}

/* -------------------------------------------------------------------------- */
/*  Admin overview (read-only join of guest_groups + rsvps)                   */
/* -------------------------------------------------------------------------- */

/**
 * Row shape returned by the `guest_groups` REST endpoint when the `rsvps`
 * embedded resource is selected. Depending on PostgREST's relationship
 * detection, the one-RSVP-per-group relation may be embedded as a single object
 * (one-to-one) or as an array (one-to-many). No-match responses may be `[]` or
 * `null`, so the mapper tolerates all four shapes.
 */
interface GuestGroupWithRsvpRow extends GuestGroupRow {
  rsvps: RsvpRow | RsvpRow[] | null;
}

/**
 * Maps a `guest_groups` row that includes its embedded `rsvps` into an
 * `AdminGuestGroup`. Assumes one RSVP per group (the table's PK guarantees
 * this): the first embedded row wins, the rest is discarded.
 */
function mapRowWithRsvp(row: GuestGroupWithRsvpRow): AdminGuestGroup {
  const rsvpRow = Array.isArray(row.rsvps)
    ? (row.rsvps[0] ?? null)
    : row.rsvps;
  return {
    ...mapRow(row),
    rsvp: rsvpRow ? mapRsvpRow(rsvpRow) : null,
  };
}

/**
 * ALL guest groups (including inactive), ascending by slug.
 *
 * Unlike `fetchAllActiveGuestGroupSlugsFromSupabase` and the admin overview,
 * this does NOT filter `is_active = false`: the guest-group editor needs to show
 * soft-deleted/disabled groups so the host can re-enable a link or edit a label
 * without a DB round-trip. `mapRow` keeps `isActive` on the returned object, so
 * the editor can flag inactive rows in the UI.
 *
 * `cache: "no-store"` keeps the list fresh so the editor reflects the latest
 * activate/deactivate immediately on reload.
 */
export async function fetchAllGuestGroupsFromSupabase(): Promise<GuestGroup[]> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` + `?select=${COLUMNS}` + `&order=slug.asc`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase admin guest groups request failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  return rows.map(mapRow);
}

/** Input for updating a guest group by slug. Snake-cased fields mirror the DB
 *  schema; the boundary (`admin-guest-groups.ts`) validates before calling. */
export interface GuestGroupUpdateInput {
  displayName: string;
  assignedSeats: number | null;
  seatsNote: string | null;
  isActive: boolean;
}

/**
 * Update a guest group by slug.
 *
 * Patches `display_name`, `assigned_seats`, `seats_note`, and `is_active`. The
 * slug is the immutable identifier (the editor never lets the host rename it),
 * so it selects the row rather than appearing in the body. `return
 * =representation` plus the `select` param returns the updated row.
 *
 * Returns `null` when no row matched the slug (a group deleted out-of-band
 * between the page load and the save). The boundary treats that as a
 * `group_not_found` validation error rather than a transport throw.
 */
export async function updateGuestGroupInSupabase(
  slug: string,
  input: GuestGroupUpdateInput
): Promise<GuestGroup | null> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` +
    `?slug=eq.${encodeURIComponent(slug)}` +
    `&select=${COLUMNS}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    cache: "no-store",
    body: JSON.stringify({
      display_name: input.displayName,
      assigned_seats: input.assignedSeats,
      seats_note: input.seatsNote,
      is_active: input.isActive,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase update for guest group "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

/**
 * All active guest groups with their RSVP joined in, ascending by slug.
 *
 * Uses PostgREST's embedded resource selection (`select=...,rsvps(...)`) so the
 * join happens server-side in a single round-trip. Because `rsvps` is the
 * plural table name and `rsvps.guest_group_slug` is the only foreign key into
 * `guest_groups`, PostgREST resolves the embedding name unambiguously.
 *
 * Inactive groups (`is_active = false`) are excluded — they must not appear in
 * the admin overview. Groups with no RSVP still appear: the embedded `rsvps`
 * array is `[]` for them, so the boundary returns them with `rsvp: null`.
 * `assigned_seats = null` (pending seat count) does not exclude a group either.
 *
 * `cache: "no-store"` keeps the overview fresh so new RSVPs appear immediately
 * on reload without a redeploys — the admin overview is the one screen where
 * "is mom seeing the latest?" actually matters.
 */
export async function fetchAllActiveGuestGroupsWithRsvpFromSupabase(): Promise<
  AdminGuestGroup[]
> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` +
    `?is_active=eq.true` +
    `&select=${COLUMNS},rsvps(${RSVP_COLUMNS})` +
    `&order=slug.asc`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase admin overview request failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupWithRsvpRow[] = await res.json();
  return rows.map(mapRowWithRsvp);
}

/**
 * Upsert (insert-or-update) a guest group's RSVP.
 *
 * `guest_group_slug` is the table's primary key, so `Prefer:
 * resolution=merge-duplicates` makes PostgREST merge on conflict — exactly the
 * "one RSVP per group, repeat submissions update" semantics the boundary needs.
 * `return=representation` plus the `select` query param returns the resulting
 * row so the caller gets back `created_at`/`updated_at` without a second fetch.
 *
 * The boundary has already validated `attendingCount` and `message`, so this
 * function trusts its arguments and only reports transport-level failures.
 */
export async function upsertRsvpInSupabase(
  slug: string,
  attendingCount: number,
  message: string | null
): Promise<Rsvp> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url = `${baseUrl}${RSVP_REST_PATH}?select=${RSVP_COLUMNS}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    cache: "no-store",
    body: JSON.stringify({
      guest_group_slug: slug,
      attending_count: attendingCount,
      message,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase upsert for RSVP "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: RsvpRow[] = await res.json();
  const row = rows[0];
  if (!row) {
    // PostgREST returns the row when `return=representation` is set; an empty
    // body here means the upsert silently matched nothing, which is unexpected.
    throw new Error(
      `Supabase upsert for RSVP "${slug}" returned no representation.`
    );
  }
  return mapRsvpRow(row);
}
