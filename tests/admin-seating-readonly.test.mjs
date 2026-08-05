// Deterministic source-contract tests for the read-only admin seating slice.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSrc = async (rel) => readFile(join(ROOT, rel), "utf8");

const PAGE = "src/app/admin/(dashboard)/seating/page.tsx";
const BOUNDARY = "src/lib/admin-seating.ts";
const SUPABASE_SERVER = "src/lib/supabase/server.ts";
const CHROME = "src/app/admin/_components/AdminDashboardChrome.tsx";

test("admin seating route uses English internals and Spanish visible label", async () => {
  const page = await readSrc(PAGE);
  const chrome = await readSrc(CHROME);

  assert.match(page, /export const metadata[\s\S]*title: "Mesas"/);
  assert.match(page, /AdminSeatingPage/);
  assert.match(chrome, /href: "\/admin\/seating", label: "Mesas"/);
  assert.doesNotMatch(chrome, /\/admin\/mesas/);
});

test("admin seating page is read-only and shows the approved empty/planning states", async () => {
  const page = await readSrc(PAGE);

  assert.match(page, /Todavía no hay mesas creadas\./);
  assert.match(page, /Familias pendientes de acomodar/);
  assert.match(page, /Solo lectura/);
  assert.doesNotMatch(
    page,
    /<form\b|action=|draggable|onDrag|create|update|delete|insert/i
  );
});

test("admin seating boundary reads real Supabase seating tables, assignments, and RSVP-backed groups", async () => {
  const boundary = await readSrc(BOUNDARY);
  const server = await readSrc(SUPABASE_SERVER);

  assert.match(boundary, /eventTables: EventTable\[\]/);
  assert.match(boundary, /tableAssignments: TableAssignment\[\]/);
  assert.match(boundary, /guestGroups: AdminSeatingGuestGroup\[\]/);
  assert.match(boundary, /fetchEventTablesFromSupabase/);
  assert.match(boundary, /fetchTableAssignmentsFromSupabase/);
  assert.match(boundary, /fetchAdminSeatingGuestGroupsFromSupabase/);
  assert.match(
    server,
    /const EVENT_TABLES_REST_PATH = "\/rest\/v1\/event_tables"/
  );
  assert.match(
    server,
    /const TABLE_ASSIGNMENTS_REST_PATH = "\/rest\/v1\/guest_group_table_assignments"/
  );
  assert.match(server, /rsvps!rsvps_guest_group_id_fkey/);
  assert.doesNotMatch(
    boundary,
    /export async function (insert|update|delete)|method: "(POST|PATCH|DELETE)"/i
  );
});

test("admin seating helpers expose the read-only grouping and labels", async () => {
  const boundary = await readSrc(BOUNDARY);
  const page = await readSrc(PAGE);

  assert.match(boundary, /export function getTableAssignmentsForTable\(/);
  assert.match(boundary, /assignment\.eventId === table\.eventId/);
  assert.match(boundary, /assignment\.tableId === table\.id/);
  assert.match(boundary, /export function getUnassignedGuestGroups\(/);
  assert.match(boundary, /return "Sin respuesta"/);
  assert.match(boundary, /return "No asiste"/);
  assert.match(boundary, /return group\.seatsNote \?\? "Por confirmar"/);
  assert.match(page, /getGuestGroupSeatLabel\(group\)/);
  assert.match(page, /getGuestGroupRsvpLabel\(group\)/);
});

test("admin seating summary prioritizes table organization metrics with context below", async () => {
  const page = await readSrc(PAGE);

  assert.match(page, /import \{ confirmationStatusFor \}/);
  assert.match(page, /function computeSeatingSummary/);
  assert.match(page, /label="Mesas disponibles"/);
  assert.match(page, /label="Capacidad total"/);
  assert.match(page, /label="Lugares en mesa"/);
  assert.match(page, /label="Familias pendientes"/);
  assert.match(page, /label="Lugares pendientes"/);
  assert.match(page, /ContextCard label="Invitaciones activas"/);
  assert.match(page, /ContextCard[\s\S]*label="Invitados confirmados"/);
  assert.match(page, /const assignedTableGroupIds = new Set/);
  assert.match(page, /assignedTableSeats \+= seats/);
  assert.match(page, /pendingSeats \+= seats/);
  assert.match(page, /status === "confirmado"/);
  assert.doesNotMatch(page, /label="Mesas cargadas"/);
  assert.doesNotMatch(page, /label="Invitaciones confirmadas"/);
});
