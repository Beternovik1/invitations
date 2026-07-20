"use client";

/**
 * PhotoCarousel — an editorial gallery carousel for the Lupita photo series.
 *
 * Designed to feel like a fine-art contact sheet rather than a generic slider:
 *   - Square corners, a single 1px gold hairline frame, no decorations on the
 *     slides themselves. The frame is the frame; the photograph fills a large
 *     portrait window.
 *   - No visible per-photo captions: the visitor's attention stays on Lupita's
 *     portraits, with only the quiet counter and controls around the image.
 *   - One signature touch: the indicator row uses small circular beads. The
 *     active bead turns gold while the rest stay quietly inked.
 *
 * Interactions:
 *   - Previous / next named buttons flanking the frame (night-blue circles).
 *   - Dot navigation, keyboard arrows when the wrapper is focused, swipe/drag
 *     on the frame when the visitor does not request reduced motion.
 *   - Tap / click the active photo to open a fullscreen lightbox; Escape and a
 *     named close button close it, ArrowLeft / ArrowRight move between photos.
 *
 * No autoplay: the brief is explicit that the visitor drives the experience.
 *
 * Accessibility:
 *   - The wrapper is a tab-stop with a labelled role="region" so arrow-key
 *     navigation is announced as part of the gallery region.
 *   - Every control is a real <button> with aria-label, focus-visible rings,
 *     and no pointer-only affordances.
 *   - Slides expose their alt text via a visually-hidden status for
 *     screen-reader users.
 *   - Reduced motion: crossfades become instant, drag is disabled. Visitors
 *     who request reduced motion still get full button + dot access.
 */

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
  type Variants,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GalleryPhoto } from "@/lib/gallery";

/* -------------------------------------------------------------------------- */
/*  Visual tokens (kept local — these belong to the carousel, not the page)  */
/* -------------------------------------------------------------------------- */

/* The Gallery section uses Edwardian Script for its own title and
   Baskervville for body copy; the carousel itself only needs Baskervville for
   its counter and control labels — the celebrant's name belongs to the section,
   not the slide surface. */
const GOLD = "#C7A96A";
const NIGHT = "#2E3E50";

const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

/* Shared easing matches SectionShell so the whole invitation moves as one. */
const EASE = [0.22, 1, 0.36, 1] as const;

/* Drag threshold: a swipe has to travel far enough or fast enough to commit.
   pixel offset OR px/s velocity. Picked by feel — short flicks commit, tiny
   accidental jitters don't. */
const DRAG_OFFSET_THRESHOLD = 60;
const DRAG_VELOCITY_THRESHOLD = 400;

/* -------------------------------------------------------------------------- */
/*  Variants                                                                  */
/* -------------------------------------------------------------------------- */

const slideVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
};

const reducedSlideVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

const lightboxVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: EASE } },
};

const reducedLightboxVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
  exit: { opacity: 0 },
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

interface PhotoCarouselProps {
  photos: readonly GalleryPhoto[];
}

