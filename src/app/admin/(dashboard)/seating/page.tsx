import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminPageHeader from "@/app/admin/_components/AdminPageHeader";
import { confirmationStatusFor } from "@/lib/admin-confirmations-shared";
import {
  getAdminSeatingData,
  getGuestGroupRsvpLabel,
  getGuestGroupSeatLabel,
  getTableAssignmentsForTable,
  getUnassignedGuestGroups,
  type AdminSeatingGuestGroup,
} from "@/lib/admin-seating";
import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";

interface SeatingSummary {
  totalGroups: number;
  totalCapacity: number;
  assignedTableSeats: number;
  pendingSeats: number;
  totalConfirmedAttending: number;
}

export const metadata: Metadata = {
  title: "Mesas",
};

const ADMIN_SURFACE_CLASS =
  "rounded-[1.75rem] border border-(--color-admin-border) bg-white/50 p-3 shadow-[0_18px_40px_rgba(36,48,68,0.08)] sm:p-4";

const ADMIN_CARD_CLASS =
  "rounded-2xl border border-(--color-admin-border) bg-white p-4 shadow-[0_14px_30px_rgba(36,48,68,0.07)] sm:p-5";

const ADMIN_SOFT_CARD_CLASS =
  "rounded-2xl border border-(--color-admin-border) bg-white/60 p-3.5 sm:p-4";

const STATUS_CHIP_CLASS =
  "inline-flex shrink-0 rounded-full border border-(--color-admin-border) bg-white/70 px-2.5 py-1 text-xs font-medium text-(--color-ink-dim)";

export default async function AdminSeatingPage() {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const { eventTables, tableAssignments, guestGroups } =
    await getAdminSeatingData();
  const unassignedGuestGroups = getUnassignedGuestGroups(
    guestGroups,
    tableAssignments
  );
  const summary = computeSeatingSummary(
    guestGroups,
    eventTables,
    tableAssignments
  );
  const pendingGuestGroupCount = unassignedGuestGroups.length;

  return (
    <section className="space-y-6">
      <AdminPageHeader title="Mesas" eyebrow="organización del salón" />

      <div className={ADMIN_SURFACE_CLASS}>
        <HeroSummaryCard
          label="Mesas disponibles"
          value={eventTables.length}
          helper="para organizar el salón"
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard
            label="Capacidad total"
            value={summary.totalCapacity}
          />
          <SummaryCard
            label="Lugares en mesa"
            value={summary.assignedTableSeats}
          />
          <SummaryCard
            label="Familias pendientes"
            value={pendingGuestGroupCount}
          />
          <SummaryCard
            label="Lugares pendientes"
            value={summary.pendingSeats}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ContextCard label="Invitaciones activas" value={summary.totalGroups} />
          <ContextCard
            label="Invitados confirmados"
            value={summary.totalConfirmedAttending}
          />
        </div>
      </div>

      {eventTables.length === 0 ? (
        <EmptyTablesState guestGroupCount={guestGroups.length} />
      ) : (
        <div className="grid gap-3">
          {eventTables.map((table) => {
            const assignedGroups = getTableAssignmentsForTable(
              table,
              tableAssignments,
              guestGroups
            );
            const assignedSeats = assignedGroups.reduce(
              (sum, group) => sum + (group.assignedSeats ?? 0),
              0
            );
            const capacityLabel = `${assignedSeats} de ${table.capacity} lugares`;
            const occupancyPercent =
              table.capacity > 0
                ? Math.min(100, Math.round((assignedSeats / table.capacity) * 100))
                : 0;

            return (
              <article
                key={table.id}
                className={ADMIN_CARD_CLASS}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
                      {table.label}
                    </h2>
                    <p className="mt-0.5 text-sm text-(--color-ink-dim)">
                      {capacityLabel}
                    </p>
                  </div>
                  <span className={STATUS_CHIP_CLASS}>Solo lectura</span>
                </div>

                <div className="mt-4" aria-label={capacityLabel}>
                  <div className="h-2 overflow-hidden rounded-full bg-(--color-mist-blue-deep)">
                    <div
                      className="h-full rounded-full bg-(--color-admin-navy)"
                      style={{ width: `${occupancyPercent}%` }}
                    />
                  </div>
                </div>

                {assignedGroups.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-4 py-5 text-sm text-(--color-ink-dim)">
                    Esta mesa todavía no tiene familias asignadas.
                  </p>
                ) : (
                  <GuestGroupList groups={assignedGroups} className="mt-4" />
                )}
              </article>
            );
          })}
        </div>
      )}

      <section className={ADMIN_CARD_CLASS}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
              Familias pendientes de acomodar
            </h2>
            <p className="mt-0.5 text-sm leading-6 text-(--color-ink-dim)">
              Para revisar rápido quién todavía no tiene mesa.
            </p>
          </div>
          <span className={STATUS_CHIP_CLASS}>
            {pendingGuestGroupCount} familias
          </span>
        </div>

        {unassignedGuestGroups.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-(--color-dusty-teal)/35 bg-(--color-sage)/35 px-4 py-5 text-sm text-(--color-ink)">
            Todas las familias activas ya tienen mesa asignada.
          </p>
        ) : (
          <GuestGroupList groups={unassignedGuestGroups} className="mt-4" />
        )}
      </section>
    </section>
  );
}

