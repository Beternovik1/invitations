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
import SeatingTableManager, {
  type SeatingAssignmentGuestGroup,
  type SeatingTableOption,
  type SeatingTableRow,
} from "@/app/admin/(dashboard)/seating/SeatingTableManager";

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

const ADMIN_SOFT_CARD_CLASS =
  "rounded-2xl border border-(--color-admin-border) bg-white/60 p-3.5 sm:p-4";

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

      <SeatingTableManager
        tables={buildSeatingTableRows(eventTables, tableAssignments, guestGroups)}
        tableOptions={buildSeatingTableOptions(eventTables, tableAssignments, guestGroups)}
        pendingGroups={unassignedGuestGroups.map(buildSeatingAssignmentGuestGroup)}
        guestGroupCount={guestGroups.length}
        pendingGuestGroupCount={pendingGuestGroupCount}
      />
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

function buildSeatingTableRows(
  eventTables: {
    id: string;
    label: string;
    capacity: number;
    displayOrder: number;
    eventId: string;
  }[],
  tableAssignments: { eventId: string; guestGroupId: string; tableId: string }[],
  guestGroups: AdminSeatingGuestGroup[]
): SeatingTableRow[] {
  return eventTables.map((table) => {
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

    return {
      id: table.id,
      label: table.label,
      capacity: table.capacity,
      displayOrder: table.displayOrder,
      assignedSeats,
      capacityLabel,
      occupancyPercent,
      assignedGroups: assignedGroups.map(buildSeatingAssignmentGuestGroup),
    };
  });
}

function buildSeatingTableOptions(
  eventTables: {
    id: string;
    label: string;
    capacity: number;
    displayOrder: number;
    eventId: string;
  }[],
  tableAssignments: { eventId: string; guestGroupId: string; tableId: string }[],
  guestGroups: AdminSeatingGuestGroup[]
): SeatingTableOption[] {
  return eventTables.map((table) => {
    const assignedGroups = getTableAssignmentsForTable(
      table,
      tableAssignments,
      guestGroups
    );
    const assignedSeats = assignedGroups.reduce(
      (sum, group) => sum + (group.assignedSeats ?? 0),
      0
    );

    return {
      id: table.id,
      label: table.label,
      capacity: table.capacity,
      assignedSeats,
      capacityLabel: `${assignedSeats} de ${table.capacity} lugares`,
    };
  });
}

function buildSeatingAssignmentGuestGroup(
  group: AdminSeatingGuestGroup
): SeatingAssignmentGuestGroup {
  return {
    id: group.id ?? group.slug,
    displayName: group.displayName,
    slug: group.slug,
    assignedSeats: group.assignedSeats,
    seatLabel: getGuestGroupSeatLabel(group),
    rsvpLabel: getGuestGroupRsvpLabel(group),
    rsvpTone: getGuestGroupRsvpTone(group),
  };
}

function getGuestGroupRsvpTone(
  group: AdminSeatingGuestGroup
): "empty" | "declined" | "confirmed" {
  if (!group.rsvp) return "empty";
  if (group.rsvp.attendingCount === 0) return "declined";
  return "confirmed";
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
