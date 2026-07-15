"use server";

import { redirect } from "next/navigation";

import { signOutAdmin } from "@/lib/admin-access";

/**
 * Admin logout Server Action.
 *
 * Clears the signed admin session cookie and redirects to `/admin/login`.
 * Bound to the logout form in the overview header as a plain form action
 * (progressive enhancement — works without client JS). Idempotent: safe to
 * call when no session exists.
 */
export async function logoutAction(): Promise<void> {
  await signOutAdmin();
  redirect("/admin/login");
}