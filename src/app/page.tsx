import Hero from "@/components/sections/Hero";

/**
 * Invitation landing page.
 *
 * The hero visual prototype is the only surface here for now; subsequent
 * slices will add details, RSVP, and admin sections.
 */
export default function Home() {
  return (
    <main className="flex w-full flex-col">
      <Hero />
    </main>
  );
}