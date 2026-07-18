import type { ReactNode } from "react";

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
export default function InvitationContent({
  rsvpSlot,
  showMusicButton = true,
}: {
  /**
   * Optional RSVP section rendered after the hero. Only the personalized route
   * (`/i/[slug]`) passes it; the public landing route (`/`) passes nothing, so
   * its behavior and output are unchanged. Passing it as a slot (rather than
   * importing the section here) keeps the shared invitation ignorant of which
   * entry point renders it, so the invitation never forks between routes.
   *
   * Its presence also hides the hero's "Pronto podrás confirmar tu asistencia"
   * teaser: the personalized route has a real RSVP section, so the two lines
   * must never contradict each other. The public route passes nothing, keeps
   * the teaser, and is unchanged.
   */
  rsvpSlot?: ReactNode;
  /**
   * Whether `InvitationContent` renders its own `FloatingMusicButton`. The
   * public route (`/`) leaves this true (default) for the original manual
   * play button behavior. The personalized route (`/i/[slug]`) sets it to
   * `false` so the control owned by `<EnvelopeGate>` is the only one — that
   * control is mounted before the envelope opens so the "Abrir invitación"
   * tap can start playback as a user gesture, then becomes the
   * pause/resume button after opening.
   */
  showMusicButton?: boolean;
}) {
  const hideRsvpSoon = Boolean(rsvpSlot);
  return (
    <main className="relative isolate flex w-full flex-col">
      <div className="page-atmosphere" aria-hidden="true" />

      <OrnamentalFrame />

      <Hero hideRsvpSoon={hideRsvpSoon} />
      {rsvpSlot}
      <Locations />
      <Itinerary />
      <DressCode />
      <Gallery />
      <MusicSection />

      {showMusicButton ? <FloatingMusicButton /> : null}
    </main>
  );
}
