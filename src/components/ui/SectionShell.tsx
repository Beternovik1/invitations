"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

import BeadDivider from "@/components/ui/BeadDivider";

/* Shared easing matches the hero so the whole invitation moves as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.14, delayChildren: 0.04 },
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

interface SectionShellProps {
  /** Anchor id for potential deep links. */
  id?: string;
  /** Small chapter label above the title (encodes the section's role). */
  eyebrow: string;
  /** Display heading for the section. */
  title: string;
  /** Section body. Server-rendered children are fine here. */
  children: ReactNode;
  /** Extra classes for the outer section element. */
  className?: string;
}

/**
 * Shared wrapper that gives every invitation section the same vertical
 * rhythm, chapter eyebrow, serif title, bead divider, and a single gentle
 * scroll reveal.
 *
 * The reveal is one orchestrated fade-up of header then body (not a per-item
 * stagger across arbitrary content) so sections stay disciplined and calm.
 * Reduced-motion visitors see everything immediately. Only this shell ships
 * client JS for the new sections; the section components themselves are
 * server components.
 */
export default function SectionShell({
  id,
  eyebrow,
  title,
  children,
  className,
}: SectionShellProps) {
  const reduceMotion = useReducedMotion();
  const container = reduceMotion ? reducedVariants : containerVariants;
  const item = reduceMotion ? reducedVariants : itemVariants;

  return (
    <section
      id={id}
      className={`relative isolate w-full px-6 py-20 sm:py-28 ${className ?? ""}`}
    >
      <motion.div
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        <motion.span
          variants={item}
          className="font-serif text-clamp-eyebrow uppercase italic text-[var(--color-gold-soft)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {eyebrow}
        </motion.span>

        <motion.h2
          variants={item}
          className="font-serif text-[clamp(1.75rem,5vw,2.75rem)] leading-tight text-[var(--color-ink)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </motion.h2>

        <motion.div variants={item}>
          <BeadDivider />
        </motion.div>

        <motion.div
          variants={item}
          className="mt-2 flex w-full flex-col items-center gap-7"
        >
          {children}
        </motion.div>
      </motion.div>
    </section>
  );
}
