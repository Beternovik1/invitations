/**
 * Original frog-and-lily illustration.
 *
 * Built from simple SVG primitives only. The silhouette intentionally reads as
 * a friendly frog first: large raised eyes, round body, smile, and webbed feet.
 */

interface FrogIllustrationProps {
  className?: string;
  animated?: boolean;
}

export default function FrogIllustration({
  className,
  animated = true,
}: FrogIllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 190"
      className={className}
      role="img"
      aria-label="Una rana sonriente sobre una hoja de lirio"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="frog-body" cx="45%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#d3dd8f" />
          <stop offset="58%" stopColor="#8fb85c" />
          <stop offset="100%" stopColor="#3f6b3f" />
        </radialGradient>
        <radialGradient id="lily-pad" cx="50%" cy="38%" r="72%">
          <stop offset="0%" stopColor="#d3dd8f" />
          <stop offset="100%" stopColor="#3f6b3f" />
        </radialGradient>
        <linearGradient id="amber-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7d8" />
          <stop offset="45%" stopColor="#e8a752" />
          <stop offset="100%" stopColor="#9a6725" />
        </linearGradient>
      </defs>

      <path
        d="M34 166 q38 -10 86 0 q48 10 86 0"
        stroke="#fff7d8"
        strokeWidth="2"
        opacity="0.55"
      />

      <g className={animated ? "frog-bob" : undefined}>
        <path
          d="M30 139 C58 111 97 105 121 123 C145 105 184 111 210 139 C173 151 68 151 30 139 Z"
          fill="url(#lily-pad)"
          stroke="url(#amber-line)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M121 123 L155 139 M121 123 L92 139 M121 123 L121 147"
          stroke="#24402a"
          strokeWidth="1.4"
          opacity="0.45"
          strokeLinecap="round"
        />

        <g stroke="#24402a" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="88" cy="70" r="20" fill="url(#frog-body)" strokeWidth="3" />
          <circle cx="152" cy="70" r="20" fill="url(#frog-body)" strokeWidth="3" />

          <ellipse
            cx="120"
            cy="107"
            rx="55"
            ry="42"
            fill="url(#frog-body)"
            strokeWidth="3"
          />

          <circle cx="88" cy="70" r="10" fill="#fff7d8" strokeWidth="2" />
          <circle cx="152" cy="70" r="10" fill="#fff7d8" strokeWidth="2" />
          <circle cx="91" cy="72" r="4" fill="#182f20" />
          <circle cx="149" cy="72" r="4" fill="#182f20" />

          <path d="M98 115 Q120 129 142 115" strokeWidth="3" fill="none" />
          <circle cx="100" cy="104" r="3" fill="#24402a" stroke="none" />
          <circle cx="140" cy="104" r="3" fill="#24402a" stroke="none" />

          <path d="M78 126 C61 131 54 142 46 153" strokeWidth="3" fill="none" />
          <path d="M162 126 C179 131 186 142 194 153" strokeWidth="3" fill="none" />
          <path d="M47 153 l-11 2 l9 -8 m2 6 l7 -9" strokeWidth="2.6" fill="none" />
          <path d="M193 153 l11 2 l-9 -8 m-2 6 l-7 -9" strokeWidth="2.6" fill="none" />
        </g>

        <path
          d="M92 35 C102 20 137 20 148 35"
          stroke="url(#amber-line)"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx="120" cy="25" r="3" fill="#e8a752" />
      </g>
    </svg>
  );
}
