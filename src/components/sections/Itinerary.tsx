"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * "Itinerario" — scroll-driven vertical timeline.
 *
 * Layout: a single left-aligned vertical line with four stacked events. Each
 * event row carries a circular marker that sits on the line, aligned with the
 * icon's vertical midpoint (not the text above). To the right of the line:
 * TIME label (Baskervville, uppercase, tracked), EVENT NAME (Edwardian Script),
 * and a ~200x200 decorative icon centered underneath.
 *
 * Scroll-fill model: two vertical lines are stacked at the same x position — a
 * cream base line at full container height, and a navy overlay line whose
 * height is `ratio * containerHeight`. The ratio is computed as the position
 * of a viewport reference point (~40% from the top of the viewport) relative
 * to the timeline container's bounding box, clamped to [0, 1]. The overlay
 * height therefore tracks scroll 1:1 with no easing.
 *
 * Each marker reads its measured vertical center inside the container and is
 * "filled" when its center sits at or below the overlay's fill height. This
 * makes the fill exactly a pure function of scroll position, so scrolling back
 * up unfills the line and the markers in reverse — no animation state needs to
 * be reset. The only transition is a 200ms color tween on the marker fill to
 * soften the swap from cream to navy (skipped under reduced-motion).
 *
 * The four events and their icons are fixed content (a real, ordered evening
 * program), so the data lives in this file rather than in `lib/constants.ts`.
 * `lib/constants.ts` still exports the legacy `ITINERARY` constant for any
 * other consumer; this component does not import it.
 */

// Self-hosted font variables — both are mounted in `app/layout.tsx`
// (edwardianscriptitc.ttf -> --font-edwardian-script; Baskervville
// VariableFont_wght -> --font-baskervville). Matches the type split used by
// the "Dónde y Cuándo" section so the page reads as one piece.
const EDWARDIAN = { fontFamily: "var(--font-edwardian-script)" } as const;
const BASKERVVILLE = { fontFamily: "var(--font-baskervville)" } as const;

// Section palette — fixed per design brief, kept local because these are
// content colors specific to this section (not shared theme tokens).
const SECTION_BG = "var(--color-mist-blue)";
const LINE_UNFILLED = "#EDE4D3";
const LINE_FILLED = "#2E4A63";
const INK = "#1A1A1A";
const NAVY_TEXT = "#2E3E50";

// Timeline geometry constants — kept as named values so the layout math is
// readable, and the marker/line alignment stays in sync if one changes.
const LINE_LEFT_PX = 28; // x offset of the vertical line within the container
const LINE_WIDTH_PX = 4; // ~3-4px per brief
const MARKER_SIZE_PX = 60; // ~55-60px per brief
const ICON_SIZE_PX = 200; // ~200x200 icon per brief
// Marker vertical anchor — the marker's midpoint aligns with the icon's
// midpoint. Because the icon is the last element in each row and rows use
// margin (not padding) for spacing, the row's bottom edge equals the icon's
// bottom edge. Therefore marker.bottom (relative to row) =
// ICON_SIZE/2 - MARKER_SIZE/2 = 100 - 30 = 70px.
const MARKER_BOTTOM_PX = ICON_SIZE_PX / 2 - MARKER_SIZE_PX / 2;
// Reference point inside the viewport used to compute scroll progress. ~40%
// from the top feels natural for a sticky fill that begins before the timeline
// hits the very top of the viewport.
const VIEWPORT_REF_RATIO = 0.4;
// Soft color tween on the marker fill — skipped when the visitor prefers
// reduced motion (only the instant fill swap remains).
const MARKER_COLOR_TRANSITION_MS = 200;

interface ItineraryEvent {
  id: string;
  time: string;
  title: string;
  icon: string;
}

/**
 * Fixed evening program for the Itinerario timeline. Order matters — each
 * row is a real moment in the night, in sequence. Icons are decorative and
 * are rendered with an empty alt string so screen readers skip them (the
 * adjacent time + name already describe the event).
 */
const EVENTS: readonly ItineraryEvent[] = [
  {
    id: "ceremony",
    time: "14:00 HRS",
    title: "Ceremonia religiosa",
    icon: "/photo/iconocolordoradoiglesia.png",
  },
  {
    id: "reception",
    time: "16:00 HRS",
    title: "Recepción de invitados",
    icon: "/photo/iconodoradoprincesa.png",
  },
  {
    id: "dinner",
    time: "16:30 HRS",
    title: "Comida",
    icon: "/photo/iconocolordoradoplato.png",
  },
  {
    id: "waltz",
    time: "17:30 HRS",
    title: "Vals y a fiesta",
    icon: "/photo/iconocolordoradomusica-300x300.png",
  },
] as const;

