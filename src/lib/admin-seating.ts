/**
 * Admin seating read-only data boundary.
 *
 * This module powers `/admin/seating`: it reads the seating foundation tables
 * when Supabase is configured, but exposes no write surface. Mock mode mirrors
 * the current production state for the first slice: no event tables and no
 * assignments, while still showing the in-repo guest groups for planning.
 */

import { cache } from "react";

import {
  GUEST_GROUPS,
  isSupabaseConfigured,
  type GuestGroup,
} from "@/lib/guest-groups";
import type { Rsvp } from "@/lib/rsvps-shared";

export interface EventTable {
  id: string;
  eventId: string;
  label: string;
  capacity: number;
  displayOrder: number;
}

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
