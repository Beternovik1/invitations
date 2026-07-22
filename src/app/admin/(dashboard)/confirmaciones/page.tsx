import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminPageHeader from "@/app/admin/_components/AdminPageHeader";
import ConfirmationsView from "@/app/admin/(dashboard)/confirmaciones/ConfirmationsView";
import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";
import { getActiveGuestGroupsWithRsvp } from "@/lib/admin-overview";

/**
 * Unified Confirmaciones admin page.
 *
 * Mom asked for a single mobile-first screen that combines the overview's
 * "who confirmed" list with the editor's copy-link action and a manual
 * "Enviada" toggle for dad. This first slice delivers the foundation using
 * the SAME admin styles as the existing pages (no professional redesign yet)
 * and reuses the existing read-only data boundary instead of adding a new
 * one — `getActiveGuestGroupsWithRsvp` already returns active groups with
 * their RSVP joined in, exactly the shape this view needs.
 *
 * Server Component: the service-role Supabase access and the cookie
 * verification both run on the server, so nothing private is shipped to the
 * browser. Like the other admin pages, auth is re-verified immediately before
 * the private fetch — the security decision stays next to the data even
 * though the dashboard layout already gates the whole route group.
 *
 * The personal invitation link is passed to the client view as a SAFE PATH
 * (`/i/[slug]`), not as a server-built absolute URL carrying the origin: the
 * client composes `window.location.origin` at copy time, the same pattern the
 * guest-group editor's `CopyInvitationButton` already uses. No service-role
 * key or Supabase URL ever reaches the client.
 *
 * This page is intentionally NOT linked from the dashboard sidebar yet (the
 * host wants to approve it visually first); it is reachable directly at
 * `/admin/confirmaciones`. The legacy `/admin/rsvps` and
 * `/admin/guest-groups` pages are untouched.
 */
export const metadata: Metadata = {
  title: "Confirmaciones",
};

export default async function AdminConfirmacionesPage() {
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  const groups = await getActiveGuestGroupsWithRsvp();

  return (
    <section>
      <AdminPageHeader title="Confirmaciones" eyebrow="administrador" />

      <div className="mb-6 max-w-3xl space-y-3 text-sm leading-relaxed text-(--color-ink-dim)">
        <p>
          Vista unificada por familia: copia el enlace de cada grupo, revisa los
          seis indicadores (lugares, confirmaciones, invitaciones, respuestas,
          enviadas en esta sesión y sin lugares), filtra por estado y marca
          &ldquo;Enviada&rdquo; a mano. Es una base funcional con el estilo actual
          del administrador; todavía no reemplaza las pantallas de Confirmaciones
          ni de Modificar invitados.
        </p>

        <p>
          <strong>Estados:</strong> Sin lugares significa que todavía falta
          asignar lugares; Sin respuesta significa que la invitación tiene
          lugares pero aún no confirmaron; Enviada significa que marcaste a mano
          que ya mandaste el enlace; Confirmada significa que ya respondieron
          con asistentes; Sin asistencia significa que confirmaron que no
          asistirán.
        </p>

        <p>
          Recuerda marcar una invitación como &ldquo;Enviada&rdquo; después de mandar
          el enlace por WhatsApp, para llevar control de cuáles ya compartiste.
        </p>
      </div>

      <ConfirmationsView groups={groups} />
    </section>
  );
}
