"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";

import { EVENT } from "@/lib/constants";
import { getCountdown, pad2, type CountdownParts } from "@/lib/time";

/**
 * CountdownSection — full-bleed countdown over the `count_down.jpeg`
 * photograph.
 *
 * Sits immediately below `<BlessingHosts />`, before RSVP / locations. The
 * image is the section background; the countdown composition is anchored to
 * the bottom so the photograph still reads, with a bottom gradient overlay so
 * the text stays legible over any part of the image.
 *
 * Typographic split per the user's direction:
 *   - "Faltan" and "para mis xv anos" use the Edwardian Script ITC face
 *     (`--font-edwardian-script`, already mounted in `layout.tsx`).
 *   - The four countdown numerals and labels use Baskervville
 *     (`--font-baskervville`) so they match the intro message section.
 *     Their lowercase labels `dias`, `hrs`, `min`, `seg` are the user-supplied
 *     UI copy verbatim — no accents, no capitalization, kept exactly as
 *     written.
 *
 * Client Component: the ticking clock is LOCAL to this section. The server
 * render uses a `--` placeholder (so hydration matches), then a single
 * `setInterval` started in `useEffect` after mount updates the parts every
 * second and is cleaned up on unmount. This avoids touching the shared
 * `<Countdown />` UI in `src/components/ui/Countdown.tsx` and keeps the
 * section's added surface area self-contained.
 */

const COUNTDOWN_IMAGE = "/photo/count_down.jpeg" as const;

const UNITS: ReadonlyArray<{
  key: keyof Omit<CountdownParts, "isPast">;
  label: string;
}> = [
  { key: "days", label: "dias" },
  { key: "hours", label: "hrs" },
  { key: "minutes", label: "min" },
  { key: "seconds", label: "seg" },
];

const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.16, delayChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

const reducedVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

export default function CountdownSection() {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;

  // `null` is the SSR/pre-hydration placeholder state: it renders `--` so the
  // server markup matches what the client renders on its first pass. Once
  // mounted, the interval ticks every second and the parts populate.
  const [parts, setParts] = useState<CountdownParts | null>(null);

  useEffect(() => {
    const update = () => setParts(getCountdown(EVENT.startISO));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="cuenta-regresiva"
      className="relative isolate flex min-h-[85dvh] w-full flex-col justify-end overflow-hidden px-5 pb-12 pt-20 sm:min-h-[92dvh] sm:px-8 sm:pb-16"
    >
      <Image
        src={COUNTDOWN_IMAGE}
        alt=""
        fill
        aria-hidden="true"
        className="-z-20 object-cover object-center"
        sizes="100vw"
      />
      {/* Same bottom-heavy overlay language as the Hero: lighter at the top,
          progressively degrading into black at the bottom so the anchored
          countdown reads clearly over the image. */}
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(18,31,27,0.26)_42%,rgba(0,0,0,0.82)_100%)]"
        aria-hidden="true"
      />

      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center gap-6 text-center sm:gap-8"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
      >
        <motion.p
          className="text-balance text-[clamp(3.85rem,15vw,5.85rem)] leading-[1.05] text-white"
          style={{ ...EDWARDIAN, textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
          variants={item}
        >
          Faltan
        </motion.p>

        <motion.div
          className="flex w-full items-stretch justify-center gap-3 sm:gap-5"
          variants={item}
          role="timer"
          aria-live="polite"
          aria-label="Cuenta regresiva para mis XV años"
        >
          {UNITS.map(({ key, label }) => {
            const value =
              parts == null
                ? "--"
                : key === "days"
                  ? String(parts[key]).padStart(2, "0")
                  : pad2(parts[key]);
            return (
              <div
                key={key}
                className="flex flex-1 flex-col items-center justify-center"
              >
                <span
                  className="text-[clamp(2.2rem,8vw,3.35rem)] font-medium tabular-nums text-white"
                  style={{
                    ...BASKERVVILLE,
                    textShadow: "0 2px 6px rgba(0,0,0,0.5)",
                  }}
                >
                  {value}
                </span>
                <span
                  className="mt-1 text-[0.72rem] tracking-[0.22em] text-white/85 sm:text-[0.82rem]"
                  style={BASKERVVILLE}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </motion.div>

        <motion.p
          className="text-balance text-[clamp(3rem,12vw,4.5rem)] leading-[1.05] text-white"
          style={{ ...EDWARDIAN, textShadow: "0 2px 8px rgba(0,0,0,0.55)" }}
          variants={item}
        >
          para mis xv anos
        </motion.p>
      </motion.div>
    </section>
  );
}
