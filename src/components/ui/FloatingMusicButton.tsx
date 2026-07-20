"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { MUSIC } from "@/lib/constants";

/**
 * Imperative surface exposed by `<FloatingMusicButton>` through a ref.
 *
 * `play()` exists so a parent component (e.g. `<EnvelopeGate>`) can kick off
 * playback from inside its own user-gesture handler — the "Abrir invitación"
 * tap — without having to reach into the audio element directly. This matters
 * because browsers only honor programmatic `play()` when it runs inside a user
 * activation; exposing `play()` lets the envelope-open tap double as the
 * gesture that unlocks audio, while the visible button stays mounted and
 * ready to pause/resume afterwards.
 */
export interface FloatingMusicButtonHandle {
  /** Best-effort start of playback. Rejects softly on `NotAllowedError` and
   *  `AbortError`; never throws to the caller. */
  play: () => Promise<void>;
  /** Toggle play/pause — mirrors the visible button's behavior so a parent
   *  could expose keyboard shortcuts if needed. */
  toggle: () => Promise<void>;
}

interface FloatingMusicButtonProps {
  /**
   * When true, only the `<audio>` element is mounted (no visible UI). Used on
   * the personalized route so the audio element exists before the envelope is
   * opened — the open tap can then call `play()` on it as a user gesture —
   * while no duplicate floating button is shown until the gate is opened.
   *
   * The element is intentionally still rendered (not returned as `null`) so
   * the ref stays attached and the audio instance is warm.
   */
  hidden?: boolean;
}

/**
 * Persistent, single-song, user-controlled music control pinned to a corner of
 * the invitation.
 *
 * Playback is strictly user-initiated — no autoplay, no programmatic play on
 * mount or scroll. The `<audio>` element only renders when `MUSIC.enabled` is
 * true AND `MUSIC.audioPath` is non-empty, so the page never wires a missing
 * audio file against an active `<audio>`. While disabled the control renders a
 * calm, on-brand "soon" state that stays tappable out of curiosity without
 * starting anything. Play-promise rejections are absorbed (NotAllowedError,
 * AbortError) so a browser that blocks playback never throws to the console.
 *
 * It is `fixed` so it stays in its corner across the whole single-page scroll,
 * above the content (z-index higher than the section stack). Safe-area spacing
 * keeps it off the rounded screen edges and notches, and a responsive gap keeps
 * it clear of tiny-phone content. Reduced-motion visitors get the same control
 * with no motion.
 */
const FloatingMusicButton = forwardRef<
  FloatingMusicButtonHandle,
  FloatingMusicButtonProps
>(function FloatingMusicButton({ hidden = false }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const enabled = MUSIC.enabled && MUSIC.audioPath.length > 0;

  // Keep local state in sync with the audio element's real events so pause
  // from system media controls, sleep, or another tab is reflected here too.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onPlay = () => {
      setIsPlaying(true);
      setBlocked(false);
    };
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      // `loop` is false by default; when not looping, rewind so the next tap
      // replays from the start rather than the paused end.
      if (!MUSIC.loop) el.currentTime = 0;
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  // Start playback (best-effort). The promise is awaited so NotAllowedError
  // surfaces cleanly; rejections are absorbed so a browser that blocks audio
  // never throws to the console or to the caller using `play()` on the ref.
  const play = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;

    setBlocked(false);
    try {
      await el.play();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "AbortError") return;
      setIsPlaying(false);
      setBlocked(true);
    }
  }, []);

  const toggle = useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;

    if (isPlaying) {
      el.pause();
      return;
    }
    await play();
  }, [isPlaying, play]);

  useImperativeHandle(
    ref,
    () => ({ play, toggle }),
    [play, toggle],
  );

  // The audio element must render before any gesture can call `play()`, so it
  // is mounted even when the UI is hidden (used on the personalized route to
  // warm the audio instance for the envelope-open tap).
  if (!enabled) {
    return (
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-1.5 sm:bottom-8 sm:right-8 lg:bottom-10 lg:right-10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingRight: "env(safe-area-inset-right)" }}
      >
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="Reproductor de música próximamente disponible"
          className="pointer-events-auto inline-flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full border border-[#2E3E50] bg-[#2E3E50] text-white opacity-60 shadow-[0_8px_22px_rgba(33,58,50,0.22)] sm:h-14 sm:w-14"
        >
          <NoteGlyph />
        </button>
      </div>
    );
  }

  // ----- Active state: audio is wired, user controls playback --------------
  const buttonLabel = isPlaying
    ? `Pausar ${MUSIC.title}`
    : `Reproducir ${MUSIC.title}`;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-1.5 transition-opacity sm:bottom-8 sm:right-8 lg:bottom-10 lg:right-10 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden ? "true" : undefined}
      style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingRight: "env(safe-area-inset-right)" }}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={buttonLabel}
        aria-pressed={isPlaying}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#2E3E50] bg-[#2E3E50] text-white shadow-[0_8px_22px_rgba(33,58,50,0.28)] transition-[filter,transform] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7A96A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-cream-white)] sm:h-14 sm:w-14"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
      </button>

      {blocked && (
        <span
          className="max-w-[14rem] rounded-full bg-[var(--color-cream-white)]/85 px-3 py-1 text-center font-sans text-[0.66rem] text-[var(--color-ink-dim)] shadow-[0_6px_18px_rgba(33,58,50,0.18)] backdrop-blur"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          El navegador bloqueó la reproducción. Toca de nuevo.
        </span>
      )}

      {/* The <audio> element renders only when a real track is configured. */}
      <audio
        ref={audioRef}
        src={MUSIC.audioPath}
        loop={MUSIC.loop}
        preload="none"
      />
    </div>
  );
});

FloatingMusicButton.displayName = "FloatingMusicButton";

export default FloatingMusicButton;

/* -------------------------------------------------------------------------- */
/*  Decorative glyphs                                                         */
/* -------------------------------------------------------------------------- */

function NoteGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none">
      <path
        d="M9 17.5a2.5 2.5 0 1 1-2.5-2.5A2.5 2.5 0 0 1 9 17.5Z"
        fill="currentColor"
        opacity="0.7"
      />
      <path
        d="M8.5 15V5.2a1 1 0 0 1 .74-.97l7-1.8A1 1 0 0 1 17.5 3.4v9.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M17.5 14.5a2.5 2.5 0 1 1-2.5-2.5 2.5 2.5 0 0 1 2.5 2.5Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" fill="none">
      <path
        d="M8 5.5v13a1 1 0 0 0 1.52.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" fill="none">
      <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}
