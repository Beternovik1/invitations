/**
 * Admin seating data boundary.
 *
 * This module powers `/admin/seating`: it reads seating foundation data and
 * validates table create/update/delete writes. Mock mode mirrors the current
 * zero-config state for reads, but write calls refuse to fake persistence.
 */

import { cache } from "react";

import {
  GUEST_GROUPS,
  isSupabaseConfigured,
  type GuestGroup,
} from "@/lib/guest-groups";
import type { Rsvp } from "@/lib/rsvps-shared";
import {
  MAX_BULK_TABLE_COUNT,
  MAX_TABLE_CAPACITY,
  MAX_TABLE_LABEL_LENGTH,
  type AdminEventTable,
  type AdminEventTableActionResult,
  type AdminEventTableBulkActionResult,
  type AdminEventTableBulkInput,
  type AdminEventTableDeleteResult,
  type AdminEventTableError,
  type AdminEventTableErrorCode,
  type AdminEventTableInput,
  type EventTableBulkCreateFormState,
  type EventTableCreateFormState,
  type EventTableDeleteFormState,
  type EventTableFormState,
} from "@/lib/admin-seating-shared";

export {
  MAX_BULK_TABLE_COUNT,
  MAX_TABLE_CAPACITY,
  MAX_TABLE_LABEL_LENGTH,
  type AdminEventTable,
  type AdminEventTableActionResult,
  type AdminEventTableBulkActionResult,
  type AdminEventTableBulkInput,
  type AdminEventTableDeleteResult,
  type AdminEventTableError,
  type AdminEventTableErrorCode,
  type AdminEventTableInput,
  type EventTableBulkCreateFormState,
  type EventTableCreateFormState,
  type EventTableDeleteFormState,
  type EventTableFormState,
};

export type EventTable = AdminEventTable;

export interface TableAssignment {
  eventId: string;
  guestGroupId: string;
  tableId: string;
}

export interface AdminSeatingGuestGroup extends GuestGroup {
  eventId?: string;
  rsvp: Rsvp | null;
}

export interface AdminSeatingData {
  eventTables: EventTable[];
  tableAssignments: TableAssignment[];
  guestGroups: AdminSeatingGuestGroup[];
}

export function getTableAssignmentsForTable(
  table: EventTable,
  tableAssignments: TableAssignment[],
  guestGroups: AdminSeatingGuestGroup[]
): AdminSeatingGuestGroup[] {
  const groupsById = new Map<string, AdminSeatingGuestGroup>();
  for (const group of guestGroups) {
    if (group.id) groupsById.set(group.id, group);
  }

  return tableAssignments
    .filter(
      (assignment) =>
        assignment.eventId === table.eventId && assignment.tableId === table.id
    )
    .map((assignment) => groupsById.get(assignment.guestGroupId))
    .filter((group): group is AdminSeatingGuestGroup => Boolean(group));
}

export function getUnassignedGuestGroups(
  guestGroups: AdminSeatingGuestGroup[],
  tableAssignments: TableAssignment[]
): AdminSeatingGuestGroup[] {
  const assignedIds = new Set(
    tableAssignments.map((assignment) => assignment.guestGroupId)
  );

  return guestGroups.filter((group) => !group.id || !assignedIds.has(group.id));
}

export function getGuestGroupSeatLabel(group: AdminSeatingGuestGroup): string {
  if (group.assignedSeats == null) return group.seatsNote ?? "Por confirmar";
  return group.assignedSeats === 1
    ? "1 lugar"
    : `${group.assignedSeats} lugares`;
}

export function getGuestGroupRsvpLabel(group: AdminSeatingGuestGroup): string {
  if (!group.rsvp) return "Sin respuesta";
  if (group.rsvp.attendingCount === 0) return "No asiste";
  return `${group.rsvp.attendingCount} confirmado${
    group.rsvp.attendingCount === 1 ? "" : "s"
  }`;
}

export const getAdminSeatingData = cache(async (): Promise<AdminSeatingData> => {
  if (!isSupabaseConfigured()) {
    return {
      eventTables: [],
      tableAssignments: [],
      guestGroups: GUEST_GROUPS.map((group) => ({ ...group, rsvp: null })),
    };
  }

  const {
    fetchAdminSeatingGuestGroupsFromSupabase,
    fetchEventTablesFromSupabase,
    fetchTableAssignmentsFromSupabase,
  } = await import("@/lib/supabase/server");

  const [eventTables, tableAssignments, guestGroups] = await Promise.all([
    fetchEventTablesFromSupabase(),
    fetchTableAssignmentsFromSupabase(),
    fetchAdminSeatingGuestGroupsFromSupabase(),
  ]);

  return { eventTables, tableAssignments, guestGroups };
});

