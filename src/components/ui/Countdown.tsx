"use client";

import { useSyncExternalStore } from "react";

import { EVENT } from "@/lib/constants";
import { getCountdown, pad2, type CountdownParts } from "@/lib/time";

const UNITS: ReadonlyArray<{
  key: keyof Omit<CountdownParts, "isPast">;
  label: string;
}> = [
  { key: "days", label: "Días" },
  { key: "hours", label: "Horas" },
  { key: "minutes", label: "Min" },
  { key: "seconds", label: "Seg" },
];

// Module-level clock store (shared across mounted Countdown instances).
type Listener = () => void;
const listeners = new Set<Listener>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function tickAll(): void {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  if (intervalId === null && typeof window !== "undefined") {
    intervalId = setInterval(tickAll, 1000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}

// Server snapshot is a fixed placeholder so hydration matches the server
// render; React then re-renders with the live snapshot client-side.
const SERVER_SNAPSHOT = "--";
let lastSnapshot = SERVER_SNAPSHOT;

function getSnapshot(): string {
  const parts = getCountdown(EVENT.startISO);
  const next =
    parts.isPast
      ? "done"
      : `${parts.days}:${pad2(parts.hours)}:${pad2(parts.minutes)}:${pad2(parts.seconds)}`;
  if (next !== lastSnapshot) lastSnapshot = next;
  return lastSnapshot;
}

function getServerSnapshot(): string {
  return SERVER_SNAPSHOT;
}

function parseSnapshot(snapshot: string): CountdownParts | null {
  if (snapshot === SERVER_SNAPSHOT) return null;
  if (snapshot === "done") {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }
  const [d, h, m, s] = snapshot.split(":");
  return {
    days: Number(d),
    hours: Number(h),
    minutes: Number(m),
    seconds: Number(s),
    isPast: false,
  };
}

/**
 * Frosted-glass countdown to EVENT.startISO.
 *
 * Uses `useSyncExternalStore` so the ticking clock is treated as an external
 * store (the canonical React 19 pattern), which is hydration-safe and avoids
 * the "setState in effect" anti-pattern: the server renders a placeholder and
 * the live values populate only after client hydration.
 */
export default function Countdown() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const parts = parseSnapshot(snapshot);

  return (
    <div
      className="mx-auto flex w-full max-w-md items-stretch justify-center gap-2 sm:gap-3"
      role="timer"
      aria-live="polite"
      aria-label="Cuenta regresiva de la celebración"
    >
      {UNITS.map(({ key, label }) => {
        const value = parts ? (key === "days" ? String(parts[key]).padStart(2, "0") : pad2(parts[key])) : "--";
        return (
          <div
            key={key}
            className="glass-card flex flex-1 flex-col items-center justify-center rounded-xl px-1 py-3 sm:rounded-2xl sm:py-4"
          >
            <span
              className="font-sans font-medium tabular-nums text-[var(--color-ink)] text-clamp-count"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {value}
            </span>
            <span className="mt-1 text-[0.55rem] uppercase tracking-[0.2em] text-[var(--color-ink-dim)] sm:text-[0.65rem]">
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
