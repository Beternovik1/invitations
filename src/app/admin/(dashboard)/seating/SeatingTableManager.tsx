"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createEventTablesAdaptiveAction,
  deleteEventTableAction,
  updateEventTableAction,
} from "@/app/admin/(dashboard)/seating/actions";
import {
  INITIAL_EVENT_TABLE_BULK_CREATE_FORM_STATE,
  INITIAL_EVENT_TABLE_DELETE_FORM_STATE,
  INITIAL_EVENT_TABLE_FORM_STATE,
  MAX_BULK_TABLE_COUNT,
  MAX_TABLE_CAPACITY,
  MAX_TABLE_LABEL_LENGTH,
  type EventTableBulkCreateFormState,
  type EventTableFormState,
} from "@/lib/admin-seating-shared";

interface SeatingTableGuestGroup {
  id: string;
  displayName: string;
  slug: string;
  seatLabel: string;
  rsvpLabel: string;
  rsvpTone: "empty" | "declined" | "confirmed";
}

export interface SeatingTableRow {
  id: string;
  label: string;
  capacity: number;
  displayOrder: number;
  assignedSeats: number;
  capacityLabel: string;
  occupancyPercent: number;
  assignedGroups: SeatingTableGuestGroup[];
}

const ADMIN_CARD_CLASS =
  "rounded-2xl border border-(--color-admin-border) bg-white p-4 shadow-[0_14px_30px_rgba(36,48,68,0.07)] sm:p-5";

const ADMIN_PRIMARY_BUTTON_CLASS =
  "rounded-xl border border-(--color-admin-navy) bg-(--color-admin-navy) px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-(--color-admin-navy-soft) disabled:cursor-not-allowed disabled:opacity-60";

const ADMIN_SECONDARY_BUTTON_CLASS =
  "rounded-xl border border-(--color-admin-border) bg-white px-3 py-2 text-sm font-medium text-(--color-ink-dim) transition hover:border-(--color-admin-navy-soft) hover:text-(--color-ink)";

const ADMIN_TABLE_EDIT_BUTTON_CLASS =
  "rounded-xl border border-(--color-admin-navy) bg-(--color-admin-navy) px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-(--color-admin-navy-soft)";

const ADMIN_FIELD_CLASS =
  "w-full rounded-xl border border-(--color-admin-border) bg-white px-4 py-2.5 text-sm text-(--color-ink) shadow-sm outline-none transition focus:border-(--color-admin-navy-soft) focus:ring-2 focus:ring-(--color-admin-navy)/10";

const ADMIN_FIELD_LABEL_CLASS =
  "mb-1.5 block text-xs font-medium text-(--color-ink-dim)";

const STATUS_CHIP_CLASS =
  "inline-flex shrink-0 rounded-full border border-(--color-admin-border) bg-white/70 px-2.5 py-1 text-xs font-medium text-(--color-ink-dim)";

