import DressCode from "@/components/sections/DressCode";
import Gallery from "@/components/sections/Gallery";
import Hero from "@/components/sections/Hero";
import Itinerary from "@/components/sections/Itinerary";
import Locations from "@/components/sections/Locations";
import MusicSection from "@/components/sections/MusicSection";
import FloatingMusicButton from "@/components/ui/FloatingMusicButton";
import OrnamentalFrame from "@/components/ui/OrnamentalFrame";

/**
 * The invitation itself: one scrollable composition shared by every entry point.
 *
 * Both the public landing route (`/`) and the personalized route
 * (`/i/[slug]`) render this same content so the invitation never forks. The
 * personalized route simply gates it behind `<EnvelopeGate>`; once the guest
 * opens their envelope, this is what they see.
 *
 * Two page-level ornaments carry the whole scroll:
 *   1. `.page-atmosphere` — the fixed continuous backdrop (z-index -1).
 *   2. `<OrnamentalFrame>` — a `fixed` gold border pinned to the viewport from
 *      the hero through the last element so the whole invitation reads as one
 *      framed composition. `aria-hidden` + `pointer-events-none`, above the
 *      atmosphere and below the section content.
 * `<FloatingMusicButton>` is the single user-controlled music control: fixed in
 * a corner inside the frame, above the content, no autoplay, and the only place
 * an `<audio>` element is allowed to render.
 */
export default function InvitationContent() {
  return (
    <main className="relative isolate flex w-full flex-col">
      <div className="page-atmosphere" aria-hidden="true" />

      <OrnamentalFrame />

      <Hero />
      <Locations />
      <Itinerary />
      <DressCode />
      <Gallery />
      <MusicSection />

      <FloatingMusicButton />
    </main>
  );
}
