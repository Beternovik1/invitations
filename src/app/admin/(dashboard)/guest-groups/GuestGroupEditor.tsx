"use client";

import { useActionState, useId, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateGuestGroupAction } from "@/app/admin/(dashboard)/guest-groups/actions";
import {
  INITIAL_GUEST_GROUP_FORM_STATE,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_SEATS_NOTE_LENGTH,
  type GuestGroupFormState,
} from "@/lib/admin-guest-groups-shared";
import type { GuestGroup } from "@/lib/guest-groups";

/**
 * Focused, mobile-first guest-group editor.
 *
 * Mom is on a phone with 51 groups, so rendering 51 editable cards at once is
 * hostile. Instead, this component shows a summary, a search box, and a
 * tappable list of groups. Selecting one group reveals a single editor form
 * below the list. Only that form posts to the shared Server Action — the same
 * `slug`-keyed `useActionState` feedback fan-out still works.
 *
 * Backend, Server Action, and data boundaries are unchanged: this is purely a
 * client-UX refactor. Slugs remain read-only and there is no create/delete
 * flow.
 */
export default function GuestGroupEditor({ groups }: { groups: GuestGroup[] }) {
  const [state, formAction] = useActionState(
    updateGuestGroupAction,
    INITIAL_GUEST_GROUP_FORM_STATE
  );

  const defaultSlug = pickDefaultSlug(groups);
  const [selectedSlug, setSelectedSlug] = useState<string>(defaultSlug);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length === 0) return groups;
    return groups.filter(
      (group) =>
        group.displayName.toLowerCase().includes(trimmed) ||
        group.slug.toLowerCase().includes(trimmed)
    );
  }, [groups, query]);

  const selectedGroup =
    groups.find((group) => group.slug === selectedSlug) ?? null;

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-5 py-8 text-(--color-ink-dim)">
        No guest groups found.
      </p>
    );
  }

  const activeCount = groups.filter((group) => group.isActive !== false).length;
  const inactiveCount = groups.length - activeCount;
  const pendingCount = groups.filter((group) => group.assignedSeats == null).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <SummaryPill label="Total" value={groups.length} />
        <SummaryPill label="Active" value={activeCount} />
        <SummaryPill label="Pending seats" value={pendingCount} />
      </div>

      {inactiveCount > 0 ? (
        <p className="rounded-2xl border border-(--color-gold)/30 bg-(--color-pale-yellow-green)/25 px-4 py-3 text-sm text-(--color-ink-dim)">
          {inactiveCount} inactive group{inactiveCount === 1 ? "" : "s"} are
          still listed so you can re-enable them later.
        </p>
      ) : null}

      <SearchInput value={query} onChange={setQuery} />

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-(--color-glass-border) bg-(--color-glass) px-4 py-5 text-sm text-(--color-ink-dim)">
          No groups match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filtered.map((group) => (
            <li key={group.slug}>
              <GroupPickerButton
                group={group}
                isSelected={group.slug === selectedSlug}
                onSelect={() => setSelectedSlug(group.slug)}
              />
            </li>
          ))}
        </ul>
      )}

      {selectedGroup ? (
        <GuestGroupForm
          key={`${selectedGroup.slug}:${state.status === "success" ? state.slug : ""}`}
          group={selectedGroup}
          formAction={formAction}
          state={state}
        />
      ) : null}
    </div>
  );
}

/**
 * Default selection rule: the first group with pending seats if any, otherwise
 * the first group in the list. This puts the most actionable row (still needs
 * a count) under mom's thumb without any extra taps.
 */
function pickDefaultSlug(groups: GuestGroup[]): string {
  if (groups.length === 0) return "";
  const firstPending = groups.find((group) => group.assignedSeats == null);
  return (firstPending ?? groups[0]).slug;
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="leaf-panel rounded-2xl p-4">
      <p className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-(--color-ink)">{value}</p>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const inputId = useId();
  return (
    <label htmlFor={inputId} className="block">
      <span className="sr-only">Search guest groups</span>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name or slug"
        autoComplete="off"
        className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-4 py-2.5 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
      />
    </label>
  );
}

