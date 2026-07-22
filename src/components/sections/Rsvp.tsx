"use client";

import { useActionState, useId, useRef, useState } from "react";

import { submitRsvpAction } from "@/app/i/[slug]/actions";
import { type RsvpFormState } from "@/lib/rsvps-shared";
import type { GuestGroup } from "@/lib/guest-groups";

/* Self-hosted font variables — both are mounted in `app/layout.tsx`
   (edwardianscriptitc.ttf -> --font-edwardian-script; Baskervville
   VariableFont_wght -> --font-baskervville). Matches the type split used by
   the "Dónde y Cuándo" / "Itinerario" sections so the page reads as one piece. */
const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

/* Card palette — copied verbatim from `Locations.tsx` ("Dónde y Cuándo") so the
   RSVP card reads as a sibling of the location cards: thin gold frame, dusty
   blue content panel, navy button with ivory text. Square corners — no
   border-radius — per the brief. */
const IVORY = "#F5F3EE";
const PANEL = "#E6ECF2";
const GOLD = "#C7A96A";
const INK = "#1A1A1A";
const NIGHT = "#2E3E50";
const STEPPER_TAP_GUARD_MS = 160;

interface RsvpSectionProps {
  /** The guest group this confirmation is addressed to. */
  group: GuestGroup;
  /** Existing RSVP prefetched on the server, or `null` if none yet. */
  initialRsvp: {
    guestGroupSlug: string;
    attendingCount: number;
    message: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  /** Whether Supabase is configured. When false, the form is replaced by a
   *  local notice so the build never pretends persistence works. */
  rsvpEnabled: boolean;
}

/**
 * RSVP confirmation section for the personalized invitation.
 *
 * Rendered only on `/i/[slug]`, slotted into `<InvitationContent>` after the
 * `Itinerario` section (preserving the committed section order). Submission
 * goes through the `submitRsvpAction` Server Action via `useActionState`, so
 * the service-role key and Supabase access stay on the server.
 *
 * Design: a single centered card framed by a hairline gold border on the same
 * mist-blue background as "Dónde y Cuándo". The title `Invitacion para:` is set
 * in Edwardian Script — the exact face used by the `Itinerario` title. The
 * family/group name (`group.displayName`) and all body content are set in
 * Baskervville — the exact face used in the location card body. The card offers
 * two distinct actions:
 *
 *   1. A direct `Confirmar` button that submits a hidden form with
 *      `attendingCount = group.assignedSeats` (and an empty message) through
 *      the same `formAction`. One tap confirms the full reserved count.
 *   2. A `Modificar` button (`type="button"`) that reveals a second form to
 *      change the number of assistants (0..assignedSeats) via a circular +/−
 *      stepper. The current count is submitted as a hidden `attendingCount`
 *      field through the SAME `formAction`; the display itself is not
 *      directly editable. No free-text message control is offered.
 *
 * States:
 *   - Seats pending (`assignedSeats` null): the host has not set the count
 *     yet. Show a clear Spanish message and no working confirm buttons.
 *   - Supabase not configured (`rsvpEnabled` false): show a local notice and
 *     no working form — never pretend a mock write succeeded.
 *   - Otherwise: the interactive card described above, prefilled from
 *     `initialRsvp` when one exists (treated as an update).
 */
export default function RsvpSection({
  group,
  initialRsvp,
  rsvpEnabled,
}: RsvpSectionProps) {
  const seatsPending = group.assignedSeats == null;
  const seats = group.assignedSeats ?? 0;
  // The whole section is read-only when seats are pending OR Supabase is off.
  const readonly = seatsPending || !rsvpEnabled;

  // Bind the server action to this group's slug. `useActionState` then calls it
  // as (prevState, formData). The binding keeps the slug on the server; only
  // the action reference reaches the client. The SAME action reference is
  // reused by both the direct-confirm form and the modify form so they share
  // one state slot.
  const boundAction = rsvpEnabled ? submitRsvpAction.bind(null, group.slug) : null;

  const initialState: RsvpFormState = { status: "idle", rsvp: initialRsvp };
  // `useActionState` requires an action; when readonly we pass a no-op sentinel
  // so the hook signature stays stable (no form is rendered in that mode, so
  // the sentinel never runs).
  const [state, formAction, pending] = useActionState<RsvpFormState, FormData>(
    boundAction ?? noopAction,
    initialState,
  );

  const confirmed = state.rsvp ?? initialRsvp;
  const lastError = state.status === "error" ? state.error : null;

  // Local UI state for the modify form reveal. Default hidden: the primary
  // path is the one-tap direct confirm; modifying is the opted-in branch.
  const [showModify, setShowModify] = useState(false);

  // Stepper count for the modify form. Initialized lazily from any existing
  // RSVP (`confirmed.attendingCount`) and clamped to `0..seats`; falls back
  // to the full reserved seat count when there is no confirmation yet. The
  // value rides to the server as a hidden `attendingCount` field; the
  // visible number is read-only.
  //
  // `useState`'s lazy initializer runs ONLY on mount. When the guest opens
  // `Modificar`, we reset the stepper from the latest confirmed RSVP right in
  // that button handler. After the form is open, +/- clicks are purely local
  // until the guest submits. Do NOT resync during render: delayed Server Action
  // state can otherwise fight fast +/- clicks and make the number jump.
  const [count, setCount] = useState<number>(() =>
    computeInitialCount(confirmed?.attendingCount, seats),
  );
  const countRef = useRef(count);
  const countInputRef = useRef<HTMLInputElement | null>(null);
  const lastStepperTapAt = useRef(0);

  const setSyncedCount = (nextCount: number) => {
    countRef.current = nextCount;
    if (countInputRef.current) {
      countInputRef.current.value = String(nextCount);
    }
    setCount(nextCount);
  };

  const toggleModify = () => {
    setShowModify((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        setSyncedCount(computeInitialCount(confirmed?.attendingCount, seats));
      }
      return nextOpen;
    });
  };

