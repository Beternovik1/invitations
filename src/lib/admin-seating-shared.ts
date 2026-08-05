export const MAX_TABLE_LABEL_LENGTH = 80;
export const MAX_TABLE_CAPACITY = 20;
export const MAX_BULK_TABLE_COUNT = 50;

export interface AdminEventTable {
  id: string;
  eventId: string;
  label: string;
  capacity: number;
  displayOrder: number;
}

export interface AdminEventTableInput {
  label: string;
  capacity: number;
}

export interface AdminEventTableBulkInput {
  amount: number;
  capacity: number;
}

export type AdminEventTableErrorCode =
  | "table_not_found"
  | "group_not_found"
  | "event_not_available"
  | "event_mismatch"
  | "seats_missing"
  | "table_capacity_exceeded"
  | "label_empty"
  | "label_too_long"
  | "capacity_invalid"
  | "capacity_too_many"
  | "amount_invalid"
  | "amount_too_many"
  | "display_order_invalid"
  | "label_taken"
  | "display_order_taken"
  | "table_has_assignments"
  | "unavailable"
  | "unexpected";

export interface AdminEventTableError {
  code: AdminEventTableErrorCode;
  message: string;
  fields?: Partial<
    Record<"label" | "capacity" | "amount" | "displayOrder", string>
  >;
}

export type AdminEventTableActionResult =
  | { ok: true; table: AdminEventTable }
  | { ok: false; error: AdminEventTableError };

export type AdminEventTableDeleteResult =
  | { ok: true }
  | { ok: false; error: AdminEventTableError };

export type AdminEventTableBulkActionResult =
  | { ok: true; tables: AdminEventTable[] }
  | { ok: false; error: AdminEventTableError };

export type EventTableCreateFormState =
  | { status: "idle" }
  | { status: "success"; tableId: string }
  | { status: "error"; error: AdminEventTableError };

export const INITIAL_EVENT_TABLE_CREATE_FORM_STATE: EventTableCreateFormState = {
  status: "idle",
};

export type EventTableBulkCreateFormState =
  | { status: "idle" }
  | { status: "success"; tableCount: number }
  | { status: "error"; error: AdminEventTableError };

export const INITIAL_EVENT_TABLE_BULK_CREATE_FORM_STATE: EventTableBulkCreateFormState =
  { status: "idle" };

export type EventTableFormState =
  | { status: "idle"; tableId: string }
  | { status: "success"; tableId: string }
  | { status: "error"; tableId: string; error: AdminEventTableError };

export const INITIAL_EVENT_TABLE_FORM_STATE: EventTableFormState = {
  status: "idle",
  tableId: "",
};

export type EventTableDeleteFormState =
  | { status: "idle"; tableId: string }
  | { status: "success"; tableId: string }
  | { status: "error"; tableId: string; error: AdminEventTableError };

export const INITIAL_EVENT_TABLE_DELETE_FORM_STATE: EventTableDeleteFormState = {
  status: "idle",
  tableId: "",
};

export type TableAssignmentFormState =
  | { status: "idle"; groupId: string }
  | { status: "success"; groupId: string }
  | { status: "error"; groupId: string; error: AdminEventTableError };

export const INITIAL_TABLE_ASSIGNMENT_FORM_STATE: TableAssignmentFormState = {
  status: "idle",
  groupId: "",
};