const ERROR_MESSAGES: Record<AdminEventTableErrorCode, string> = {
  table_not_found:
    "Esta mesa ya no existe. Recarga la página para actualizar la lista.",
  event_not_available:
    "No se pudo determinar el evento de estas mesas. Revisa que las invitaciones pertenezcan a un solo evento.",
  label_empty: "El nombre de la mesa no puede estar vacío.",
  label_too_long: `El nombre de la mesa debe tener ${MAX_TABLE_LABEL_LENGTH} caracteres o menos.`,
  capacity_invalid: "La capacidad debe ser un número entero mayor a 0.",
  capacity_too_many: `La capacidad no puede ser mayor a ${MAX_TABLE_CAPACITY} lugares.`,
  amount_invalid: "La cantidad de mesas debe ser un número entero mayor a 0.",
  amount_too_many: `Crea ${MAX_BULK_TABLE_COUNT} mesas o menos por vez.`,
  display_order_invalid: "El orden debe ser un número entero mayor a 0.",
  label_taken: "Ya existe una mesa con ese nombre en este evento.",
  display_order_taken: "Ya existe una mesa con ese orden en este evento.",
  table_has_assignments:
    "Esta mesa ya tiene familias asignadas. Quita esas asignaciones antes de eliminarla.",
  unavailable:
    "La edición de mesas no está disponible en este entorno. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para activarla.",
  unexpected:
    "Ocurrió un problema al guardar esta mesa. Inténtalo de nuevo en un momento.",
};

function error(
  code: AdminEventTableErrorCode,
  fields?: AdminEventTableError["fields"]
): AdminEventTableError {
  return { code, message: ERROR_MESSAGES[code], fields };
}

function eventIdForWrite(data: AdminSeatingData): string | null {
  const eventIds = new Set<string>();
  for (const table of data.eventTables) eventIds.add(table.eventId);
  for (const group of data.guestGroups) {
    if (group.eventId) eventIds.add(group.eventId);
  }
  return eventIds.size === 1 ? [...eventIds][0] : null;
}

function validateTableInput(
  input: AdminEventTableInput
):
  | { ok: true; label: string; capacity: number }
  | { ok: false; error: AdminEventTableError } {
  const label = input.label.trim();
  if (label.length === 0) {
    return {
      ok: false,
      error: error("label_empty", { label: "Ingresa un nombre para la mesa." }),
    };
  }
  if (label.length > MAX_TABLE_LABEL_LENGTH) {
    return {
      ok: false,
      error: error("label_too_long", {
        label: `Mantén el nombre en ${MAX_TABLE_LABEL_LENGTH} caracteres o menos.`,
      }),
    };
  }

  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    return {
      ok: false,
      error: error("capacity_invalid", {
        capacity: "Usa un número entero mayor a 0.",
      }),
    };
  }
  if (input.capacity > MAX_TABLE_CAPACITY) {
    return {
      ok: false,
      error: error("capacity_too_many", {
        capacity: `Usa ${MAX_TABLE_CAPACITY} lugares o menos.`,
      }),
    };
  }

  return {
    ok: true,
    label,
    capacity: input.capacity,
  };
}

function validateBulkTableInput(
  input: AdminEventTableBulkInput
):
  | { ok: true; amount: number; capacity: number }
  | { ok: false; error: AdminEventTableError } {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return {
      ok: false,
      error: error("amount_invalid", {
        amount: "Usa un número entero mayor a 0.",
      }),
    };
  }
  if (input.amount > MAX_BULK_TABLE_COUNT) {
    return {
      ok: false,
      error: error("amount_too_many", {
        amount: `Crea ${MAX_BULK_TABLE_COUNT} mesas o menos por vez.`,
      }),
    };
  }

  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    return {
      ok: false,
      error: error("capacity_invalid", {
        capacity: "Usa un número entero mayor a 0.",
      }),
    };
  }
  if (input.capacity > MAX_TABLE_CAPACITY) {
    return {
      ok: false,
      error: error("capacity_too_many", {
        capacity: `Usa ${MAX_TABLE_CAPACITY} lugares o menos.`,
      }),
    };
  }

  return { ok: true, amount: input.amount, capacity: input.capacity };
}

function nextDisplayOrder(tables: EventTable[], eventId: string): number {
  return (
    tables
      .filter((table) => table.eventId === eventId)
      .reduce((max, table) => Math.max(max, table.displayOrder), 0) + 1
  );
}