/**
 * Inline heart glyph. Used centered inside every marker. Filled markers paint
 * the solid heart in white; unfilled markers paint the outline in white (no
 * fill) so the heart stays legible against the pale-cream circle.
 */
function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "#FFFFFF" : "none"}
      stroke="#FFFFFF"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M12 21s-7.5-5.2-10-9.7C-0.2 7.4 2.6 3.5 6.4 3.9 8.3 4.1 10.2 5.4 12 7.6c1.8-2.2 3.7-3.5 5.6-3.7 3.8-.4 6.6 3.5 4.4 7.4C19.5 15.8 12 21 12 21z" />
    </svg>
  );
}

export default function Itinerary() {
  // Reduced-motion preference: the 1:1 scroll fill still reflects scroll
  // state (that's intentional state, not decoration), but we drop the soft
  // marker color tween so no decorative animation plays.
  const reduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // One slot per event for the marker element; we measure each marker's
  // vertical center against the container to decide if it is filled.
  const markerRefs = useRef<Array<HTMLDivElement | null>>([]);

  // `fillRatio` drives the overlay line height (0..1). `filledFlags[i]`
  // drives the per-marker fill state. Both start at neutral and are
  // recomputed on mount, scroll, and resize.
  const [fillRatio, setFillRatio] = useState(0);
  const [lineMetrics, setLineMetrics] = useState({ top: 0, height: 0 });
  const [filledFlags, setFilledFlags] = useState<boolean[]>(
    () => EVENTS.map(() => false),
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rafId = 0;

    const compute = () => {
      rafId = 0;
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const containerHeight = containerRect.height;
      if (containerHeight <= 0) return;

      const markerOffsets = EVENTS.map((_, i) => {
        const el = markerRefs.current[i];
        if (!el) return null;
        const markerRect = el.getBoundingClientRect();
        const markerCenter = (markerRect.top + markerRect.bottom) / 2;
        return markerCenter - containerRect.top;
      });

      const firstMarkerOffset = markerOffsets[0];
      const lastMarkerOffset = markerOffsets[markerOffsets.length - 1];
      if (firstMarkerOffset === null || lastMarkerOffset === null) return;

      const lineHeight = Math.max(0, lastMarkerOffset - firstMarkerOffset);
      setLineMetrics({ top: firstMarkerOffset, height: lineHeight });

      // Viewport reference point (~40% from the top). The progress range is
      // the marker-to-marker line segment, so the visible line begins at the
      // first circle center and ends at the last circle center — no leftover
      // line above or below the markers.
      const viewportRef = window.innerHeight * VIEWPORT_REF_RATIO;
      const lineTopInViewport = containerRect.top + firstMarkerOffset;
      const distance = viewportRef - lineTopInViewport;
      const ratio = lineHeight <= 0
        ? 0
        : Math.min(1, Math.max(0, distance / lineHeight));

      setFillRatio(ratio);

      const fillHeight = ratio * lineHeight;

      // A marker is filled if its vertical center, measured from the
      // container's top, sits at or below the fill height.
      const nextFilled = EVENTS.map((_, i) => {
        const markerOffsetFromContainerTop = markerOffsets[i];
        if (markerOffsetFromContainerTop === null) return false;
        return markerOffsetFromContainerTop <= firstMarkerOffset + fillHeight;
      });
      setFilledFlags(nextFilled);
    };

    const schedule = () => {
      // Coalesce scroll/resize into a single rAF pass so we never measure
      // more than once per frame.
      if (rafId) return;
      rafId = requestAnimationFrame(compute);
    };

    // Capture the initial state before any scroll event arrives so the line
    // and markers match the page's position on mount.
    compute();

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  // React prefers-reduced-motion is not queried via framer-motion here, but
  // the same preference is honored via a media query: skip the marker color
  // tween under reduced motion (the 1:1 scroll fill is intentional state, not
  // decorative motion, so it still reflects scroll position).
  return (
    <section
      id="itinerario"
      className="w-full px-6 pb-24 pt-10 sm:pb-32 sm:pt-12"
      style={{ backgroundColor: SECTION_BG }}
    >
      {/* Section title — Edwardian Script, large, dark, centered. Same clamp
          as the "Dónde y Cuándo" title so the chapter headings share one
          scale across sections. */}
      <h2
        className="mx-auto mb-20 text-center text-[clamp(3.25rem,6vw,3.75rem)] leading-none"
        style={{ ...EDWARDIAN, color: INK }}
      >
        Itinerario
      </h2>

      {/* Timeline container. position:relative so the absolutely-positioned
          lines (and row markers) anchor here, and so `getBoundingClientRect`
          measurements for marker offset are relative to this box. max-w-3xl
          mirrors the prose rhythm of neighboring sections. */}
      <div ref={containerRef} className="relative mx-auto w-full max-w-3xl">
        {/* Base line — marker-to-marker height, cream. It starts at the first
            circle center and ends at the last circle center so there is no
            leftover line above or below the timeline markers. */}
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            top: lineMetrics.top,
            left: LINE_LEFT_PX,
            width: LINE_WIDTH_PX,
            height: lineMetrics.height,
            backgroundColor: LINE_UNFILLED,
          }}
        />

        {/* Overlay line — dynamic navy height from the first marker center.
            It tracks scroll 1:1 with no easing and never extends beyond the
            marker-to-marker segment. */}
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            top: lineMetrics.top,
            left: LINE_LEFT_PX,
            width: LINE_WIDTH_PX,
            height: lineMetrics.height * fillRatio,
            backgroundColor: LINE_FILLED,
            transition: "none",
          }}
        />

        <ol className="m-0 list-none p-0">
          {EVENTS.map((event, i) => {
            const filled = filledFlags[i];
            return (
              <li
                key={event.id}
                // Use margin (not padding) for inter-event spacing so each
                // row's bottom border coincides with the icon's bottom edge.
                // That invariant is what lets the marker use a fixed
                // `bottom` offset to align with the icon's midpoint.
                // ~500-600px of breathing room per event gives roughly one
                // viewport scroll segment on desktop and a calmer rhythm on
                // mobile.
                className="relative mb-[120px] last:mb-0 sm:mb-[160px] sm:last:mb-0"
              >
                {/* Marker — anchored at the icon's vertical midpoint. The
                    ref is stored so the scroll handler can measure its
                    vertical center against the container. */}
                <div
                  ref={(el) => {
                    markerRefs.current[i] = el;
                  }}
                  className="absolute z-10"
                  style={{
                    // Center the marker horizontally on the line. The line
                    // center sits at LINE_LEFT_PX + LINE_WIDTH_PX/2; the
                    // marker is MARKER_SIZE_PX wide, so its left = center -
                    // MARKER_SIZE_PX/2.
                    left:
                      LINE_LEFT_PX + LINE_WIDTH_PX / 2 - MARKER_SIZE_PX / 2,
                    bottom: MARKER_BOTTOM_PX,
                    width: MARKER_SIZE_PX,
                    height: MARKER_SIZE_PX,
                  }}
                >
                  <div
                    className="flex h-full w-full items-center justify-center rounded-full"
                    style={{
                      backgroundColor: filled ? LINE_FILLED : LINE_UNFILLED,
                      transition: reduceMotion
                        ? "none"
                        : `background-color ${MARKER_COLOR_TRANSITION_MS}ms ease-out`,
                    }}
                  >
                    <Heart filled={filled} />
                  </div>
                </div>

                {/* Text column. Padded left so the time / title / icon sit
                    to the right of the line + marker column. The icon is
                    the last child so the marker's `bottom`-anchored center
                    coincides with the icon's vertical midpoint. */}
                <div
                  className="flex flex-col items-center text-center"
                  style={{
                    // Line column reserves ~LINE_LEFT_PX + MARKER_SIZE_PX
                    // plus a little air; 100px keeps the text comfortably
                    // off the line on mobile and tracks the desktop rhythm
                    // because the layout is fluid within max-w-3xl.
                    paddingLeft: 100,
                    paddingRight: 16,
                  }}
                >
                  {/* Time label — Baskervville, uppercase, ~2px tracking per
                      brief. */}
                  <span
                    className="text-[1rem] uppercase"
                    style={{
                      ...BASKERVVILLE,
                      color: NAVY_TEXT,
                      letterSpacing: "0.125em",
                    }}
                  >
                    {event.time}
                  </span>

                  {/* Event name — Edwardian Script, ~36px, dark. Matches
                      the card-title size used in the "Dónde y Cuándo"
                      section so the script titles share one scale. */}
                  <h3
                    className="mt-3 text-[2.25rem] leading-none"
                    style={{ ...EDWARDIAN, color: INK }}
                  >
                    {event.title}
                  </h3>

                  {/* Decorative icon, ~200x200, centered beneath the event
                      name. Empty alt: the icon is decorative, and the
                      time + name already describe the row to assistive
                      tech. */}
                  <Image
                    src={event.icon}
                    alt=""
                    width={ICON_SIZE_PX}
                    height={ICON_SIZE_PX}
                    className="mt-6 h-auto w-[200px] max-w-full select-none"
                    sizes="200px"
                    draggable={false}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
