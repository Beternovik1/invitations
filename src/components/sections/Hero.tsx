"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import Image from "next/image";

import { ASSETS, EVENT } from "@/lib/constants";
import Fireflies from "@/components/ui/Fireflies";

const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.18, delayChildren: 0.25 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: EASE },
  },
};

const reducedVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;

  return (
    <section
      className="relative isolate flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center"
      // Hero no longer paints its own backdrop or decorative border: it
      // participates in the continuous `.page-atmosphere` layer mounted on the
      // page so the opening tone journey is shared with the rest of the
      // sections instead of cutting in a separate color block.
    >
      <Image
        src={ASSETS.heroPortrait}
        alt=""
        fill
        priority
        aria-hidden="true"
        className="-z-20 object-cover object-center"
        sizes="100vw"
      />
      <div
        className="absolute inset-0 -z-10 bg-[rgba(33,58,50,0.34)]"
        aria-hidden="true"
      />
      <Fireflies />

      <motion.div
        className="relative z-10 mt-[34dvh] flex w-full max-w-2xl flex-col items-center gap-5 sm:mt-[38dvh] sm:gap-7"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.span
          variants={item}
          className="text-clamp-eyebrow font-sans uppercase text-white drop-shadow-[0_2px_4px_rgba(33,58,50,0.55)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {EVENT.eventType}
        </motion.span>

        <motion.h1
          variants={item}
          className="text-clamp-name font-display title-gold gold-shimmer"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {EVENT.celebrantName}
        </motion.h1>

        <motion.p
          variants={item}
          className="text-clamp-eyebrow font-sans uppercase text-white drop-shadow-[0_2px_4px_rgba(33,58,50,0.55)]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {EVENT.dateLabel}
        </motion.p>
      </motion.div>
    </section>
  );
}
