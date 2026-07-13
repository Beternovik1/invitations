import InvitationContent from "@/components/InvitationContent";

/**
 * Public invitation landing page.
 *
 * Renders the shared invitation content directly. The personalized route
 * (`/i/[slug]`) renders the same content behind an `<EnvelopeGate>` so the
 * invitation never forks between entry points. This slice is visual only — no
 * RSVP form or backend is wired up yet.
 */
export default function Home() {
  return <InvitationContent />;
}
