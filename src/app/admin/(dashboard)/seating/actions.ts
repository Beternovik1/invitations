"use server";

import { revalidatePath } from "next/cache";

import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";
import {
  createEventTableForAdmin,
  createEventTablesBulkForAdmin,
  deleteEventTableForAdmin,
  updateEventTableForAdmin,
  type EventTableBulkCreateFormState,
  type EventTableCreateFormState,
  type EventTableDeleteFormState,
  type EventTableFormState,
} from "@/lib/admin-seating";
import {
  INITIAL_EVENT_TABLE_DELETE_FORM_STATE,
  INITIAL_EVENT_TABLE_FORM_STATE,
} from "@/lib/admin-seating-shared";

function parseTableInput(formData: FormData) {
  const rawLabel = formData.get("label");
  const rawCapacity = formData.get("capacity");

  return {
    label: typeof rawLabel === "string" ? rawLabel : "",
    capacity: typeof rawCapacity === "string" ? Number(rawCapacity) : Number.NaN,
  };
}

function parseBulkTableInput(formData: FormData) {
  const rawAmount = formData.get("amount");
  const rawCapacity = formData.get("capacity");

  return {
    amount: typeof rawAmount === "string" ? Number(rawAmount) : Number.NaN,
    capacity: typeof rawCapacity === "string" ? Number(rawCapacity) : Number.NaN,
  };
}

function sessionExpiredError() {
  return {
    code: "unexpected" as const,
    message:
      "Tu sesión de administrador expiró. Recarga la página para iniciar sesión de nuevo.",
  };
}

export async function createEventTableAction(
  prevState: EventTableCreateFormState,
  formData: FormData
): Promise<EventTableCreateFormState> {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return { status: "error", error: sessionExpiredError() };
  }

  const result = await createEventTableForAdmin(parseTableInput(formData));
  if (result.ok) {
    revalidatePath("/admin/seating");
    return { status: "success", tableId: result.table.id };
  }
  return { status: "error", error: result.error };
}

export async function createEventTablesBulkAction(
  prevState: EventTableBulkCreateFormState,
  formData: FormData
): Promise<EventTableBulkCreateFormState> {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return { status: "error", error: sessionExpiredError() };
  }

  const result = await createEventTablesBulkForAdmin(
    parseBulkTableInput(formData)
  );
  if (result.ok) {
    revalidatePath("/admin/seating");
    return { status: "success", tableCount: result.tables.length };
  }
  return { status: "error", error: result.error };
}

export async function createEventTablesAdaptiveAction(
  prevState: EventTableBulkCreateFormState,
  formData: FormData
): Promise<EventTableBulkCreateFormState> {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return { status: "error", error: sessionExpiredError() };
  }

  const bulkInput = parseBulkTableInput(formData);
  if (bulkInput.amount === 1) {
    const result = await createEventTableForAdmin(parseTableInput(formData));
    if (result.ok) {
      revalidatePath("/admin/seating");
      return { status: "success", tableCount: 1 };
    }
    return { status: "error", error: result.error };
  }

  const result = await createEventTablesBulkForAdmin(bulkInput);
  if (result.ok) {
    revalidatePath("/admin/seating");
    return { status: "success", tableCount: result.tables.length };
  }
  return { status: "error", error: result.error };
}

export async function updateEventTableAction(
  prevState: EventTableFormState,
  formData: FormData
): Promise<EventTableFormState> {
  const rawTableId = formData.get("tableId");
  const tableId = typeof rawTableId === "string" ? rawTableId.trim() : "";
  if (tableId.length === 0) return INITIAL_EVENT_TABLE_FORM_STATE;

  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return { status: "error", tableId, error: sessionExpiredError() };
  }

  const result = await updateEventTableForAdmin(
    tableId,
    parseTableInput(formData)
  );
  if (result.ok) {
    revalidatePath("/admin/seating");
    return { status: "success", tableId };
  }
  return { status: "error", tableId, error: result.error };
}

export async function deleteEventTableAction(
  prevState: EventTableDeleteFormState,
  formData: FormData
): Promise<EventTableDeleteFormState> {
  const rawTableId = formData.get("tableId");
  const tableId = typeof rawTableId === "string" ? rawTableId.trim() : "";
  if (tableId.length === 0) return INITIAL_EVENT_TABLE_DELETE_FORM_STATE;

  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return { status: "error", tableId, error: sessionExpiredError() };
  }

  const result = await deleteEventTableForAdmin(tableId);
  if (result.ok) {
    revalidatePath("/admin/seating");
    return { status: "success", tableId };
  }
  return { status: "error", tableId, error: result.error };
}
