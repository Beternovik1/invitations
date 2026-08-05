// Deterministic source-contract tests for the admin seating table-management slice.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const readSrc = async (rel) => readFile(join(ROOT, rel), "utf8");

const PAGE = "src/app/admin/(dashboard)/seating/page.tsx";
const VIEW = "src/app/admin/(dashboard)/seating/SeatingTableManager.tsx";
const ACTIONS = "src/app/admin/(dashboard)/seating/actions.ts";
const BOUNDARY = "src/lib/admin-seating.ts";
const SHARED = "src/lib/admin-seating-shared.ts";
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

test("admin seating page adds table management without drag-and-drop", async () => {
  const page = await readSrc(PAGE);
  const view = await readSrc(VIEW);

  assert.match(page, /SeatingTableManager/);
  assert.match(view, /\+ Nueva mesa/);
  assert.match(view, /useState\(false\)/);
  assert.match(view, /createEventTablesAdaptiveAction/);
  assert.match(view, /<AdaptiveTableFields/);
  assert.match(view, /Cantidad de mesas/);
  assert.match(view, /Capacidad por mesa/);
  assert.match(view, /defaultValue="1"/);
  assert.match(view, /defaultValue="10"/);
  assert.match(view, /const showLabel = amount === 1/);
  assert.match(view, /\{showLabel \? \(/);
  assert.match(view, /Nombre de la mesa/);
  assert.match(view, /label=\{isSingleTable \? "Crear mesa" : "Crear mesas"\}/);
  assert.doesNotMatch(view, /name="displayOrder"|Orden|Posición/);
  assert.doesNotMatch(view, /Una mesa|Varias mesas|lg:grid-cols-2/);
  assert.match(view, /Modificar/);
  assert.match(view, /¿Eliminar esta mesa\?/);
  assert.match(view, /Todavía no hay mesas creadas\./);
  assert.match(page, /Familias pendientes de acomodar/);
  assert.doesNotMatch(view, /draggable|onDrag|room map|QR|check-in/i);
});

test("admin seating boundary reads and writes real Supabase seating tables", async () => {
  const boundary = await readSrc(BOUNDARY);
  const server = await readSrc(SUPABASE_SERVER);
  const actions = await readSrc(ACTIONS);

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
  assert.match(boundary, /createEventTableForAdmin/);
  assert.match(boundary, /createEventTablesBulkForAdmin/);
  assert.match(boundary, /updateEventTableForAdmin/);
  assert.match(boundary, /deleteEventTableForAdmin/);
  assert.match(server, /insertEventTableInSupabase/);
  assert.match(server, /insertEventTablesInSupabase/);
  assert.match(server, /updateEventTableInSupabase/);
  assert.match(server, /deleteEventTableInSupabase/);
  assert.match(actions, /createEventTableAction/);
  assert.match(actions, /createEventTablesBulkAction/);
  assert.match(actions, /createEventTablesAdaptiveAction/);
  assert.match(actions, /bulkInput\.amount === 1/);
  assert.match(actions, /updateEventTableAction/);
  assert.match(actions, /deleteEventTableAction/);
  assert.match(actions, /revalidatePath\("\/admin\/seating"\)/);
});

test("admin seating mutations are event-scoped and refuse unsafe deletes", async () => {
  const boundary = await readSrc(BOUNDARY);
  const server = await readSrc(SUPABASE_SERVER);
  const shared = await readSrc(SHARED);
  const view = await readSrc(VIEW);

  assert.match(boundary, /function eventIdForWrite/);
  assert.match(boundary, /eventIds\.size === 1/);
  assert.match(boundary, /table_has_assignments/);
  assert.match(boundary, /countTableAssignmentsInSupabase/);
  assert.match(server, /event_id=eq\.\$\{encodeURIComponent\(eventId\)\}/);
  assert.match(shared, /MAX_TABLE_LABEL_LENGTH/);
  assert.match(shared, /MAX_TABLE_CAPACITY = 20/);
  assert.match(shared, /MAX_BULK_TABLE_COUNT/);
  assert.match(boundary, /function nextDisplayOrder/);
  assert.match(boundary, /function nextMesaSequence/);
  assert.match(view, /No se puede eliminar: esta mesa tiene familias asignadas\./);
  assert.match(view, /ADMIN_TABLE_EDIT_BUTTON_CLASS/);
  assert.match(view, /bg-\(--color-mist-blue\)\/70/);
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
