import DressCode from "@/components/sections/DressCode";
import Gallery from "@/components/sections/Gallery";
import Hero from "@/components/sections/Hero";
import Itinerary from "@/components/sections/Itinerary";
import Locations from "@/components/sections/Locations";
import MusicSection from "@/components/sections/MusicSection";
import FloatingMusicButton from "@/components/ui/FloatingMusicButton";
import OrnamentalFrame from "@/components/ui/OrnamentalFrame";

/**
 * Invitation landing page.
 *
 * A single scrollable invitation: the hero opens the night, then the place,
 * program, dress code, gallery, and music sections continue the same visual
 * language. All event copy comes from `@/lib/constants`; this slice is visual
 * only — no RSVP form or backend is wired up yet.
 *
 * Two page-level ornaments carry the whole scroll rather than the hero alone:
 *   1. `.page-atmosphere` — the fixed continuous backdrop (z-index -1).
 *   2. `<OrnamentalFrame>` — a `fixed` gold border that stays pinned to the
 *      viewport from the hero through the last element so the whole invitation
 *      reads as one framed composition. It is `aria-hidden` +
 *      `pointer-events-none`, sits above the atmosphere and below the section
 *      content, and uses responsive insets so it never crowds tiny phones.
 * `<FloatingMusicButton>` is the single user-controlled music control: fixed in
 * a corner inside the frame, above the content, no autoplay, and the only place
 * an `<audio>` element is allowed to render.
 */
export default function Home() {
  return (
    <main className="relative isolate flex w-full flex-col">
      {/* Continuous page atmosphere: one fixed backdrop that carries the
          whole single-page scroll so the tone journey (cream → pale-yellow
          → sage → dusty teal) reads as one continuous mood instead of a
          fresh color block per section. Decorative only — kept out of the
          a11y tree and interaction path. */}
      <div className="page-atmosphere" aria-hidden="true" />

      {/* Page-level ornamental frame: pinned to the viewport so the gold
          border and corner motifs frame the entire invitation across the
          whole scroll, not just the hero. Mounted above the atmosphere
          (z-0) and below the section content (which is positioned later in
          the DOM), `pointer-events-none` keeps it from intercepting taps and
          its responsive insets keep it clear of small screens. */}
      <OrnamentalFrame />

      <Hero />
      <Locations />
      <Itinerary />
      <DressCode />
      <Gallery />
      <MusicSection />

      {/* Persistent music control: the one and only play/pause affordance for
          the celebration song. Fixed to a corner inside the frame, above the
          content, user-controlled only. */}
      <FloatingMusicButton />
    </main>
  );
}
