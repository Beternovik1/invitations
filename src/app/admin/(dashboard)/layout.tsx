import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminDashboardChrome from "@/app/admin/_components/AdminDashboardChrome";
import AdminShell from "@/app/admin/_components/AdminShell";
import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";

/**
 * Shared layout for every admin dashboard route (RSVP overview, guest groups,
 * and future admin sections).
 *
 * Centralizes the access model that each admin page used to repeat:
 *
 *   1. If `ADMIN_ACCESS_KEY` is not set in the environment, render a
 *      setup-required screen and never fetch guest data — the host sees an
 *      obvious message instead of a confusing empty dashboard on a
 *      misconfigured deploy. This screen has no sidebar: with no key
 *      configured, navigation is meaningless.
 *   2. If the env key is set but the request carries no valid signed admin
 *      session cookie, redirect to `/admin/login`. The access key is never
 *      placed in a URL; it is exchanged for a cookie once at login.
 *   3. Only after the cookie is verified do we render the dashboard chrome
 *      and the page children. The chrome (sidebar, sign-out) therefore only
 *      ever renders for an authenticated host, and no private data is fetched
 *      before auth on any nested page.
 *
 * The login route (`/admin/login`) is intentionally OUTSIDE this route group,
 * so it does not inherit the dashboard chrome or the auth gate — the host
 * must be able to reach the sign-in form while signed out.
 *
 * `force-dynamic` because the gate reads the session cookie at request time
 * and the dashboard reflects live data (new RSVPs appear on reload). Next 16
 * requires route segment config to be a statically parseable literal, which
 * this is. The `metadata` template + `robots` noindex applies to every nested
 * admin page so each page only needs to set its own `title`.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Administrador · Sarahi XV", template: "%s · Sarahi XV" },
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isAdminAccessConfigured()) {
    return <DashboardSetupRequired />;
  }

  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }

  return <AdminDashboardChrome>{children}</AdminDashboardChrome>;
}

/** Setup-required screen for the whole dashboard. No sidebar — with no
 *  `ADMIN_ACCESS_KEY` set, navigation would lead nowhere. Matches the login
 *  route's own setup-required screen for a consistent misconfig message. */
function DashboardSetupRequired() {
  return (
    <AdminShell title="Configuración pendiente" eyebrow="administrador">
      <p className="max-w-prose">
        El panel de administración está protegido por la variable de entorno{" "}
        <code>ADMIN_ACCESS_KEY</code>, que no está configurada en este
        despliegue.
      </p>
      <p className="mt-4 max-w-prose text-(--color-ink-dim)">
        Define <code>ADMIN_ACCESS_KEY</code> con una cadena larga y aleatoria
        (por ejemplo, 32 caracteres o más) en tu entorno de hospedaje y luego
        abre <code className="mx-1">/admin/login</code>.
      </p>
    </AdminShell>
  );
}