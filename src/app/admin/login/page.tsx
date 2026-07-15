import type { Metadata } from "next";

import AdminShell from "@/app/admin/_components/AdminShell";
import { isAdminAccessConfigured } from "@/lib/admin-access";
import LoginForm from "@/app/admin/login/LoginForm";

/**
 * Admin login route.
 *
 * The single entry point for the read-only `/admin/rsvps` overview. The host
 * enters the shared `ADMIN_ACCESS_KEY` into the form; the `loginAction` Server
 * Action verifies it on the server and, on success, sets a signed httpOnly
 * cookie and redirects to `/admin/rsvps`. The key is never placed in a URL.
 *
 * States:
 *
 *   1. If `ADMIN_ACCESS_KEY` is not set, render a setup-required screen and
 *      never show the form — a misconfigured deployment shows an obvious
 *      message instead of a login that can never succeed.
 *   2. Otherwise render the login form. Verification and cookie handling live
 *      in the Server Action (`actions.ts`), so the secret stays server-only.
 *
 * `force-dynamic` because the setup-required branch reads the environment at
 * request time and the page must reflect the current config without a rebuild.
 * `robots: noindex` keeps the admin URL out of search engines.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in · Sarahi XV",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (!isAdminAccessConfigured()) {
    return <SetupRequired />;
  }

  return (
    <AdminShell title="Sign in" eyebrow="admin">
      <p className="max-w-prose text-(--color-ink-dim)">
        Enter the access key to view the RSVP overview. The key is intentionally
        not linked anywhere on the public invitation.
      </p>
      <LoginForm />
    </AdminShell>
  );
}

function SetupRequired() {
  return (
    <AdminShell title="Setup required" eyebrow="admin">
      <p className="max-w-prose">
        The admin overview is gated by an <code>ADMIN_ACCESS_KEY</code>{" "}
        environment variable, and it is not set on this deployment.
      </p>
      <p className="mt-4 max-w-prose text-(--color-ink-dim)">
        Set <code>ADMIN_ACCESS_KEY</code> to a long, randomly generated string
        (for example, 32+ characters) in your hosting environment, then open
        <code className="mx-1">/admin/login</code>.
      </p>
    </AdminShell>
  );
}