function computeSeatingSummary(
  groups: AdminSeatingGuestGroup[],
  eventTables: { capacity: number }[],
  tableAssignments: { guestGroupId: string }[]
): SeatingSummary {
  const totalCapacity = eventTables.reduce(
    (sum, table) => sum + table.capacity,
    0
  );
  const assignedTableGroupIds = new Set(
    tableAssignments.map((assignment) => assignment.guestGroupId)
  );
  let assignedTableSeats = 0;
  let pendingSeats = 0;
  let totalConfirmedAttending = 0;

  for (const group of groups) {
    const status = confirmationStatusFor(group);
    const seats = group.assignedSeats ?? 0;

    if (group.id && assignedTableGroupIds.has(group.id)) {
      assignedTableSeats += seats;
    } else {
      pendingSeats += seats;
    }

    if (status === "confirmado") {
      totalConfirmedAttending += group.rsvp?.attendingCount ?? 0;
    }
  }

  return {
    totalGroups: groups.length,
    totalCapacity,
    assignedTableSeats,
    pendingSeats,
    totalConfirmedAttending,
  };
}

function HeroSummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-(--color-admin-border) bg-white px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-(--color-ink-dim)">{label}</p>
          <p className="mt-2 text-5xl font-semibold tracking-[-0.055em] text-(--color-ink) sm:text-6xl">
            {value}
          </p>
        </div>
        <p className="max-w-[8rem] pb-1 text-right text-xs leading-snug text-(--color-ink-soft)">
          {helper}
        </p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={ADMIN_SOFT_CARD_CLASS}>
      <p className="text-xs font-medium leading-snug text-(--color-ink-dim)">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-(--color-ink)">{value}</p>
    </div>
  );
}

function ContextCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-(--color-admin-border) bg-white/35 px-3.5 py-3 sm:px-4">
      <p className="text-xs font-medium leading-snug text-(--color-ink-soft)">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-(--color-ink)">
        {value}
      </p>
    </div>
  );
}

function EmptyTablesState({ guestGroupCount }: { guestGroupCount: number }) {
  return (
    <section className="rounded-2xl border border-dashed border-(--color-admin-border) bg-white/60 px-5 py-8 text-center shadow-[0_14px_30px_rgba(36,48,68,0.05)] sm:px-6">
      <p className="text-lg font-semibold tracking-[-0.02em] text-(--color-ink)">
        Todavía no hay mesas creadas.
      </p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-(--color-ink-dim)">
        Cuando se carguen mesas y familias, aquí vas a ver el acomodo por mesa.
        Por ahora puedes revisar {guestGroupCount} familias activas abajo, sin
        modificar datos.
      </p>
    </section>
  );
}

function GuestGroupList({
  groups,
  className,
}: {
  groups: AdminSeatingGuestGroup[];
  className?: string;
}) {
  return (
    <ul
      className={[
        "grid gap-2",
        className ?? "",
      ].join(" ")}
    >
      {groups.map((group) => (
        <li
          key={group.id ?? group.slug}
          className="rounded-2xl border border-(--color-admin-border) bg-(--color-mist-blue)/70 p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-(--color-ink)">
              {group.displayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-(--color-ink-dim)">
              {group.slug}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium text-(--color-ink-dim) sm:mt-0 sm:justify-end">
            <span className="rounded-full border border-(--color-admin-border) bg-white/75 px-3 py-1">
              {getGuestGroupSeatLabel(group)}
            </span>
            <span className={getRsvpChipClass(group)}>
              {getGuestGroupRsvpLabel(group)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function getRsvpChipClass(group: AdminSeatingGuestGroup): string {
  const base = "rounded-full border px-3 py-1";

  if (!group.rsvp) {
    return `${base} border-(--color-admin-border) bg-(--color-mist-blue-deep)/80 text-(--color-admin-navy)`;
  }

  if (group.rsvp.attendingCount === 0) {
    return `${base} border-rose-200 bg-rose-50 text-rose-700`;
  }

  return `${base} border-(--color-dusty-teal)/35 bg-(--color-sage)/45 text-(--color-ink)`;
}
