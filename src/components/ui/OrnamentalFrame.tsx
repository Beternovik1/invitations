/**
 * Responsive ornamental frame.
 *
 * Replaces the previous raster border overlay (`public/border.jpeg`) with a
 * fully vector border inspired by that image: a gold double frame, subtle
 * floral corner curls, a pink gem crowning the top edge, and a dusty-teal gem
 * anchoring the bottom edge.
 *
 * The frame is decorative only (`aria-hidden`, `pointer-events-none`) and
 * composites three SVG layers so it adapts to any aspect ratio without
 * distortion:
 *
 *   1. A full-bleed frame SVG stretched with `preserveAspectRatio="none"` to
 *      reach all four edges on both mobile and desktop. Only straight rules
 *      live here — straight lines stay clean even when stretched, and their
 *      stroke uses `vector-effect="non-scaling-stroke"` so the line weight is
 *      constant regardless of the container's dimensions.
 *   2. Four floral corner SVGs (`preserveAspectRatio="xMidYMid meet"`,
 *      fixed pixel size) pinned to each corner so the curls never squash or
 *      stretch.
 *   3. Two gem SVGs (top = pink, bottom = dusty-teal) centered on the frame's
 *      top/bottom rules.
 *
 * The wrapper accepts `className` so the caller controls the positioning and
 * inset/padding. At page level it is mounted `fixed` so the border stays
 * pinned to the viewport across the entire single-page scroll, framing every
 * section from the hero through the last element; `pointer-events-none` keeps
 * it from blocking interaction and a low z-index keeps it above the continuous
 * `.page-atmosphere` backdrop but below the section content.
 */

interface OrnamentalFrameProps {
  /** Tailwind classes for the wrapper — positioning plus `inset-*` to tune how
   *  close the frame sits to the viewport edges across breakpoints. Defaults
   *  to a `fixed` page-level frame so the border carries across the whole
   *  scroll. */
  className?: string;
}

/* Palette — local to this decorative component so the frame stays self-
   contained and easy to retune without touching global tokens. */
const GOLD = "#c79a3c";
const GOLD_BRIGHT = "#f2d27a";
const GOLD_SOFT = "#9c7320";
const PINK_GEM = "#d98fa8";
const PINK_GEM_LIGHT = "#f3c6d6";
const TEAL_GEM = "#77a291";
const TEAL_GEM_LIGHT = "#b9d4c9";

export default function OrnamentalFrame({
  className = "fixed inset-3 sm:inset-4 lg:inset-5",
}: OrnamentalFrameProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none z-0 ${className}`}
    >
      {/* --- Layer 1: full-bleed straight gold frame ---------------------- */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        {/* Outer hairline rule. */}
        <rect
          x="0.6"
          y="0.6"
          width="98.8"
          height="98.8"
          stroke={GOLD_SOFT}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* Main gold rule — the dominant frame line. */}
        <rect
          x="2.4"
          y="2.4"
          width="95.2"
          height="95.2"
          stroke={GOLD}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* Inner hairline rule — gives the frame its double-line character. */}
        <rect
          x="4.2"
          y="4.2"
          width="91.6"
          height="91.6"
          stroke={GOLD_BRIGHT}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* --- Layer 2: floral corner curls --------------------------------- */}
      <CornerFloral className="left-0 top-0" />
      <CornerFloral className="right-0 top-0" flipX />
      <CornerFloral className="left-0 bottom-0" flipY />
      <CornerFloral className="right-0 bottom-0" flipX flipY />

      {/* --- Layer 3: gems on the top and bottom rules -------------------- */}
      <Gem
        className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
        base={PINK_GEM}
        light={PINK_GEM_LIGHT}
        dark={GOLD_SOFT}
        label="top-gem"
      />
      <Gem
        className="left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2"
        base={TEAL_GEM}
        light={TEAL_GEM_LIGHT}
        dark={GOLD_SOFT}
        label="bottom-gem"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

interface CornerFloralProps {
  className: string;
  flipX?: boolean;
  flipY?: boolean;
}

/**
 * A single floral corner curl. Drawn in a square viewBox and mirrored via
 * `scaleX(-1)` / `scaleY(-1)` so one motif serves all four corners without
 * duplicating path data. The wrapper is pinned to a corner with `className`
 * and sized at 56px (clamp-friendly: smaller on mobile).
 */
function CornerFloral({ className, flipX, flipY }: CornerFloralProps) {
  const scale = `scale(${flipX ? -1 : 1} ${flipY ? -1 : 1})`;
  return (
    <svg
      className={`absolute h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 ${className}`}
      viewBox="0 0 64 64"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      style={{ transform: scale, transformOrigin: "center" }}
    >
      {/* Primary vine curling out of the corner toward the frame interior. */}
      <path
        d="M4 4 C 20 6, 30 12, 34 22 C 37 30, 33 38, 26 40"
        stroke={GOLD}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Secondary thinner companion vine for depth. */}
      <path
        d="M4 4 C 16 12, 22 20, 24 30"
        stroke={GOLD_BRIGHT}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Small leaf on the primary vine. */}
      <path
        d="M30 24 C 36 22, 42 26, 40 32 C 34 33, 28 30, 30 24 Z"
        fill={GOLD_SOFT}
        opacity="0.32"
      />
      <path
        d="M30 24 C 36 22, 42 26, 40 32"
        stroke={GOLD}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Bud dot at the vine terminus. */}
      <circle cx="26" cy="40" r="2.4" fill={GOLD} />
      {/* A couple of accent dots like scattered pollen. */}
      <circle cx="14" cy="16" r="1.1" fill={GOLD_BRIGHT} />
      <circle cx="20" cy="9" r="0.9" fill={GOLD_SOFT} />
    </svg>
  );
}

interface GemProps {
  className: string;
  base: string;
  light: string;
  dark: string;
  label: string;
}

/**
 * A small faceted gem rendered as a scaled-diamond silhouette with a lighter
 * facet and a gold bezel. Sits centered on a frame rule.
 */
function Gem({ className, base, light, dark, label }: GemProps) {
  return (
    <svg
      className={`h-7 w-7 sm:h-9 sm:w-9 ${className}`}
      viewBox="0 0 48 48"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      fill="none"
    >
      {/* Gold bezel. */}
      <path
        d="M24 3 L43 17 L24 45 L5 17 Z"
        stroke={GOLD}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Gem body. */}
      <path d="M24 6 L40 17 L24 42 L8 17 Z" fill={base} />
      {/* Upper facet highlight. */}
      <path d="M24 6 L40 17 L24 17 Z" fill={light} opacity="0.85" />
      {/* Lower facet shadow. */}
      <path d="M24 17 L40 17 L24 42 Z" fill={dark} opacity="0.22" />
      {/* Table line. */}
      <path
        d="M8 17 L40 17"
        stroke={dark}
        strokeWidth="1"
        opacity="0.5"
      />
      {/* Sparkle. */}
      <circle cx="19" cy="12" r="1.1" fill="#fff" opacity="0.85" />
    </svg>
  );
}