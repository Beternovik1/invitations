"use client";

import { useActionState, useId } from "react";
import { motion } from "framer-motion";

import SectionShell from "@/components/ui/SectionShell";
import { submitRsvpAction } from "@/app/i/[slug]/actions";
import {
  MAX_RSVP_MESSAGE_LENGTH,
  type RsvpFormState,
} from "@/lib/rsvps-shared";
import type { GuestGroup } from "@/lib/guest-groups";

/* Inline reveal easing matches the rest of the invitation. */
const EASE = [0.22, 1, 0.36, 1] as const;

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
 * Rendered only on `/i/[slug]` (the public landing page never mounts it), after
 * the envelope opens. Submission goes through the `submitRsvpAction` Server
 * Action via `useActionState`, so the service-role key and Supabase access stay
 * on the server. The form is progressively enhanced: it works without client JS
 * for the core submission path (the Server Action is the form action), and
 * `useActionState` adds inline status feedback on top.
 *
 * States:
 *   - Seats pending (`assignedSeats` null): the host has not set the count yet.
 *     Show a clear Spanish message and a disabled form so the guest knows RSVP
 *     is not forgotten, just waiting.
 *   - Supabase not configured (`rsvpEnabled` false): show a local notice and no
 *     working form — never pretend a mock write succeeded.
 *   - Otherwise: an interactive form capped at `assignedSeats`, prefilled from
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
  // as (prevState, formData). The binding keeps the slug on the server; only the
  // action reference reaches the client.
  const boundAction = rsvpEnabled ? submitRsvpAction.bind(null, group.slug) : null;

  const initialState: RsvpFormState = { status: "idle", rsvp: initialRsvp };
  // `useActionState` requires an action; when readonly we pass a no-op sentinel
  // so the hook signature stays stable (the form is never submitted in that
  // mode because the button is disabled).
  const [state, formAction, pending] = useActionState<RsvpFormState, FormData>(
    boundAction ?? noopAction,
    initialState
  );

  const confirmed = state.rsvp ?? initialRsvp;
  const lastError = state.status === "error" ? state.error : null;

  const fieldsetId = useId();

  return (
    <SectionShell
      id="rsvp"
      eyebrow="Confirma tu asistencia"
      title="¿Nos acompañarás?"
    >
      <motion.div
        className="leaf-panel w-full max-w-xl rounded-2xl p-6 text-left sm:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        {/* Seat context line: the limit is the single most important fact for
            this form, so it tops the card in every state. */}
        <p
          className="font-sans text-sm text-[var(--color-ink-dim)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {seatsPending ? (
            <>{group.seatsNote ?? "Por confirmar"}</>
          ) : (
            <>
              Tienes{" "}
              <strong className="text-[var(--color-ink)]">{seats}</strong>{" "}
              {seats === 1 ? "lugar reservado" : "lugares reservados"} para ti.
            </>
          )}
        </p>

        {/* Pending-seat notice: RSVP is not available yet, but it is not
            forgotten either. */}
        {seatsPending && (
          <p
            className="mt-4 font-serif text-base italic text-[var(--color-ink)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Aún estamos confirmando el número de lugares para tu grupo. Te
            avisaremos en cuanto puedas confirmar tu asistencia.
          </p>
        )}

        {/* No-backend notice: local / zero-config builds stay honest. */}
        {!rsvpEnabled && (
          <p
            className="mt-4 font-serif text-base italic text-[var(--color-ink)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            La confirmación de asistencia no está disponible en este entorno.
          </p>
        )}

        {/* Current confirmation banner (prefill feedback). Shown whenever a
            saved RSVP exists, including after a successful update. */}
        {!readonly && confirmed && (
          <p
            className="mt-4 font-sans text-sm text-[var(--color-ink)]"
            style={{ fontFamily: "var(--font-sans)" }}
            role="status"
          >
            {state.status === "success" && (
              <strong className="text-[var(--color-gold-soft)]">
                ¡Gracias!{" "}
              </strong>
            )}
            Confirmaste {confirmed.attendingCount} de {seats}{" "}
            {seats === 1 ? "lugar" : "lugares"}. Puedes actualizar tu respuesta
            cuando quieras.
          </p>
        )}

        {/* Error feedback. Field-level hints inline below each control. */}
        {lastError && (
          <p
            className="mt-4 rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-pale-yellow-green)]/50 px-4 py-3 font-sans text-sm text-[var(--color-ink)]"
            style={{ fontFamily: "var(--font-sans)" }}
            role="alert"
          >
            {lastError.message}
          </p>
        )}

        {!readonly && (
          <form action={formAction} className="mt-6 flex flex-col gap-5">
            <fieldset
              id={fieldsetId}
              disabled={pending}
              className="flex flex-col gap-5"
            >
              <legend className="sr-only">Datos de confirmación</legend>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${fieldsetId}-count`}
                  className="font-sans text-xs uppercase tracking-[0.22em] text-[var(--color-gold-soft)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Asistentes
                </label>
                <input
                  id={`${fieldsetId}-count`}
                  name="attendingCount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={seats}
                  step={1}
                  required
                  defaultValue={
                    confirmed ? String(confirmed.attendingCount) : ""
                  }
                  aria-describedby={
                    lastError?.fields?.attendingCount
                      ? `${fieldsetId}-count-error`
                      : undefined
                  }
                  className="rounded-lg border border-[var(--color-gold)]/50 bg-[var(--color-cream-white)] px-4 py-3 font-sans text-base text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream-white)] disabled:opacity-60"
                  style={{ fontFamily: "var(--font-sans)" }}
                />
                <span
                  className="font-sans text-xs text-[var(--color-ink-dim)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  De 0 a {seats} {seats === 1 ? "lugar" : "lugares"}.
                </span>
                {lastError?.fields?.attendingCount && (
                  <span
                    id={`${fieldsetId}-count-error`}
                    className="font-sans text-xs text-[var(--color-gold-soft)]"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {lastError.fields.attendingCount}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`${fieldsetId}-message`}
                  className="font-sans text-xs uppercase tracking-[0.22em] text-[var(--color-gold-soft)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Mensaje para Sarahí (opcional)
                </label>
                <textarea
                  id={`${fieldsetId}-message`}
                  name="message"
                  rows={3}
                  maxLength={MAX_RSVP_MESSAGE_LENGTH}
                  defaultValue={confirmed?.message ?? ""}
                  className="resize-y rounded-lg border border-[var(--color-gold)]/50 bg-[var(--color-cream-white)] px-4 py-3 font-serif text-base text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream-white)] disabled:opacity-60"
                  style={{ fontFamily: "var(--font-serif)" }}
                />
              </div>

              <button
                type="submit"
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-gold)] px-7 py-3 font-sans text-xs uppercase tracking-[0.24em] text-[var(--color-gold-soft)] transition-colors hover:bg-[var(--color-gold)] hover:text-[var(--color-cream-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream-white)] disabled:cursor-not-allowed disabled:opacity-70"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {pending
                  ? "Guardando…"
                  : confirmed
                    ? "Actualizar confirmación"
                    : "Confirmar asistencia"}
              </button>
            </fieldset>
          </form>
        )}
      </motion.div>
    </SectionShell>
  );
}

/** No-op action used only when the section is readonly, so `useActionState`
 *  always receives a valid function. It never runs because the submit button is
 *  not rendered in readonly mode. */
async function noopAction(prevState: RsvpFormState): Promise<RsvpFormState> {
  return prevState;
}