function nextMesaSequence(tables: EventTable[], eventId: string): number {
  const eventTables = tables.filter((table) => table.eventId === eventId);
  const maxMesaNumber = eventTables.reduce((max, table) => {
    const match = table.label.trim().match(/^Mesa\s+(\d+)$/i);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return Math.max(eventTables.length, maxMesaNumber) + 1;
}

function hasTableCollision(
  tables: EventTable[],
  eventId: string,
  input: { label: string; displayOrder: number },
  tableId?: string
): AdminEventTableError | null {
  const normalizedLabel = input.label.toLocaleLowerCase("es-MX");
  for (const table of tables) {
    if (table.eventId !== eventId || table.id === tableId) continue;
    if (table.label.trim().toLocaleLowerCase("es-MX") === normalizedLabel) {
      return error("label_taken", { label: "Usa otro nombre para esta mesa." });
    }
    if (table.displayOrder === input.displayOrder) {
      return error("display_order_taken", {
        displayOrder: "Elige otro orden para esta mesa.",
      });
    }
  }
  return null;
}

export async function createEventTableForAdmin(
  input: AdminEventTableInput
): Promise<AdminEventTableActionResult> {
  const validated = validateTableInput(input);
  if (!validated.ok) return { ok: false, error: validated.error };
  if (!isSupabaseConfigured()) return { ok: false, error: error("unavailable") };

  try {
    const data = await getAdminSeatingData();
    const eventId = eventIdForWrite(data);
    if (!eventId) return { ok: false, error: error("event_not_available") };
    const displayOrder = nextDisplayOrder(data.eventTables, eventId);
    const collision = hasTableCollision(data.eventTables, eventId, {
      label: validated.label,
      displayOrder,
    });
    if (collision) return { ok: false, error: collision };

    const { insertEventTableInSupabase } = await import("@/lib/supabase/server");
    const table = await insertEventTableInSupabase(eventId, {
      label: validated.label,
      capacity: validated.capacity,
      displayOrder,
    });
    return { ok: true, table };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}

export async function createEventTablesBulkForAdmin(
  input: AdminEventTableBulkInput
): Promise<AdminEventTableBulkActionResult> {
  const validated = validateBulkTableInput(input);
  if (!validated.ok) return { ok: false, error: validated.error };
  if (!isSupabaseConfigured()) return { ok: false, error: error("unavailable") };

  try {
    const data = await getAdminSeatingData();
    const eventId = eventIdForWrite(data);
    if (!eventId) return { ok: false, error: error("event_not_available") };

    const startSequence = nextMesaSequence(data.eventTables, eventId);
    const startDisplayOrder = nextDisplayOrder(data.eventTables, eventId);
    const tables = Array.from({ length: validated.amount }, (_, index) => ({
      label: `Mesa ${startSequence + index}`,
      capacity: validated.capacity,
      displayOrder: startDisplayOrder + index,
    }));

    for (const table of tables) {
      const collision = hasTableCollision(data.eventTables, eventId, table);
      if (collision) return { ok: false, error: collision };
    }

    const { insertEventTablesInSupabase } = await import(
      "@/lib/supabase/server"
    );
    const insertedTables = await insertEventTablesInSupabase(eventId, tables);
    return { ok: true, tables: insertedTables };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}

export async function updateEventTableForAdmin(
  tableId: string,
  input: AdminEventTableInput
): Promise<AdminEventTableActionResult> {
  const trimmedTableId = tableId.trim();
  if (trimmedTableId.length === 0) {
    return { ok: false, error: error("table_not_found") };
  }
  const validated = validateTableInput(input);
  if (!validated.ok) return { ok: false, error: validated.error };
  if (!isSupabaseConfigured()) return { ok: false, error: error("unavailable") };

  try {
    const data = await getAdminSeatingData();
    const currentTable = data.eventTables.find(
      (table) => table.id === trimmedTableId
    );
    if (!currentTable) return { ok: false, error: error("table_not_found") };
    const collision = hasTableCollision(
      data.eventTables,
      currentTable.eventId,
      { label: validated.label, displayOrder: currentTable.displayOrder },
      currentTable.id
    );
    if (collision) return { ok: false, error: collision };

    const { updateEventTableInSupabase } = await import("@/lib/supabase/server");
    const table = await updateEventTableInSupabase(
      currentTable.id,
      currentTable.eventId,
      {
        label: validated.label,
        capacity: validated.capacity,
        displayOrder: currentTable.displayOrder,
      }
    );
    if (!table) return { ok: false, error: error("table_not_found") };
    return { ok: true, table };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}

export async function deleteEventTableForAdmin(
  tableId: string
): Promise<AdminEventTableDeleteResult> {
  const trimmedTableId = tableId.trim();
  if (trimmedTableId.length === 0) {
    return { ok: false, error: error("table_not_found") };
  }
  if (!isSupabaseConfigured()) return { ok: false, error: error("unavailable") };

  try {
    const data = await getAdminSeatingData();
    const table = data.eventTables.find((item) => item.id === trimmedTableId);
    if (!table) return { ok: false, error: error("table_not_found") };
    const hasAssignments = data.tableAssignments.some(
      (assignment) =>
        assignment.eventId === table.eventId && assignment.tableId === table.id
    );
    if (hasAssignments) {
      return { ok: false, error: error("table_has_assignments") };
    }

    const {
      countTableAssignmentsInSupabase,
      deleteEventTableInSupabase,
    } = await import("@/lib/supabase/server");
    if ((await countTableAssignmentsInSupabase(table.eventId, table.id)) > 0) {
      return { ok: false, error: error("table_has_assignments") };
    }

    const deleted = await deleteEventTableInSupabase(table.id, table.eventId);
    if (!deleted) return { ok: false, error: error("table_not_found") };
    return { ok: true };
  } catch {
    return { ok: false, error: error("unexpected") };
  }
}
