"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { ReactNode } from "react";

import FloatingMusicButton, {
  type FloatingMusicButtonHandle,
} from "@/components/ui/FloatingMusicButton";
import { MUSIC } from "@/lib/constants";
import type { GuestGroup } from "@/lib/guest-groups";

/* Shared easing matches the hero and section reveals so the whole invitation
   moves as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

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
            className="relative isolate flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-0 py-0 sm:px-6 sm:py-10"
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
              className="relative z-10 h-[100dvh] sm:h-[90dvh] md:h-[84dvh] lg:h-[82dvh]"
              initial={{ opacity: 0, y: 26, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
              style={{ perspective: 1200 }}
            >
              <motion.button
                type="button"
                onClick={handleOpen}
                disabled={opening || opened}
                aria-label={`Abrir la invitación para ${group.displayName}`}
                className="relative mx-auto block h-full aspect-[9/16] w-auto max-w-none overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-mist-blue)] disabled:cursor-not-allowed"
                animate={
                  opening
                    ? { opacity: 0, scale: 1.04, y: -12 }
                    : { opacity: 1, scale: 1, y: 0 }
                }
                transition={{ duration: opening ? 0.45 : 0.3, ease: EASE }}
              >
                <Image
                  src="/photo/sobre_navy.png"
                  alt="Sobre cerrado de la invitación"
                  fill
                  priority
                  sizes="(min-width: 1024px) 46vh, (min-width: 640px) 51vh, 56vh"
                  className="object-contain drop-shadow-[0_28px_46px_rgba(33,58,50,0.22)]"
                />

                <motion.div
                  className="absolute inset-x-[10%] top-[24%] z-10 text-center"
                  animate={
                    opening
                      ? { opacity: 0, scale: 0.92, y: 8 }
                      : { opacity: 1, scale: 1, y: 0 }
                  }
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  <p
                    className="mx-auto flex max-w-[22rem] flex-col text-[clamp(3.8rem,15vw,6rem)] leading-[0.78] text-white drop-shadow-[0_2px_2px_rgba(33,58,50,0.55)]"
                    style={{ fontFamily: "var(--font-edwardian-script)" }}
                  >
                    <span>Para:</span>
                    <span>{group.displayName}</span>
                  </p>
                </motion.div>
              </motion.button>
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