export default function PhotoCarousel({ photos }: PhotoCarouselProps) {
  const reduceMotion = useReducedMotion();

  const [index, setIndex] = useState(0);
  /* direction drives the slide's x-offset on enter/exit so a "next" feels
     different from a "prev". */
  const [direction, setDirection] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const total = photos.length;
  const active = photos[index];

  /* Stable unique ids for a11y wiring (active slide description, dot labels). */
  const reactId = useId().replace(/[:]/g, "");
  const regionLabelId = `carousel-${reactId}-label`;
  const slideLabelId = `carousel-${reactId}-slide`;

  const regionRef = useRef<HTMLDivElement>(null);

  /* `paginate` is the dot navigation handler. Bounds-clamping is unnecessary
     here because `photos` is a static module-level list — it does not shrink
     at runtime, so the index can never fall outside [0, total-1]. */

  const paginate = useCallback(
    (next: number) => {
      if (total <= 1) return;
      setDirection(next > index ? 1 : -1);
      setIndex(next);
    },
    [index, total],
  );

  const goPrev = useCallback(() => {
    setDirection(-1);
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setDirection(1);
    setIndex((i) => (i + 1) % total);
  }, [total]);

  /* Drag-to-swipe — disabled under reduced motion per the brief's "respect
     reduced motion where practical". */
  const onDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      const { offset, velocity } = info;
      const forward =
        offset.x < -DRAG_OFFSET_THRESHOLD || velocity.x < -DRAG_VELOCITY_THRESHOLD;
      const back =
        offset.x > DRAG_OFFSET_THRESHOLD || velocity.x > DRAG_VELOCITY_THRESHOLD;

      if (forward) goNext();
      else if (back) goPrev();
    },
    [goNext, goPrev],
  );

  /* Keyboard: arrow keys move between slides when the region is focused OR
     when the lightbox is open. Escape only closes the lightbox; we don't
     hijack Escape outside the lightbox because it would override screen-reader
     patterns. Home/End jump to first/last. */
  useEffect(() => {
    if (!lightboxOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setLightboxOpen(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, goNext, goPrev]);

  /* In-carousel keyboard nav (no lightbox): only active while the region is
     focused, so we don't swallow arrows the rest of the page needs. */
  const onRegionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "Home") {
      e.preventDefault();
      setDirection(-1);
      setIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setDirection(1);
      setIndex(total - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      /* Enter / Space opens the lightbox from the keyboard — same affordance
         a tap on the photo gives. */
      e.preventDefault();
      setLightboxOpen(true);
    }
  };

  /* Esc handler when the region has focus and lightbox is closed: we don't
     bind global Escape here because nothing is "open" to escape. */

  /* A single tabbable region is enough for keyboard users; arrows then move
     between photos, not Tab. The counter + dots are still operable by Tab. */

  const slideVariantsActive = reduceMotion ? reducedSlideVariants : slideVariants;
  const lightboxVariantsActive = reduceMotion
    ? reducedLightboxVariants
    : lightboxVariants;

  const transition = useMemo(
    () => (reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE }),
    [reduceMotion],
  );

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* ---------------------------------------------------------------- */}
      {/*  Carousel frame                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex w-full max-w-4xl items-center justify-center gap-2 sm:gap-6">
        <NavButton
          direction="prev"
          onClick={goPrev}
          disabled={total <= 1}
          label="Foto anterior"
        />

        {/* Active slide region. role="region" + labelledby gives the arrow-key
            controls an announced context. tabIndex=0 makes the arrows reachable
            without forcing Tab onto every slide would otherwise be needed. */}
        <div
          ref={regionRef}
          role="region"
          aria-roledescription="carrusel"
          aria-label="Galería de fotos de Lupita"
          aria-labelledby={regionLabelId}
          tabIndex={0}
          onKeyDown={onRegionKeyDown}
          className="group relative w-full max-w-[min(76vw,24rem)] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-mist-blue)] sm:max-w-xl md:max-w-2xl"
          style={{ outlineColor: GOLD }}
        >
          <span id={regionLabelId} className="sr-only">
            Galería de fotos de Lupita. Usa las flechas izquierda y derecha para
            moverte entre fotos, Enter para ver en grande.
          </span>

          {/* The frame itself. Square corners, single 1px gold hairline, the
              photograph occupies it edge-to-edge. aspect-[4/5] reads as a
              large portrait window and matches most of the Lupita series. */}
          <div
            className="relative w-full overflow-hidden border"
            style={{ aspectRatio: "4 / 5", borderColor: GOLD }}
          >
            <AnimatePresence custom={direction} initial={false} mode="wait">
              <motion.button
                key={active.src}
                custom={direction}
                variants={slideVariantsActive}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
                drag={reduceMotion ? false : "x"}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                dragSnapToOrigin
                onDragEnd={onDragEnd}
                onClick={() => setLightboxOpen(true)}
                /* The whole frame is a button to open the lightbox. The
                   visually-hidden label is announced when a screen-reader user
                   lands on it, plus the active slide description below. */
                aria-label={`Abrir foto ${index + 1} de ${total}: ${active.alt}`}
                aria-describedby={slideLabelId}
                /* tabIndex=-1 — the region wrapper is the single tab stop for
                   the slideshow; arrow keys + Enter/Space live there. Keeping
                   the slide focusable would add a redundant tab stop and split
                   the keyboard model (arrows wouldn't work from the slide). */
                tabIndex={-1}
                className="absolute inset-0 flex h-full w-full items-center justify-center"
                /* The visible keyboard focus signal lives on the region
                   wrapper, not the slide button. */
                style={{ outline: "none" }}
              >
                <Image
                  src={active.src}
                  alt={active.alt}
                  fill
                  sizes="(max-width: 640px) 76vw, (max-width: 1024px) 576px, 672px"
                  className="object-cover"
                  priority={index === 0}
                />
              </motion.button>
            </AnimatePresence>

            {/* Tiny hint that the frame is interactive. Shown only on hover /
                keyboard focus, and hidden from reduced-motion visitors to keep
                the surface quiet. */}
            {!reduceMotion && (
              <span
                className="pointer-events-none absolute bottom-2 right-2 bg-[rgba(26,26,26,0.55)] px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-white opacity-0 transition-opacity duration-300 group-focus-visible:opacity-100 group-hover:opacity-100"
                style={{ ...BASKERVVILLE }}
                aria-hidden="true"
              >
                Ampliar
              </span>
            )}
          </div>

          {/* Visually-hidden live status for the active slide — screen-reader
              users hear the gallery's current state when the slide changes. */}
          <span id={slideLabelId} className="sr-only" aria-live="polite">
            Foto {index + 1} de {total}: {active.alt}.
          </span>
        </div>

        <NavButton
          direction="next"
          onClick={goNext}
          disabled={total <= 1}
          label="Foto siguiente"
        />
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Counter                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex w-full max-w-md flex-col items-center gap-2">
        <p
          className="text-[0.72rem] uppercase tracking-[0.32em] text-[var(--color-ink-soft)]"
          style={{ ...BASKERVVILLE }}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Dot navigation                                                   */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex items-center gap-2.5" role="tablist" aria-label="Selecciona una foto">
        {photos.map((photo, i) => {
          const isActive = i === index;
          return (
            <button
              key={photo.src}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Ir a la foto ${i + 1}: ${photo.alt}`}
              aria-controls={slideLabelId}
              onClick={() => paginate(i)}
              className="flex h-4 w-4 items-center justify-center rounded-full p-0 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-mist-blue)]"
              style={{ outlineColor: GOLD }}
            >
              {/* Circular beads — active turns gold, inactive stays quiet ink. */}
              <motion.span
                className="block rounded-full"
                animate={
                  isActive
                    ? { width: 10, height: 10, backgroundColor: GOLD }
                    : { width: 7, height: 7, backgroundColor: "rgba(26,26,26,0.4)" }
                }
                transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: EASE }}
              />
            </button>
          );
        })}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Lightbox                                                         */}
      {/* ---------------------------------------------------------------- */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Foto ampliada: ${active.alt}`}
            variants={lightboxVariantsActive}
            initial="hidden"
            animate="show"
            exit="exit"
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[rgba(15,20,26,0.92)] px-4 py-6"
          >
            {/* Close button — named for what it does, circular gold-bordered. */}
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Cerrar foto ampliada"
              autoFocus
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border bg-transparent text-2xl leading-none text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,20,26,0.92)]"
              style={{ borderColor: GOLD, outlineColor: GOLD }}
            >
              <span aria-hidden="true">×</span>
            </button>

            {/* Image + prev/next inside the dialog. Sizes use 90vw so next/image
                emits a srcset that fits a phone or a desktop. */}
            <div className="relative flex max-h-[80vh] max-w-[90vw] flex-1 items-center justify-center">
              <AnimatePresence custom={direction} initial={false} mode="wait">
                <motion.div
                  key={active.src}
                  custom={direction}
                  variants={slideVariantsActive}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={transition}
                  className="relative h-[78vh] w-[88vw] max-w-[min(88vw,560px)]"
                >
                  <Image
                    src={active.src}
                    alt={active.alt}
                    fill
                    sizes="(max-width: 640px) 88vw, 560px"
                    className="object-contain"
                  />
                </motion.div>
              </AnimatePresence>

              <NavButton
                direction="prev"
                onClick={goPrev}
                disabled={total <= 1}
                label="Foto anterior"
                variant="lightbox"
              />
              <NavButton
                direction="next"
                onClick={goNext}
                disabled={total <= 1}
                label="Foto siguiente"
                variant="lightbox"
              />
            </div>

            {/* Counter inside the dialog. */}
            <div className="mt-4 flex flex-col items-center gap-1 text-center">
              <p
                className="text-[0.72rem] uppercase tracking-[0.32em] text-white/70"
                style={{ ...BASKERVVILLE }}
              >
                {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
              </p>
              <p
                className="mt-2 text-[0.7rem] uppercase tracking-[0.28em] text-white/50"
                style={{ ...BASKERVVILLE }}
              >
                Esc para cerrar · ← → para navegar
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NavButton — module-level so it does not remount on every render    */
/* ------------------------------------------------------------------ */

function NavButton({
  direction,
  onClick,
  disabled,
  label,
  variant = "inline",
}: {
  direction: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
  label: string;
  variant?: "inline" | "lightbox";
}) {
  const isPrev = direction === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        variant === "lightbox"
            ? "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border text-2xl leading-none text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,20,26,0.92)] disabled:opacity-30"
          : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl leading-none text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-mist-blue)] disabled:opacity-30"
      }
      style={{ backgroundColor: NIGHT, borderColor: NIGHT, outlineColor: GOLD }}
    >
      <span aria-hidden="true">{isPrev ? "‹" : "›"}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
