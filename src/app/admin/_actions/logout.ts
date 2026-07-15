"use server";

import { redirect } from "next/navigation";

import { signOutAdmin } from "@/lib/admin-access";

/**
 * Admin sign-out Server Action.
 *
 * Clears the signed admin session cookie and redirects to `/admin/login`.
 * Bound to the sign-out form in the admin dashboard sidebar (progressive
 * enhancement — it also works as a plain POST without client JS). Idempotent:
 * safe to call when no session exists.
 *
 * Lives in `app/admin/_actions/` — the leading `_` keeps the folder out of the
 * routing tree — so every admin dashboard surface (sidebar, a future header)
 * can share one sign-out entry point instead of re-declaring it per route.
 */
export async function logoutAction(): Promise<void> {
  await signOutAdmin();
  redirect("/admin/login");
}