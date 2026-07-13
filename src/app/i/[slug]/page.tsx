import type { Metadata } from "next";
import { notFound } from "next/navigation";

import EnvelopeGate from "@/components/ui/EnvelopeGate";
import InvitationContent from "@/components/InvitationContent";
import { ASSETS, EVENT, SITE } from "@/lib/constants";
import {
  getAllGuestGroupSlugs,
  getGuestGroupBySlug,
} from "@/lib/guest-groups";

/**
 * Personalized invitation route.
 *
 * `/i/[slug]` addresses one guest group (a family or named invitee). The page
 * presents an `<EnvelopeGate>` showing the group's name and assigned seats; once
 * the guest opens it, the same shared `<InvitationContent>` as the public
 * landing page renders — the invitation never forks between entry points.
 *
 * Only slugs present in the mock guest-group data are valid. `dynamicParams =
 * false` makes any other slug resolve to Next's `notFound()` at the routing
 * layer, so the route stays fully static and there is no on-demand rendering
 * (no backend yet).
 */
export const dynamicParams = false;

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllGuestGroupSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const group = getGuestGroupBySlug(slug);
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
  const group = getGuestGroupBySlug(slug);
  if (!group) notFound();

  return (
    <EnvelopeGate group={group}>
      <InvitationContent />
    </EnvelopeGate>
  );
}