function GroupPickerButton({
  group,
  isSelected,
  onSelect,
}: {
  group: GuestGroup;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isActive = group.isActive !== false;
  const isPending = group.assignedSeats == null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
        isSelected
          ? "border-(--color-dusty-teal)/60 bg-(--color-sage)/35"
          : "border-(--color-glass-border) bg-(--color-glass) hover:border-(--color-gold)/50"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate font-serif text-base text-(--color-ink)">
          {group.displayName}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-(--color-ink-dim)">
          {group.slug}
          {isPending ? " · pending seats" : ` · ${group.assignedSeats} seats`}
        </span>
      </span>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.12em] ${
          isActive
            ? "border-(--color-dusty-teal)/40 bg-(--color-sage)/40 text-(--color-ink)"
            : "border-(--color-glass-border) bg-(--color-glass) text-(--color-ink-dim)"
        }`}
      >
        {isActive ? "Active" : "Inactive"}
      </span>
    </button>
  );
}

function GuestGroupForm({
  group,
  formAction,
  state,
}: {
  group: GuestGroup;
  formAction: (payload: FormData) => void;
  state: GuestGroupFormState;
}) {
  const isActive = group.isActive !== false;
  const feedback = state.slug === group.slug ? state : null;
  const hasError = feedback?.status === "error";
  const fieldErrors = hasError ? feedback.error.fields : undefined;

  return (
    <form action={formAction} className="leaf-panel rounded-2xl p-5">
      <input type="hidden" name="slug" value={group.slug} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[0.7rem] text-(--color-ink-dim)">
            {group.slug}
          </p>
          <h2 className="mt-1 truncate font-serif text-xl text-(--color-ink)">
            {group.displayName}
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
            isActive
              ? "border-(--color-dusty-teal)/40 bg-(--color-sage)/40 text-(--color-ink)"
              : "border-(--color-glass-border) bg-(--color-glass) text-(--color-ink-dim)"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-5 grid gap-4">
        <Field label="Slug" hint="Read-only">
          <input
            value={group.slug}
            readOnly
            aria-readonly="true"
            className="w-full rounded-xl border border-(--color-glass-border) bg-(--color-glass) px-3 py-2 font-mono text-sm text-(--color-ink-dim) outline-none"
          />
        </Field>

        <Field label="Display name" error={fieldErrors?.displayName}>
          <input
            name="displayName"
            defaultValue={group.displayName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            required
            className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Assigned seats" error={fieldErrors?.assignedSeats}>
            <input
              name="assignedSeats"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              defaultValue={group.assignedSeats ?? ""}
              placeholder="Pending"
              className="w-full rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
            />
          </Field>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-(--color-glass-border) bg-white/40 px-3 py-2 text-sm text-(--color-ink)">
            <span>
              <span className="block text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
                Invitation link
              </span>
              <span className="text-(--color-ink-dim)">Inactive groups 404</span>
            </span>
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={isActive}
              className="h-5 w-5 accent-(--color-dusty-teal)"
            />
          </label>
        </div>

        <Field label="Seats note" error={fieldErrors?.seatsNote}>
          <textarea
            name="seatsNote"
            defaultValue={group.seatsNote ?? ""}
            maxLength={MAX_SEATS_NOTE_LENGTH}
            rows={2}
            placeholder="Por confirmar"
            className="w-full resize-y rounded-xl border border-(--color-glass-border) bg-white/60 px-3 py-2 text-sm text-(--color-ink) outline-none transition focus:border-(--color-gold)/60"
          />
        </Field>
      </div>

      {feedback?.status === "success" ? (
        <p className="mt-4 rounded-xl border border-(--color-dusty-teal)/35 bg-(--color-sage)/35 px-3 py-2 text-sm text-(--color-ink)">
          Saved.
        </p>
      ) : null}

      {hasError ? (
        <p className="mt-4 rounded-xl border border-(--color-gold)/40 bg-(--color-pale-yellow-green)/35 px-3 py-2 text-sm text-(--color-ink)">
          {feedback.error.message}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-gold-soft)">
          {label}
        </span>
        {hint ? (
          <span className="text-[0.65rem] uppercase tracking-[0.16em] text-(--color-ink-soft)">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-(--color-gold)/45 bg-(--color-glass) px-4 py-2 text-xs uppercase tracking-[0.16em] text-(--color-ink) transition hover:border-(--color-gold) disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}