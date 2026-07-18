"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import BeadDivider from "@/components/ui/BeadDivider";
import FloatingMusicButton, {
  type FloatingMusicButtonHandle,
} from "@/components/ui/FloatingMusicButton";
import { MUSIC } from "@/lib/constants";
import type { GuestGroup } from "@/lib/guest-groups";

/* Shared easing matches the hero and section reveals so the whole invitation
   moves as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

/* Flap + seal palette, local to this decorative moment so it stays self-
   contained and easy to retune without touching global tokens. */
const FLAP_TOP = "#b8dba0"; // sage
const FLAP_BOTTOM = "#77a291"; // dusty teal
const GOLD = "#c79a3c";
const GOLD_BRIGHT = "#f2d27a";
const GOLD_SOFT = "#9c7320";

interface EnvelopeGateProps {
  /** The guest group this envelope is addressed to. */
  group: GuestGroup;
  /** The invitation content revealed once the envelope is opened. Passed as a
   *  slot so server-rendered sections stay server-rendered. */
  children: ReactNode;
}

/**
 * Personalized envelope gate.
 *
 * A sealed, addressed envelope presented to a guest group before the invitation
 * itself. The closed envelope shows who it is for and how many seats are held
 * for them; tapping "Abrir invitación" pops the wax seal, swings the flap open,
 * and dissolves the envelope into the shared invitation content (`children`).
 *
 * State is local and resets on every visit, so each load re-presents the
 * envelope — the invitation is always something the guest chooses to open.
 * `prefers-reduced-motion` skips the flap/seal choreography and reveals the
 * invitation immediately on tap while still showing the addressed envelope as a
 * step (the gate is content, not decoration, so it is never bypassed).
 */
