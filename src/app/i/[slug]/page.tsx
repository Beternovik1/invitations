import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EnvelopeGate from "@/components/ui/EnvelopeGate";
import InvitationContent from "@/components/InvitationContent";
import RsvpSection from "@/components/sections/Rsvp";
import { ASSETS, EVENT, SITE } from "@/lib/constants";
import { getGuestGroupBySlug, isSupabaseConfigured } from "@/lib/guest-groups";
import { getRsvpBySlug } from "@/lib/rsvps";

/**
 * Personalized invitation route.
 *
 * `/i/[slug]` addresses one guest group (a family or named invitee). The page
 * presents an `<EnvelopeGate>` showing the group's name and assigned seats; once
 * the guest opens it, the same shared `<InvitationContent>` as the public
 * landing page renders — the invitation never forks between entry points.
 *
 * The group is resolved through the guest-group data boundary
 * (`src/lib/guest-groups.ts`), which reads from Supabase when configured and
 * falls back to in-repo mock data otherwise.
 *
 * Rendering mode: `force-dynamic` (per request).
 *
 * The route is dynamic on purpose. The `is_active` soft-delete flag only means
 * something if deactivating a group immediately stops its link from rendering —
 * a statically prerendered page would keep serving a deactivated group until the
 * next rebuild, defeating the flag. Dynamic rendering makes soft-deletes and
 * admin seat-count edits live without a rebuild.
 *
 * Next 16 requires route segment config to be a statically parseable literal,
 * so the render mode cannot branch on env within one route file. Dynamic is
 * chosen because it is the mode that satisfies the soft-delete requirement. In
 * mock mode (no Supabase env) the route is still dynamic, but it reads the
 * in-memory mock array (`GUEST_GROUPS`) — cheap, no network — so the build
 * succeeds with zero config and local dev behaves the same as before.
 *
 * Tradeoff: each request incurs a render (and, in Supabase mode, a DB
 * round-trip) and the route requires a Node runtime (Vercel provides this). The
 * previous slice's 9 prerendered SSG pages are replaced by per-request render;
 * the user-visible behavior (envelope -> invitation, unknown slugs 404) is
 * unchanged.
 */

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const group = await getGuestGroupBySlug(slug);
  if (!group) return {};

  const title = `Invitación para ${group.displayName} · ${SITE.title}`;
  const description = `${EVENT.celebrantName} invita a ${group.displayName} a celebrar sus XV años.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: SITE.locale,
      siteName: SITE.title,
      images: [
        {
          url: ASSETS.ogImage,
          width: 1200,
          height: 630,
          alt: "Sarahí — celebración de XV años",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ASSETS.ogImage],
    },
  };
}

export default async function InvitationPage({ params }: Props) {
  const { slug } = await params;
  const group = await getGuestGroupBySlug(slug);
  // The boundary returns null for unknown slugs AND for inactive (soft-deleted)
  // groups, so both resolve to a 404 here.
  if (!group) notFound();

  // Prefetch the group's existing RSVP so the form can prefill / show the
  // current response. Memoized per request via React `cache`, so this and any
  // other read in the same request share a single Supabase round-trip. When
  // Supabase is not configured, the boundary returns null (mock mode refuses
  // to pretend a confirmation exists).
  const initialRsvp = await getRsvpBySlug(slug);
  const rsvpEnabled = isSupabaseConfigured();

  return (
    <EnvelopeGate group={group}>
      <InvitationContent
        rsvpSlot={
          <RsvpSection
            group={group}
            initialRsvp={initialRsvp}
            rsvpEnabled={rsvpEnabled}
          />
        }
      />
    </EnvelopeGate>
  );
}
