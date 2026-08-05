import "server-only";

import type { GuestGroup } from "@/lib/guest-groups";
import type { AdminGuestGroup } from "@/lib/admin-overview";
import type {
  AdminSeatingGuestGroup,
  EventTable,
  TableAssignment,
} from "@/lib/admin-seating";
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
 * No `@supabase/supabase-js` dependency is needed: the boundary reads guest
 * groups, keeps legacy slug/link compatibility, and reads/writes RSVP rows with
 * UUID identity when available, which the REST API handles with plain `fetch`.
 */

const REST_PATH = "/rest/v1/guest_groups";
const RSVP_REST_PATH = "/rest/v1/rsvps";
const EVENT_TABLES_REST_PATH = "/rest/v1/event_tables";
const TABLE_ASSIGNMENTS_REST_PATH = "/rest/v1/guest_group_table_assignments";
const COLUMNS =
  "id,slug,access_token,display_name,assigned_seats,is_active,seats_note,notes,sent_at";
const SEATING_GUEST_GROUP_COLUMNS = `event_id,${COLUMNS}`;

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
  id: string;
  slug: string;
  access_token: string;
  display_name: string;
  assigned_seats: number | null;
  is_active: boolean;
  seats_note: string | null;
  notes: string | null;
  /** Nullable UTC ISO timestamp the host marked this invitation as sent.
   *  Absent on rows written before migration 0005 ran; mapped to `undefined`
   *  so the boundary's downstream "treat as not sent" default stays correct. */
  sent_at: string | null;
}

function mapRow(row: GuestGroupRow): GuestGroup {
  return {
    id: row.id,
    slug: row.slug,
    accessToken: row.access_token,
    displayName: row.display_name,
    assignedSeats: row.assigned_seats,
    seatsNote: row.seats_note ?? undefined,
    notes: row.notes ?? null,
    isActive: row.is_active,
    sentAt: row.sent_at ?? null,
  };
}

function isUuidIdentifier(identifier: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    identifier
  );
}