export default function EnvelopeGate({ group, children }: EnvelopeGateProps) {
  const reduceMotion = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);

  // Imperative handle to the audio control. Browsers only allow
  // `HTMLAudioElement.play()` from within a user activation — including the
  // "Abrir invitación" tap. The floating control mounts (hidden) before the
  // envelope is opened so the `<audio>` element exists when that tap fires;
  // we then call `play()` synchronously inside the click handler to ride the
  // same user gesture. The promise is intentionally not awaited so the
  // flap-open choreography starts immediately regardless of how the browser
  // resolves playback (or rejects it on `NotAllowedError`).
  const musicRef = useRef<FloatingMusicButtonHandle | null>(null);

  const handleOpen = useCallback(() => {
    if (opened || opening) return;

    // Kick off music inside the same user gesture that opens the envelope.
    // The handle absorbs `play()` rejections itself, so a browser that
    // blocks playback never throws here — the invitation still opens and
    // the (now-visible) button lets the guest retry manually.
    void musicRef.current?.play();

    // Reduced-motion visitors skip the flap/seal choreography.
    if (reduceMotion) {
      setOpened(true);
      return;
    }
    // Kick off the seal-pop + flap-open sequence, then reveal the invitation
    // once the flap has swung open. The envelope card's exit animation (via
    // AnimatePresence below) carries it away as the invitation fades up.
    setOpening(true);
    window.setTimeout(() => setOpened(true), 760);
  }, [opened, opening, reduceMotion]);

  const seatsLabel =
    group.assignedSeats == null
      ? group.seatsNote ?? "El número de lugares está por confirmar"
      : `Tenemos ${group.assignedSeats} ${
          group.assignedSeats === 1 ? "lugar" : "lugares"
        } reservados para ti`;
  const seatsPending = group.assignedSeats == null;

  return (
    <>
      {opened ? children : null}

      {/* The personalized route renders its floating music control here so
          the audio element is mounted before the envelope is opened — the
          "Abrir invitación" tap can call `play()` on it as a user gesture.
          `hidden` keeps it visually absent until the envelope is opened, at
          which point the button becomes the guest's pause/resume control.
          The shared `InvitationContent` is rendered with `showMusicButton`
          disabled on this route so there is never a second control. */}
      {MUSIC.enabled ? (
        <FloatingMusicButton ref={musicRef} hidden={!opened} />
      ) : null}

      <AnimatePresence>
        {!opened && (
          <motion.section
            key="envelope-scene"
            aria-label={`Sobre de invitación para ${group.displayName}`}
            className="relative isolate flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // The whole scene lifts and fades as the invitation appears beneath.
            // `pointerEvents: none` once opened keeps the exiting envelope from
            // blocking the invitation's controls during the brief overlap.
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -18, scale: 1.04 }
            }
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE }}
            style={{ pointerEvents: opened ? "none" : "auto" }}
          >
            <div className="page-atmosphere" aria-hidden="true" />

            <motion.div
              className="relative z-10 w-full max-w-md"
              initial={{ opacity: 0, y: 26, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
              style={{ perspective: 1200 }}
            >
              <div className="leaf-panel relative overflow-hidden rounded-[1.5rem] border border-[var(--color-gold)]/40 px-7 pb-9 pt-28 text-center shadow-[0_26px_64px_rgba(33,58,50,0.30)]">
                {/* Envelope flap: a gold-edged sage triangle hinged at the top
                    edge. Swings open (rotateX) when `opening`. Hides its back
                    face so it cleanly tucks away past 90°. */}
                <motion.div
                  className="absolute inset-x-0 top-0 h-[44%]"
                  style={{
                    transformOrigin: "top center",
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                  }}
                  animate={opening ? { rotateX: -168 } : { rotateX: 0 }}
                  transition={{
                    duration: 0.55,
                    ease: EASE,
                    delay: opening ? 0.12 : 0,
                  }}
                >
                  <svg
                    viewBox="0 0 100 50"
                    preserveAspectRatio="none"
                    fill="none"
                    className="h-full w-full"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="envelope-flap-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={FLAP_TOP} />
                        <stop offset="100%" stopColor={FLAP_BOTTOM} />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 0 L100 0 L50 50 Z"
                      fill="url(#envelope-flap-fill)"
                      opacity="0.92"
                    />
                    {/* Only the two slanted edges read as the flap outline; the
                        top edge is the hinge and stays open. */}
                    <path
                      d="M0 0 L50 50 L100 0"
                      stroke={GOLD}
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </motion.div>

                {/* Wax seal at the flap apex — the "S" of Sarahí. Pops off first
                    to signal the envelope is being opened. */}
                <motion.div
                  className="absolute left-1/2 top-[44%] z-20 -translate-x-1/2 -translate-y-1/2"
                  animate={
                    opening
                      ? { opacity: 0, scale: 0.5 }
                      : { opacity: 1, scale: 1 }
                  }
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <WaxSeal />
                </motion.div>

                {/* Addressed content — visible on the closed envelope so the
                    guest sees who it is for and how many seats are held before
                    opening. */}
                <span
                  className="font-sans text-clamp-eyebrow uppercase tracking-[0.32em] text-[var(--color-gold-soft)]"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Para
                </span>

                <h2
                  className="mt-3 font-serif text-[clamp(1.6rem,6vw,2.4rem)] leading-tight text-[var(--color-ink)]"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {group.displayName}
                </h2>

                <p
                  className="mt-2 font-serif text-sm italic text-[var(--color-ink-dim)]"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Sarahí te invita a celebrar sus XV años
                </p>

                <div className="my-5">
                  <BeadDivider />
                </div>

                <p
                  className={`font-sans text-sm ${
                    seatsPending
                      ? "text-[var(--color-ink-dim)]"
                      : "text-[var(--color-ink)]"
                  }`}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {seatsLabel}
                </p>

                <button
                  type="button"
                  onClick={handleOpen}
                  disabled={opening || opened}
                  aria-label={`Abrir la invitación para ${group.displayName}`}
                  className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-gold)] px-7 py-3 font-sans text-xs uppercase tracking-[0.24em] text-[var(--color-gold-soft)] transition-colors hover:bg-[var(--color-gold)] hover:text-[var(--color-cream-white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream-white)] disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  {opening ? "Abriendo…" : "Abrir invitación"}
                </button>
              </div>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Wax seal                                                                   */
/* -------------------------------------------------------------------------- */

/** Gold wax seal stamped with the celebrant's initial — the ornament that
 *  holds the envelope closed and pops off when the guest opens it. */
function WaxSeal() {
  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-full sm:h-20 sm:w-20"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${GOLD_BRIGHT} 0%, ${GOLD} 52%, ${GOLD_SOFT} 100%)`,
        boxShadow:
          "0 6px 16px rgba(33,58,50,0.38), inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -4px 8px rgba(33,58,50,0.4)",
        border: "2px solid rgba(249,252,228,0.65)",
      }}
      aria-hidden="true"
    >
      <span
        className="font-display text-2xl leading-none text-[var(--color-cream-bright)] sm:text-3xl"
        style={{
          fontFamily: "var(--font-display)",
          textShadow: "0 1px 2px rgba(33,58,50,0.6)",
        }}
      >
        S
      </span>
    </div>
  );
}
