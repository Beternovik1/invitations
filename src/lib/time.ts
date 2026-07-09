/**
 * Time helpers for the invitation countdown.
 *
 * All math works against an absolute UTC epoch instant (see EVENT.startISO in
 * constants.ts), so the result is correct for a visitor in any time zone and
 * does not depend on parsing a local-time string.
 */

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True when the target instant has already passed. */
  isPast: boolean;
}

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Compute the calendar-style breakdown of the time remaining until `targetISO`.
 *
 * @param targetISO Absolute UTC ISO timestamp of the target instant.
 * @param now       Epoch millis to count from (defaults to `Date.now()`); taken
 *                  as a parameter so the function is deterministic in tests.
 */
export function getCountdown(
  targetISO: string,
  now: number = Date.now(),
): CountdownParts {
  const target = Date.parse(targetISO);
  if (!Number.isFinite(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const remaining = target - now;
  if (remaining <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  return {
    days: Math.floor(remaining / MS_PER_DAY),
    hours: Math.floor((remaining % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((remaining % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((remaining % MS_PER_MINUTE) / MS_PER_SECOND),
    isPast: false,
  };
}

/** Zero-pad a number to at least two digits for the countdown readout. */
export function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}