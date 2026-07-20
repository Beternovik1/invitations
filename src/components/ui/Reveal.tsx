"use client";

/**
 * Reveal — a small reusable scroll-reveal wrapper.
 *
 * The invitation already has four motion-aware sections (Hero, IntroMessage,
 * BlessingHosts, CountdownSection, plus the shared `SectionShell`) that all
 * open-code the exact same dance: a `container variants` with `staggerChildren`
 * + `delayChildren`, an `item variants` of `{ opacity: 0, y: 18 } -> { 1, 0 }`
 * with `duration: 0.7`, the shared `EASE = [0.22, 1, 0.36, 1]`, `whileInView`
 * with `viewport={{ once: true, amount }}`, and a reduced-motion path that
 * collapses both variants to a no-op so the page lands instantly.
 *
 * Reveal centralizes that choreography so the previously-static text sections
 * (Gallery, DressCode, Gifts, FinalThanks) can join it without becoming their
 * own Client Components and without ever drifting away from the rest of the
 * invitation's motion language. Server Components can import and render this
 * client wrapper directly — the section itself stays a Server Component.
 *
 * Usage:
 *
 *   <Reveal>
 *     <RevealItem as="h2">Title</RevealItem>
 *     <RevealItem as="p">Subtitle</RevealItem>
 *     <RevealItem variant="soft-scale">decorative icon / heart</RevealItem>
 *   </Reveal>
 *
 * `Reveal` is the orchestrating container (its own `motion.div` with
 * `whileInView` + `once: true`). `RevealItem` is the leaf motion element — it
 * only declares `variants`, so it inherits the `hidden`/`show` labels from the
 * nearest enclosing `<Reveal>` via framer-motion's variant propagation. Use
 * the `as` prop to render the right supported semantic element (`h2`, `p`,
 * `a`) and keep the surrounding markup exactly as before.
 */

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/* Shared easing matches the hero/IntroMessage/BlessingHosts/CountdownSection
   so the whole invitation moves as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

export type RevealVariant = "fade-up" | "soft-scale";

/* `fade-up` is the default for text: subtle opacity + 18px upward movement
   over 0.7s. `soft-scale` is reserved for decorative ornaments (icons /
   hearts) where a tiny 4% scale-in landing on 1 reads heavier than the
   matching fade without ever becoming a flashy effect. */
const ITEM_VARIANTS: Record<RevealVariant, Variants> = {
  "fade-up": {
    hidden: { opacity: 0, y: 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, ease: EASE },
    },
  },
  "soft-scale": {
    hidden: { opacity: 0, y: 10, scale: 0.96 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: EASE },
    },
  },
};

/* Reduced-motion variant collapses both variants to a no-op: the item is
   visible immediately and there is no per-child stagger. */
const REDUCED_ITEM_VARIANTS: Variants = {
  hidden: {},
  show: {},
};

const REDUCED_CONTAINER_VARIANTS: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0, delayChildren: 0 } },
};

interface RevealProps {
  /** Stagger between children, in seconds. 0 disables staggering. */
  stagger?: number;
  /** Delay before the first child starts the reveal, in seconds. */
  delayChildren?: number;
  /** Viewport intersection amount (0..1) before the reveal fires. */
  amount?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Reveal({
  children,
  stagger = 0.14,
  delayChildren = 0.04,
  amount = 0.25,
  className,
  style,
}: RevealProps) {
  const reduceMotion = useReducedMotion();
  const containerVariants: Variants = reduceMotion
    ? REDUCED_CONTAINER_VARIANTS
    : {
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren } },
      };

  return (
    <motion.div
      className={className}
      style={style}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      data-reveal=""
    >
      {children}
    </motion.div>
  );
}

type RevealItemTag = "div" | "h2" | "p" | "a";

interface RevealItemProps {
  /** The semantic element to render. Defaults to div. */
  as?: RevealItemTag;
  /** Reveal animation variant. Defaults to `fade-up`. */
  variant?: RevealVariant;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  href?: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
}

export function RevealItem({
  as = "div",
  variant = "fade-up",
  children,
  className,
  style,
  ...rest
}: RevealItemProps) {
  const reduceMotion = useReducedMotion();
  const itemVariants = reduceMotion ? REDUCED_ITEM_VARIANTS : ITEM_VARIANTS[variant];

  if (as === "h2") {
    return (
      <motion.h2
        className={className}
        style={style}
        variants={itemVariants}
        data-reveal-item={variant}
      >
        {children}
      </motion.h2>
    );
  }

  if (as === "p") {
    return (
      <motion.p
        className={className}
        style={style}
        variants={itemVariants}
        data-reveal-item={variant}
      >
        {children}
      </motion.p>
    );
  }

  if (as === "a") {
    return (
      <motion.a
        className={className}
        style={style}
        variants={itemVariants}
        data-reveal-item={variant}
        {...rest}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      variants={itemVariants}
      data-reveal-item={variant}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