async function fetchSingleGuestGroupByFilterFromSupabase(
  filter: string,
  errorLabel: string
): Promise<GuestGroup | null> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` +
    `?${filter}` +
    `&select=${COLUMNS}` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase request for guest group "${errorLabel}" failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  if (!row.is_active) return null;
  return mapRow(row);
}

/**
 * Fetch a single guest group by public invitation identifier.
 *
 * The lookup intentionally checks the random `access_token` first, then falls
 * back to the legacy slug while old public links remain enabled. Both misses
 * and inactive rows resolve to `null` so the route preserves its existing 404
 * behavior.
 */
export async function fetchGuestGroupByIdentifierFromSupabase(
  identifier: string
): Promise<GuestGroup | null> {
  if (isUuidIdentifier(identifier)) {
    const byAccessToken = await fetchSingleGuestGroupByFilterFromSupabase(
      `access_token=eq.${encodeURIComponent(identifier)}`,
      identifier
    );
    if (byAccessToken) return byAccessToken;
  }

  return fetchGuestGroupBySlugFromSupabase(identifier);
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
  return fetchSingleGuestGroupByFilterFromSupabase(
    `slug=eq.${encodeURIComponent(slug)}`,
    slug
  );
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

interface SeatingGuestGroupWithRsvpRow extends GuestGroupWithRsvpRow {
  event_id: string;
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

function mapSeatingGuestGroupRow(
  row: SeatingGuestGroupWithRsvpRow
): AdminSeatingGuestGroup {
  return {
    ...mapRowWithRsvp(row),
    eventId: row.event_id,
  };
}

interface EventTableRow {
  id: string;
  event_id: string;
  label: string;
  capacity: number;
  display_order: number;
}

interface EventTableWriteInput {
  label: string;
  capacity: number;
  displayOrder: number;
}

function mapEventTableRow(row: EventTableRow): EventTable {
  return {
    id: row.id,
    eventId: row.event_id,
    label: row.label,
    capacity: row.capacity,
    displayOrder: row.display_order,
  };
}

interface TableAssignmentRow {
  event_id: string;
  guest_group_id: string;
  table_id: string;
}

function mapTableAssignmentRow(row: TableAssignmentRow): TableAssignment {
  return {
    eventId: row.event_id,
    guestGroupId: row.guest_group_id,
    tableId: row.table_id,
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

/* -------------------------------------------------------------------------- */
/*  Admin seating (read-only)                                                 */
/* -------------------------------------------------------------------------- */

export async function fetchEventTablesFromSupabase(): Promise<EventTable[]> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${EVENT_TABLES_REST_PATH}` +
    `?select=id,event_id,label,capacity,display_order` +
    `&order=display_order.asc`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase admin seating tables request failed: ${res.status} ${body}`
    );
  }

  const rows: EventTableRow[] = await res.json();
  return rows.map(mapEventTableRow);
}

export async function fetchTableAssignmentsFromSupabase(): Promise<
  TableAssignment[]
> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${TABLE_ASSIGNMENTS_REST_PATH}` +
    `?select=event_id,guest_group_id,table_id`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase admin seating assignments request failed: ${res.status} ${body}`
    );
  }

  const rows: TableAssignmentRow[] = await res.json();
  return rows.map(mapTableAssignmentRow);
}

export async function fetchAdminSeatingGuestGroupsFromSupabase(): Promise<
  AdminSeatingGuestGroup[]
> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${REST_PATH}` +
    `?is_active=eq.true` +
    `&select=${SEATING_GUEST_GROUP_COLUMNS},rsvps!rsvps_guest_group_id_fkey(${RSVP_COLUMNS})` +
    `&order=slug.asc`;

  const res = await fetch(url, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase admin seating guest groups request failed: ${res.status} ${body}`
    );
  }

  const rows: SeatingGuestGroupWithRsvpRow[] = await res.json();
  return rows.map(mapSeatingGuestGroupRow);
}

export async function insertEventTableInSupabase(
  eventId: string,
  input: EventTableWriteInput
): Promise<EventTable> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${EVENT_TABLES_REST_PATH}` +
    `?select=id,event_id,label,capacity,display_order`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    cache: "no-store",
    body: JSON.stringify({
      event_id: eventId,
      label: input.label,
      capacity: input.capacity,
      display_order: input.displayOrder,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase insert for event table "${input.label}" failed: ${res.status} ${body}`
    );
  }

  const rows: EventTableRow[] = await res.json();
  const row = rows[0];
  if (!row) {
    throw new Error(
      `Supabase insert for event table "${input.label}" returned no representation.`
    );
  }
  return mapEventTableRow(row);
}

export async function insertEventTablesInSupabase(
  eventId: string,
  inputs: EventTableWriteInput[]
): Promise<EventTable[]> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${EVENT_TABLES_REST_PATH}` +
    `?select=id,event_id,label,capacity,display_order`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    cache: "no-store",
    body: JSON.stringify(
      inputs.map((input) => ({
        event_id: eventId,
        label: input.label,
        capacity: input.capacity,
        display_order: input.displayOrder,
      }))
    ),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase bulk insert for event tables failed: ${res.status} ${body}`
    );
  }

  const rows: EventTableRow[] = await res.json();
  if (rows.length !== inputs.length) {
    throw new Error(
      `Supabase bulk insert for event tables returned ${rows.length} rows for ${inputs.length} inputs.`
    );
  }
  return rows.map(mapEventTableRow);
}

export async function updateEventTableInSupabase(
  tableId: string,
  eventId: string,
  input: EventTableWriteInput
): Promise<EventTable | null> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${EVENT_TABLES_REST_PATH}` +
    `?id=eq.${encodeURIComponent(tableId)}` +
    `&event_id=eq.${encodeURIComponent(eventId)}` +
    `&select=id,event_id,label,capacity,display_order`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    cache: "no-store",
    body: JSON.stringify({
      label: input.label,
      capacity: input.capacity,
      display_order: input.displayOrder,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase update for event table "${tableId}" failed: ${res.status} ${body}`
    );
  }

  const rows: EventTableRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  return mapEventTableRow(row);
}

export async function countTableAssignmentsInSupabase(
  eventId: string,
  tableId: string
): Promise<number> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${TABLE_ASSIGNMENTS_REST_PATH}` +
    `?event_id=eq.${encodeURIComponent(eventId)}` +
    `&table_id=eq.${encodeURIComponent(tableId)}` +
    `&select=table_id`;

  const res = await fetch(url, {
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "count=exact",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase assignment count for event table "${tableId}" failed: ${res.status} ${body}`
    );
  }

  const range = res.headers.get("content-range");
  const count = range?.match(/\/(\d+)$/)?.[1];
  if (count) return Number(count);

  const rows: { table_id: string }[] = await res.json();
  return rows.length;
}

export async function deleteEventTableInSupabase(
  tableId: string,
  eventId: string
): Promise<boolean> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url =
    `${baseUrl}${EVENT_TABLES_REST_PATH}` +
    `?id=eq.${encodeURIComponent(tableId)}` +
    `&event_id=eq.${encodeURIComponent(eventId)}` +
    `&select=id,event_id,label,capacity,display_order`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase delete for event table "${tableId}" failed: ${res.status} ${body}`
    );
  }

  const rows: EventTableRow[] = await res.json();
  return rows.length > 0;
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
 * Find a guest group by slug REGARDLESS of `is_active` state.
 *
 * Unlike `fetchGuestGroupBySlugFromSupabase` (which returns `null` for inactive
 * rows so the public `/i/[slug]` route treats them as not found), this helper
 * is used by the admin create/reactivate flow: an inactive row with the derived
 * slug is a reactivation candidate, not a miss, so the boundary must see it.
 *
 * Returns the full row (including `is_active`) so the boundary can branch on
 * active vs. inactive. `null` means the slug is genuinely unused.
 */
export async function findGuestGroupBySlugIncludingInactiveFromSupabase(
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
      `Supabase lookup for guest group "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

/** Input for inserting a new guest group by slug. Snake-cased fields mirror
 *  the DB schema; the boundary validates before calling. `is_active` is
 *  always `true` on create (the only way a row becomes inactive is via the
 *  admin update/delete flow). */
export interface GuestGroupInsertInput {
  displayName: string;
  assignedSeats: number | null;
  seatsNote: string | null;
}

/**
 * Insert a new guest group.
 *
 * The slug is the table's primary key and is supplied by the caller (the
 * boundary derives it from `displayName` via `slugifyGuestGroupName`), so a
 * 409/23505 here means a collision the boundary did NOT pre-check for. The
 * caller is expected to have already used
 * `findGuestGroupBySlugIncludingInactiveFromSupabase` to branch insert vs.
 * reactivate; on a race-condition collision we surface the raw error.
 *
 * `Prefer: return=representation` plus the `select` query param returns the
 * inserted row so the caller gets back the persisted values without a second
 * fetch. Requires the INSERT table privilege (see migration 0004).
 */
export async function insertGuestGroupInSupabase(
  slug: string,
  input: GuestGroupInsertInput
): Promise<GuestGroup> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url = `${baseUrl}${REST_PATH}?select=${COLUMNS}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation",
    },
    cache: "no-store",
    body: JSON.stringify({
      slug,
      display_name: input.displayName,
      assigned_seats: input.assignedSeats,
      seats_note: input.seatsNote,
      is_active: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase insert for guest group "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  const row = rows[0];
  if (!row) {
    // PostgREST returns the row when `return=representation` is set; an empty
    // body here means the insert silently matched nothing (e.g. a triggered
    // BEFORE INSERT rule), which is unexpected.
    throw new Error(
      `Supabase insert for guest group "${slug}" returned no representation.`
    );
  }
  return mapRow(row);
}

/**
 * Soft-delete a guest group by slug: PATCH `is_active = false` ONLY.
 *
 * Unlike `updateGuestGroupInSupabase`, which PATCHes `display_name`,
 * `assigned_seats`, `seats_note`, and `is_active` together (a full-row edit
 * from the admin form), this helper PATCHes ONLY `is_active`. PostgREST PATCH
 * is partial: columns absent from the body are left untouched, so
 * `display_name`, `assigned_seats`, `seats_note`, and `notes` keep their stored
 * values and an existing RSVP row (in the `rsvps` table, linked by
 * `guest_group_slug`) is fully preserved — neither truncated nor deleted. The
 * row stays queryable through `findGuestGroupBySlugIncludingInactiveFromSupabase`
 * so the `Nueva invitación` create flow can reactivate it later.
 *
 * The slug is the immutable primary key and selects the row; it never appears
 * in the body. `return=representation` plus the `select` param returns the
 * patched row so the boundary can tell "matched and patched" (row returned)
 * from "no row matched" (empty array -> mapped to `group_not_found`).
 *
 * Requires only the existing UPDATE table privilege (see migration 0003): a
 * PATCH of `is_active` is an UPDATE, so neither a DELETE nor an INSERT grant is
 * needed. The migration intentionally does NOT grant DELETE on
 * `guest_groups` — the admin never hard-deletes in this slice.
 */
export async function softDeleteGuestGroupInSupabase(
  slug: string
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
    body: JSON.stringify({ is_active: false }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase soft-delete for guest group "${slug}" failed: ${res.status} ${body}`
    );
  }

  const rows: GuestGroupRow[] = await res.json();
  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

/**
 * Patch ONLY `sent_at` on a guest group by slug.
 *
 * Used by the `Enviada` toggle (`toggleGuestGroupSentAction` -> the
 * `setGuestGroupSentAtForAdmin` boundary): tapping the switch ON sets
 * `sent_at` to a server-generated UTC ISO timestamp (so other devices share
 * the host's "I already sent this" state), and tapping it OFF resets it to
 * `null` (sent state cleared). PostgREST PATCH is partial: columns absent
 * from the body are left untouched, so `display_name`, `assigned_seats`,
 * `seats_note`, `notes`, `is_active`, and an existing RSVP row are all
 * preserved.
 *
 * The slug is the immutable primary key and selects the row; it never appears
 * in the body. `return=representation` plus the `select` param returns the
 * patched row so the boundary can tell "matched and patched" (row returned)
 * from "no row matched" (empty array -> mapped to `group_not_found`).
 *
 * Requires only the existing UPDATE table privilege (see migration 0003): a
 * PATCH of `sent_at` is an UPDATE. No DELETE or INSERT grant is needed, and
 * migration 0005 adds neither — it only DDLs the nullable column.
 *
 * `sentAt` is accepted as a precomputed server-generated ISO string rather than
 * computed inside this helper to keep this transport module free of clock/time
 * logic; the boundary owns "now". Pass `null` to clear the column.
 */
export async function setGuestGroupSentAtInSupabase(
  slug: string,
  sentAt: string | null
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
    body: JSON.stringify({ sent_at: sentAt }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Supabase set sent_at for guest group "${slug}" failed: ${res.status} ${body}`
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
 * Uses PostgREST's embedded resource selection with the explicit internal UUID
 * foreign key (`rsvps!rsvps_guest_group_id_fkey(...)`) so the join happens
 * server-side in a single round-trip. Public invitation links remain slug/token
 * compatible; admin reads consume the UUID relationship.
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
    `&select=${COLUMNS},rsvps!rsvps_guest_group_id_fkey(${RSVP_COLUMNS})` +
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
 * `guest_group_slug` is still the physical primary key for compatibility, so
 * `Prefer: resolution=merge-duplicates` preserves repeat-submission semantics.
 * When a Supabase UUID is available, the body also sends `guest_group_id`, which
 * is the internal RSVP/guest-group identity used by newer relationships.
 * `return=representation` plus the `select` query param returns the resulting
 * row so the caller gets back `created_at`/`updated_at` without a second fetch.
 *
 * The boundary has already validated `attendingCount` and `message`, so this
 * function trusts its arguments and only reports transport-level failures.
 */
export async function upsertRsvpInSupabase(
  slug: string,
  groupId: string | null,
  attendingCount: number,
  message: string | null
): Promise<Rsvp> {
  const { baseUrl, serviceRoleKey } = getConfig();
  const url = `${baseUrl}${RSVP_REST_PATH}?select=${RSVP_COLUMNS}`;
  const uuidIdentity =
    groupId && isUuidIdentifier(groupId) ? { guest_group_id: groupId } : {};

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...authHeaders(serviceRoleKey),
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    cache: "no-store",
    body: JSON.stringify({
      guest_group_slug: slug,
      ...uuidIdentity,
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
