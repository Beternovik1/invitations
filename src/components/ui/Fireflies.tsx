"use client";

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Ambient firefly field over the hero.
 *
 * Positions are generated deterministically from a small PRNG seeded by index
 * so the server-rendered markup matches the client's first render (no
 * hydration mismatch from `Math.random()`). The visitor's actual momentary
 * drift is animated purely with CSS so it is cheap for INP.
 */

interface Firefly {
  id: number;
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  driftX: string;
  driftY: string;
}

const FIREFLY_COUNT = 22;

// Tiny mulberry32-style PRNG so SSR and CSR produce identical sequences.
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFireflies(): Firefly[] {
  const rand = prng(20260716); // stable seed
  return Array.from({ length: FIREFLY_COUNT }, (_, id) => {
    const driftX = (rand() - 0.5) * 60;
    const driftY = (rand() - 0.5) * 60;
    return {
      id,
      top: `${(rand() * 92).toFixed(2)}%`,
      left: `${(rand() * 92).toFixed(2)}%`,
      size: 2 + Math.floor(rand() * 3),
      duration: 9 + rand() * 12,
      delay: rand() * -14,
      driftX: `${driftX.toFixed(1)}px`,
      driftY: `${driftY.toFixed(1)}px`,
    };
  });
}

export default function Fireflies() {
  const reduceMotion = useReducedMotion();
  const fireflies = useMemo(() => buildFireflies(), []);

  if (reduceMotion) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {fireflies.map((f) => (
        <span
          key={f.id}
          className="firefly absolute rounded-full"
          style={{
            top: f.top,
            left: f.left,
            width: f.size,
            height: f.size,
            background: "#fbfde9",
            boxShadow: "0 0 8px 2px rgba(199, 154, 60, 0.8)",
            // CSS vars consumed by the firefly-drift keyframe.
            ["--drift-duration" as string]: `${f.duration}s`,
            ["--drift-delay" as string]: `${f.delay}s`,
            ["--drift-x" as string]: f.driftX,
            ["--drift-y" as string]: f.driftY,
          }}
        />
      ))}
    </div>
  );
}