export default function SeatingTableManager({
  tables,
  guestGroupCount,
}: {
  tables: SeatingTableRow[];
  guestGroupCount: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [formState, formAction] = useActionState(
    updateEventTableAction,
    INITIAL_EVENT_TABLE_FORM_STATE
  );

  return (
    <section className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCreateOpen((open) => !open)}
          aria-expanded={createOpen}
          aria-controls="new-table-panel"
          className={ADMIN_PRIMARY_BUTTON_CLASS + " px-4"}
        >
          + Nueva mesa
        </button>
      </div>

      {createOpen ? (
        <NewTablePanel onClose={() => setCreateOpen(false)} />
      ) : null}

      {tables.length === 0 ? (
        <EmptyTablesState guestGroupCount={guestGroupCount} />
      ) : (
        <div className="grid gap-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              editing={editingTableId === table.id}
              formState={formState}
              formAction={formAction}
              onToggleEdit={(next) => setEditingTableId(next ? table.id : null)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NewTablePanel({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState(1);
  const [formState, formAction] = useActionState(
    createEventTablesAdaptiveAction,
    INITIAL_EVENT_TABLE_BULK_CREATE_FORM_STATE
  );
  const isSingleTable = amount === 1;

  return (
    <section id="new-table-panel" className={ADMIN_CARD_CLASS + " space-y-4"}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
            Crear mesas
          </h2>
          <p className="mt-0.5 text-sm text-(--color-ink-dim)">
            Elige cuántas mesas agregar. Si es solo una, ponle un nombre propio.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-full border border-(--color-admin-border) bg-white px-2.5 py-1 text-xs font-medium text-(--color-ink-dim) transition hover:border-(--color-admin-navy-soft) hover:text-(--color-ink)"
        >
          Cerrar
        </button>
      </div>

      <form
        action={formAction}
        className="space-y-3"
      >
        <AdaptiveTableFields
          amount={amount}
          onAmountChange={setAmount}
          state={formState}
        />

        <p className="rounded-xl border border-(--color-admin-border) bg-(--color-mist-blue)/50 px-3 py-2 text-xs leading-5 text-(--color-ink-dim)">
          {isSingleTable
            ? "Se agregará al final de la lista automáticamente."
            : "Se crearán como Mesa N, siguiendo la numeración existente."}
        </p>

        {formState.status === "success" ? (
          <p className="rounded-xl border border-(--color-dusty-teal)/35 bg-(--color-sage)/35 px-3 py-2 text-sm text-(--color-ink)">
            {formState.tableCount === 1
              ? "Mesa creada."
              : `${formState.tableCount} mesas creadas.`}
          </p>
        ) : null}
        {formState.status === "error" ? (
          <ErrorMessage message={formState.error.message} />
        ) : null}

        <div className="flex justify-end">
          <SubmitButton
            label={isSingleTable ? "Crear mesa" : "Crear mesas"}
            pendingLabel="Creando…"
          />
        </div>
      </form>
    </section>
  );
}

function TableCard({
  table,
  editing,
  formState,
  formAction,
  onToggleEdit,
}: {
  table: SeatingTableRow;
  editing: boolean;
  formState: EventTableFormState;
  formAction: (payload: FormData) => void;
  onToggleEdit: (editing: boolean) => void;
}) {
  return (
    <article className={ADMIN_CARD_CLASS}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
            {table.label}
          </h2>
          <p className="mt-0.5 text-sm text-(--color-ink-dim)">
            {table.capacityLabel}
          </p>
        </div>
        <span className={STATUS_CHIP_CLASS}>#{table.displayOrder}</span>
      </div>

      <div className="mt-4" aria-label={table.capacityLabel}>
        <div className="h-2 overflow-hidden rounded-full bg-(--color-mist-blue-deep)">
          <div
            className="h-full rounded-full bg-(--color-admin-navy)"
            style={{ width: `${table.occupancyPercent}%` }}
          />
        </div>
      </div>

      {table.assignedGroups.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-(--color-admin-border) bg-(--color-mist-blue)/70 px-4 py-5 text-sm text-(--color-ink-dim)">
          Esta mesa todavía no tiene familias asignadas.
        </p>
      ) : (
        <GuestGroupList groups={table.assignedGroups} />
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onToggleEdit(!editing)}
          aria-expanded={editing}
          className={ADMIN_TABLE_EDIT_BUTTON_CLASS}
        >
          {editing ? "Cerrar" : "Modificar"}
        </button>
      </div>

      {editing ? (
        <ModifyTablePanel
          table={table}
          formState={formState}
          formAction={formAction}
          onCancel={() => onToggleEdit(false)}
        />
      ) : null}
    </article>
  );
}

function ModifyTablePanel({
  table,
  formState,
  formAction,
  onCancel,
}: {
  table: SeatingTableRow;
  formState: EventTableFormState;
  formAction: (payload: FormData) => void;
  onCancel: () => void;
}) {
  const feedback = formState.tableId === table.id ? formState : null;

  return (
    <>
      <form
        action={formAction}
        className="mt-4 space-y-4 border-t border-(--color-admin-border) pt-4"
      >
        <input type="hidden" name="tableId" value={table.id} />
        <TableFields state={feedback} table={table} />

        {feedback?.status === "success" ? (
          <p className="rounded-xl border border-(--color-dusty-teal)/35 bg-(--color-sage)/35 px-3 py-2 text-sm text-(--color-ink)">
            Guardado.
          </p>
        ) : null}
        {feedback?.status === "error" ? (
          <ErrorMessage message={feedback.error.message} />
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            Cancelar
          </button>
          <SubmitButton label="Guardar cambios" pendingLabel="Guardando…" />
        </div>
      </form>

      <DeleteTableControl table={table} onCancel={onCancel} />
    </>
  );
}

function TableFields({
  state,
  table,
}: {
  state: EventTableFormState | null;
  table?: SeatingTableRow;
}) {
  const fieldErrors = state?.status === "error" ? state.error.fields : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <label className="block">
        <span className={ADMIN_FIELD_LABEL_CLASS}>Nombre</span>
        <input
          name="label"
          defaultValue={table?.label ?? ""}
          maxLength={MAX_TABLE_LABEL_LENGTH}
          required
          autoComplete="off"
          placeholder="Ej. Mesa 1"
          className={ADMIN_FIELD_CLASS}
        />
        {fieldErrors?.label ? <FieldError message={fieldErrors.label} /> : null}
      </label>
      <label className="block">
        <span className={ADMIN_FIELD_LABEL_CLASS}>Capacidad</span>
        <input
          name="capacity"
          type="number"
          min="1"
          max={MAX_TABLE_CAPACITY}
          step="1"
          inputMode="numeric"
          defaultValue={table?.capacity ?? ""}
          required
          className={ADMIN_FIELD_CLASS}
        />
        {fieldErrors?.capacity ? <FieldError message={fieldErrors.capacity} /> : null}
      </label>
    </div>
  );
}

function AdaptiveTableFields({
  amount,
  onAmountChange,
  state,
}: {
  amount: number;
  onAmountChange: (amount: number) => void;
  state: EventTableBulkCreateFormState;
}) {
  const fieldErrors = state.status === "error" ? state.error.fields : undefined;
  const showLabel = amount === 1;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className={ADMIN_FIELD_LABEL_CLASS}>Cantidad de mesas</span>
        <input
          name="amount"
          type="number"
          min="1"
          max={MAX_BULK_TABLE_COUNT}
          step="1"
          inputMode="numeric"
          defaultValue="1"
          onChange={(event) => onAmountChange(Number(event.currentTarget.value))}
          required
          className={ADMIN_FIELD_CLASS}
        />
        {fieldErrors?.amount ? <FieldError message={fieldErrors.amount} /> : null}
      </label>
      <label className="block">
        <span className={ADMIN_FIELD_LABEL_CLASS}>Capacidad por mesa</span>
        <input
          name="capacity"
          type="number"
          min="1"
          max={MAX_TABLE_CAPACITY}
          step="1"
          inputMode="numeric"
          defaultValue="10"
          required
          className={ADMIN_FIELD_CLASS}
        />
        {fieldErrors?.capacity ? <FieldError message={fieldErrors.capacity} /> : null}
      </label>
      {showLabel ? (
        <label className="block sm:col-span-2">
          <span className={ADMIN_FIELD_LABEL_CLASS}>Nombre de la mesa</span>
          <input
            name="label"
            maxLength={MAX_TABLE_LABEL_LENGTH}
            required
            autoComplete="off"
            placeholder="Ej. Mesa principal"
            className={ADMIN_FIELD_CLASS}
          />
          {fieldErrors?.label ? <FieldError message={fieldErrors.label} /> : null}
        </label>
      ) : null}
    </div>
  );
}

function DeleteTableControl({
  table,
  onCancel,
}: {
  table: SeatingTableRow;
  onCancel: () => void;
}) {
  const [deleteState, deleteAction] = useActionState(
    deleteEventTableAction,
    INITIAL_EVENT_TABLE_DELETE_FORM_STATE
  );
  const [confirming, setConfirming] = useState(false);
  const feedback = deleteState.tableId === table.id ? deleteState : null;
  const assigned = table.assignedGroups.length > 0;

  return (
    <div className="mt-4 space-y-3 border-t border-(--color-admin-border) pt-4">
      {assigned ? (
        <p className="rounded-xl border border-(--color-admin-border) bg-(--color-mist-blue)/70 px-3 py-2 text-xs text-(--color-ink-dim)">
          No se puede eliminar: esta mesa tiene familias asignadas.
        </p>
      ) : confirming ? (
        <form action={deleteAction} className="space-y-3">
          <input type="hidden" name="tableId" value={table.id} />
          <p className="text-sm text-(--color-ink)">¿Eliminar esta mesa?</p>
          <p className="text-xs text-(--color-ink-dim)">
            Esta acción no se puede deshacer desde esta pantalla.
          </p>
          {feedback?.status === "error" ? (
            <ErrorMessage message={feedback.error.message} />
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onCancel();
              }}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Cancelar
            </button>
            <DeleteButton />
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-xl border border-red-500/40 bg-red-50/60 px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-500"
          >
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

function GuestGroupList({ groups }: { groups: SeatingTableGuestGroup[] }) {
  return (
    <ul className="mt-4 grid gap-2">
      {groups.map((group) => (
        <li
          key={group.id}
          className="rounded-2xl border border-(--color-admin-border) bg-(--color-mist-blue)/70 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-(--color-ink)">{group.displayName}</p>
            <p className="mt-0.5 truncate text-xs text-(--color-ink-dim)">{group.slug}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-(--color-ink-dim) sm:mt-0 sm:justify-end">
            <span className="rounded-full border border-(--color-admin-border) bg-white/75 px-3 py-1">
              {group.seatLabel}
            </span>
            <span className={getRsvpChipClass(group.rsvpTone)}>{group.rsvpLabel}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyTablesState({ guestGroupCount }: { guestGroupCount: number }) {
  return (
    <section className="rounded-2xl border border-dashed border-(--color-admin-border) bg-white/60 px-5 py-8 text-center shadow-[0_14px_30px_rgba(36,48,68,0.05)] sm:px-6">
      <p className="text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
        Todavía no hay mesas creadas.
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-(--color-ink-dim)">
        Crea la primera mesa para empezar a organizar {guestGroupCount} familias activas.
      </p>
    </section>
  );
}

function FieldError({ message }: { message: string }) {
  return <span className="mt-1 block text-xs text-red-700">{message}</span>;
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-(--color-gold)/40 bg-(--color-pale-yellow-green)/35 px-3 py-2 text-sm text-(--color-ink)">
      {message}
    </p>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={ADMIN_PRIMARY_BUTTON_CLASS + " px-4"}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-red-500/50 bg-red-600/90 px-3 py-2 text-sm font-medium text-white transition hover:border-red-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Eliminando…" : "Eliminar"}
    </button>
  );
}

function getRsvpChipClass(tone: SeatingTableGuestGroup["rsvpTone"]): string {
  const base = "rounded-full border px-3 py-1";
  if (tone === "empty") {
    return `${base} border-(--color-admin-border) bg-(--color-mist-blue-deep)/80 text-(--color-admin-navy)`;
  }
  if (tone === "declined") {
    return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  }
  return `${base} border-(--color-dusty-teal)/35 bg-(--color-sage)/45 text-(--color-ink)`;
}
