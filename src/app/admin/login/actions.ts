"use server";

import { redirect } from "next/navigation";

import { isAdminAccessConfigured, signInAdmin } from "@/lib/admin-access";

/**
 * Admin login Server Action state.
 *
 *   - `error`: when set, inline feedback shown on the login form. `null` means
 *     no error to display.
 */
export interface LoginState {
  error: string | null;
}

/**
 * Verify the access key from the login form and start a signed admin session.
 *
 * Bound to a client form via `useActionState` and called as
 * `(prevState, formData)`. On a correct key it sets the httpOnly session cookie
 * (see `signInAdmin`) and redirects to `/admin/rsvps`; on a wrong or missing
 * key it returns a state with an `error` so the form stays usable and shows the
 * failure inline.
 *
 * If `ADMIN_ACCESS_KEY` is not configured the login page itself renders a
 * setup-required screen instead of the form, so a direct POST to this action in
 * that state simply reports an incorrect key rather than implying the secret is
 * wrong.
 */
export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!isAdminAccessConfigured()) {
    return { error: "El acceso de administrador no está configurado en este despliegue." };
  }

  const raw = formData.get("key");
  const candidate = typeof raw === "string" ? raw : "";

  if (candidate.length === 0) {
    return { error: "Ingresa la clave de acceso." };
  }

  const ok = await signInAdmin(candidate);
  if (!ok) {
    return { error: "Clave de acceso incorrecta." };
  }

  redirect("/admin/rsvps");
}