  const syncCountBeforeSubmit = () => {
    if (countInputRef.current) {
      countInputRef.current.value = String(countRef.current);
    }
  };

  const updateCount = (direction: -1 | 1) => {
    const now = Date.now();
    if (now - lastStepperTapAt.current < STEPPER_TAP_GUARD_MS) {
      return;
    }
    lastStepperTapAt.current = now;

    const nextCount = Math.min(
      seats,
      Math.max(0, countRef.current + direction),
    );
    setSyncedCount(nextCount);
  };

  const fieldsetId = useId();
  const modifyId = `${fieldsetId}-modify`;
  const countLabelId = `${fieldsetId}-count-label`;
  const countHintId = `${fieldsetId}-count-hint`;
  const countErrorId = `${fieldsetId}-count-error`;
  const seatsWord = seats === 1 ? "lugar" : "lugares";

  return (
    <section
      id="rsvp"
      className="w-full px-6 py-16 sm:py-20"
      style={{ backgroundColor: "var(--color-mist-blue)" }}
    >
      {/* Section title — Edwardian Script, the exact face used by the
          `Itinerario` title. Same clamp scale so chapter headings match. */}
      <h2
        className="mx-auto mb-10 text-center text-[clamp(3.25rem,6vw,3.75rem)] leading-none"
        style={{ ...EDWARDIAN, color: INK }}
      >
        Invitacion para:
      </h2>

      {/* Card: thin 1px gold frame, square corners, dusty-blue content panel —
          a sibling of the location cards. */}
      <div
        className="mx-auto w-full max-w-xl border"
        style={{ borderColor: GOLD }}
      >
        <div
          className="flex flex-col items-center px-6 py-10 text-center sm:px-10"
          style={{ backgroundColor: PANEL }}
        >
          {/* Group / family name — Baskervville, the exact face used in the
              location card body. The single most legible line on the card. */}
          <p
            className="text-[2rem] leading-snug"
            style={{ ...BASKERVVILLE, color: NIGHT }}
          >
            {group.displayName}
          </p>

          {/* Seat context line: Tienes x lugares reservados para ti.
              Singular handled gracefully. Bold number per brief. */}
          {!seatsPending && (
            <p
              className="mt-3 text-[1.1rem] leading-relaxed"
              style={{ ...BASKERVVILLE, color: NIGHT }}
            >
              Tienes{" "}
              <strong className="font-bold">{seats}</strong>{" "}
              {seats === 1 ? "lugar reservado" : "lugares reservados"} para ti.
            </p>
          )}

          {/* Pending-seat notice: RSVP is not available yet, but not forgotten. */}
          {seatsPending && (
            <p
              className="mt-4 max-w-md text-[1rem] italic leading-relaxed"
              style={{ ...BASKERVVILLE, color: NIGHT }}
              role="status"
            >
              {group.seatsNote ?? "Por confirmar"}
              <br />
              Aún estamos confirmando el número de lugares para tu grupo. Te
              avisaremos en cuanto puedas confirmar tu asistencia.
            </p>
          )}

          {/* No-backend notice: local / zero-config builds stay honest. */}
          {!rsvpEnabled && (
            <p
              className="mt-4 max-w-md text-[1rem] italic leading-relaxed"
              style={{ ...BASKERVVILLE, color: NIGHT }}
              role="status"
            >
              La confirmación de asistencia no está disponible en este entorno.
            </p>
          )}

          {/* Current confirmation banner (prefill / success feedback). Shown
              whenever a saved RSVP exists, including after a successful update. */}
          {!readonly && confirmed && (
            <p
              className="mt-4 max-w-md text-[1rem] leading-relaxed"
              style={{ ...BASKERVVILLE, color: NIGHT }}
              role="status"
            >
              {state.status === "success" && (
                <strong>¡Gracias! </strong>
              )}
              Confirmaste {confirmed.attendingCount} de {seats} {seatsWord}.
              Puedes actualizar tu respuesta cuando quieras.
            </p>
          )}

          {/* Error feedback. Field-level hints inline below each control. */}
          {lastError && (
            <p
              className="mt-4 max-w-md border px-4 py-3 text-[0.95rem] leading-relaxed"
              style={{ ...BASKERVVILLE, color: NIGHT, borderColor: GOLD }}
              role="alert"
            >
              {lastError.message}
            </p>
          )}

          {/* Action row: direct confirm (solid navy) + modify (outline). Only
              rendered when the section is interactive (seats known + backend
              on). The direct confirm is its own tiny form with hidden fields so
              the existing Server Action receives the full seat count without
              any client-side onClick call. */}
          {!readonly && !seatsPending && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <form action={formAction}>
                <input type="hidden" name="attendingCount" value={seats} />
                <input type="hidden" name="message" value="" />
                <button
                  type="submit"
                  disabled={pending}
                  aria-label={`Confirmar mis ${seats} ${seatsWord} reservados`}
                  className="inline-block cursor-pointer rounded-xl px-10 py-3.5 text-[0.85rem] uppercase tracking-[0.25em] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E6ECF2] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ ...BASKERVVILLE, backgroundColor: NIGHT, color: IVORY }}
                >
                  {pending ? "Guardando…" : "Confirmar"}
                </button>
              </form>

              <button
                type="button"
                onClick={toggleModify}
                aria-expanded={showModify}
                aria-controls={modifyId}
                disabled={pending}
                className="inline-block cursor-pointer rounded-xl border px-10 py-3.5 text-[0.85rem] uppercase tracking-[0.25em] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E6ECF2] disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  ...BASKERVVILLE,
                  borderColor: GOLD,
                  color: NIGHT,
                  backgroundColor: "transparent",
                }}
              >
                {showModify ? "Cerrar" : "Modificar"}
              </button>
            </div>
          )}

          {/* Modify form: revealed by the `Modificar` button. Lets the guest
              change `attendingCount` from 0..assigned seats through the SAME
              Server Action via a circular +/− stepper. The number is not
              directly editable; its current value is carried to the server as a
              hidden `attendingCount` field. Server-side field errors on
              `attendingCount` are connected to the stepper group via
              aria-describedby (and auto-announced by the role="alert" span). */}
          {!readonly && !seatsPending && showModify && (
            <form
              id={modifyId}
              action={formAction}
              onSubmit={syncCountBeforeSubmit}
              className="mt-8 w-full max-w-md"
            >
              <fieldset
                disabled={pending}
                className="flex flex-col gap-5"
              >
                <legend className="sr-only">Modifica tu confirmación</legend>

                <div
                  role="group"
                  aria-labelledby={countLabelId}
                  aria-describedby={
                    lastError?.fields?.attendingCount
                      ? countErrorId
                      : countHintId
                  }
                  className="flex flex-col items-center gap-3"
                >
                  <span
                    id={countLabelId}
                    className="text-[0.8rem] uppercase tracking-[0.2em]"
                    style={{ ...BASKERVVILLE, color: NIGHT }}
                  >
                    Asistentes
                  </span>

                  {/* Stepper buttons operate the count; the group is connected to the
                      server-side field error via aria-describedby (role="group"
                      supports it) and the error span carries role="alert" so
                      the rejection auto-announces. `aria-invalid` isn't hosted
                      here — neither `group` nor `button` allows it under this
                      project's jsx-a11y config, so per the spec ("if
                      appropriate") it is dropped. */}
                  <div className="flex items-center justify-center gap-6">
                    <button
                      type="button"
                      aria-label="Quitar un asistente"
                      onClick={() => updateCount(-1)}
                      disabled={count <= 0}
                      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl text-[1.5rem] leading-none transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E6ECF2] disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ ...BASKERVVILLE, backgroundColor: NIGHT, color: IVORY }}
                    >
                      −
                    </button>

                    <output
                      aria-live="polite"
                      className="min-w-[3rem] text-center text-[2rem] leading-none"
                      style={{ ...BASKERVVILLE, color: NIGHT }}
                    >
                      {count}
                    </output>

                    <button
                      type="button"
                      aria-label="Agregar un asistente"
                      onClick={() => updateCount(1)}
                      disabled={count >= seats}
                      className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl text-[1.5rem] leading-none transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E6ECF2] disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ ...BASKERVVILLE, backgroundColor: NIGHT, color: IVORY }}
                    >
                      +
                    </button>
                  </div>

                  <span
                    id={countHintId}
                    className="text-[0.8rem]"
                    style={{ ...BASKERVVILLE, color: NIGHT }}
                  >
                    De 0 a {seats} {seatsWord}.
                  </span>
                  {lastError?.fields?.attendingCount && (
                    <span
                      id={countErrorId}
                      className="text-[0.8rem]"
                      style={{ ...BASKERVVILLE, color: NIGHT }}
                      role="alert"
                    >
                      {lastError.fields.attendingCount}
                    </span>
                  )}
                </div>

                {/* The stepper value is submitted as a hidden field so the
                    existing Server Action keeps reading `attendingCount` from
                    the FormData as before. `message` is pinned empty to match
                    the direct-confirm form — there is no message UI anymore. */}
                <input
                  ref={countInputRef}
                  type="hidden"
                  name="attendingCount"
                  value={count}
                />
                <input type="hidden" name="message" value="" />

                <button
                  type="submit"
                  disabled={pending}
                  className="mt-2 inline-block cursor-pointer self-center rounded-xl px-10 py-3.5 text-[0.85rem] uppercase tracking-[0.25em] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#E6ECF2] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ ...BASKERVVILLE, backgroundColor: NIGHT, color: IVORY }}
                >
                  {pending
                    ? "Guardando…"
                    : confirmed
                      ? "Actualizar"
                      : "Guardar"}
                </button>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

/** Compute the stepper's count from the latest known confirmation, clamped
 *  to `0..seats`. Used by the lazy `useState` initializer (mount) and when
 *  the user explicitly opens the modify form, so initialization stays
 *  consistent without render-time resync. */
function computeInitialCount(
  attendingCount: number | undefined,
  seats: number,
): number {
  if (typeof attendingCount === "number" && Number.isFinite(attendingCount)) {
    return Math.min(seats, Math.max(0, attendingCount));
  }
  return seats;
}

/** No-op action used only when the section is readonly, so `useActionState`
 *  always receives a valid function. It never runs because no form is rendered
 *  in readonly mode. */
async function noopAction(prevState: RsvpFormState): Promise<RsvpFormState> {
  return prevState;
}
