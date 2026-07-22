"use server";

import { revalidatePath } from "next/cache";

import {
  isAdminAccessConfigured,
  isAdminAuthenticated,
} from "@/lib/admin-access";
import {
  createOrReactivateGuestGroupForAdmin,
  deleteGuestGroupForAdmin,
  updateGuestGroupForAdmin,
  type GuestGroupCreateFormState,
  type GuestGroupDeleteFormState,
  type GuestGroupFormState,
} from "@/lib/admin-guest-groups";
import {
  INITIAL_GUEST_GROUP_DELETE_FORM_STATE,
  INITIAL_GUEST_GROUP_FORM_STATE,
} from "@/lib/admin-guest-groups-shared";

/**
 * Admin guest-group update Server Action.
 *
 * All cards on the editor share this single action — each card submits its own
 * `slug` as a hidden field — and is consumed via `useActionState`, so the
 * signature is `(prevState, formData)` as React expects. Running on the server
 * keeps the service-role key and all Supabase access off the client.
 *
 * Access is re-verified immediately before the write, mirroring the dashboard
 * layout's gate and the RSVP overview's own repeated check. The layout already
 * redirected unauthenticated visitors, but a Server Action is independently
 * invokable: this guard makes sure no private mutation happens without a valid
 * admin session, even if the action is called directly.
 *
 * Returns a structured `GuestGroupFormState` — never throws for expected
 * validation failures (`updateGuestGroupForAdmin` already converts those into
 * `{ ok: false, error }`). Only transport-level failures throw; they are caught
 * here and surfaced as an `error` state so the card stays usable. `slug` is
 * carried back so the single `useActionState` reducer can fan feedback out to
 * the matching card.
 */
export async function updateGuestGroupAction(
  prevState: GuestGroupFormState,
  formData: FormData
): Promise<GuestGroupFormState> {
  const rawSlug = formData.get("slug");
  const slug =
    typeof rawSlug === "string" ? rawSlug.trim() : "";

  if (slug.length === 0) {
    // No slug means the form was tampered or rendered without one. There is no
    // matching card to fan feedback to; return the idle state so the UI does
    // not flap. The client guards against this by always rendering the hidden
    // slug field.
    return INITIAL_GUEST_GROUP_FORM_STATE;
  }

  // Re-verify auth immediately before any private mutation. Cheap and keeps
  // the security decision next to the write.
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return {
      status: "error",
      slug,
      error: {
        code: "unexpected",
        message:
          "Tu sesión de administrador expiró. Recarga la página para iniciar sesión de nuevo.",
      },
    };
  }

  const rawDisplayName = formData.get("displayName");
  const displayName = typeof rawDisplayName === "string" ? rawDisplayName : "";

  const rawAssignedSeats = formData.get("assignedSeats");
  // Blank -> `null` (pending). Anything else -> run through Number and let the
  // boundary validate; `Number("") === 0` would silently turn blank into 0, so
  // we short-circuit the empty string explicitly.
  const assignedSeats =
    rawAssignedSeats == null || rawAssignedSeats === ""
      ? null
      : typeof rawAssignedSeats === "string"
        ? Number(rawAssignedSeats)
        : Number.NaN;

  const rawSeatsNote = formData.get("seatsNote");
  const seatsNote = typeof rawSeatsNote === "string" ? rawSeatsNote : null;

  // HTML checkboxes submit their value only when checked, so absence means
  // unchecked (`false`).
  const isActive = formData.get("isActive") === "on";

  try {
    const result = await updateGuestGroupForAdmin(slug, {
      displayName,
      assignedSeats,
      seatsNote,
      isActive,
    });
    if (result.ok) {
      // Refresh the page's data cache so the list reflects the persisted
      // values immediately on the next render (isActive toggling, seat count,
      // note, etc.).
      //
      // The unified `/admin/confirmaciones` page reuses this same action for
      // its inline `Modificar` panel, so it must be revalidated too — otherwise
      // a save from the confirmaciones card would leave that page showing stale
      // seat counts / status badges until a manual reload. Both paths are cheap
      // to revalidate and the action is the single shared mutation surface.
      revalidatePath("/admin/guest-groups");
      revalidatePath("/admin/confirmaciones");
      return { status: "success", slug };
    }
    return { status: "error", slug, error: result.error };
  } catch {
    return {
      status: "error",
      slug,
      error: {
        code: "unexpected",
        message:
          "Ocurrió un problema al guardar este grupo. Inténtalo de nuevo en un momento.",
      },
    };
  }
}

/**
 * Admin guest-group create-or-reactivate Server Action.
 *
 * Backs the `Nueva invitación` panel on `/admin/confirmaciones`. The slug is
 * NOT supplied by the form: it is derived server-side from `displayName` by
 * the boundary (`slugifyGuestGroupName`), so a tampered client cannot pick the
 * identifier. Running on the server keeps the service-role key and all
 * Supabase access off the client.
 *
 * Auth is re-verified immediately before the write, mirroring
 * `updateGuestGroupAction`. The dashboard layout already redirected
 * unauthenticated visitors, but a Server Action is independently invokable,
 * so this guard keeps the security decision next to the mutation.
 *
 * Returns a structured `GuestGroupCreateFormState` — never throws for expected
 * validation failures (`createOrReactivateGuestGroupForAdmin` already
 * converts those into `{ ok: false, error }`). On success it carries back the
 * freshly created/reactivated slug so the panel can show the resulting
 * `/i/[slug]` link; `revalidatePath` then refreshes the list so the new card
 * appears. Only transport-level failures throw; they are caught here and
 * surfaced as an `error` state so the panel stays usable.
 */
export async function createGuestGroupAction(
  prevState: GuestGroupCreateFormState,
  formData: FormData
): Promise<GuestGroupCreateFormState> {
  // Re-verify auth immediately before any private mutation. Cheap and keeps
  // the security decision next to the write.
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return {
      status: "error",
      error: {
        code: "unexpected",
        message:
          "Tu sesión de administrador expiró. Recarga la página para iniciar sesión de nuevo.",
      },
    };
  }

  const rawDisplayName = formData.get("displayName");
  const displayName =
    typeof rawDisplayName === "string" ? rawDisplayName : "";

  const rawAssignedSeats = formData.get("assignedSeats");
  // Blank -> `null` (pending). Anything else -> Number. `Number("") === 0`
  // would silently turn blank into 0, so short-circuit the empty string
  // explicitly (same guard the update action uses).
  const assignedSeats =
    rawAssignedSeats == null || rawAssignedSeats === ""
      ? null
      : typeof rawAssignedSeats === "string"
        ? Number(rawAssignedSeats)
        : Number.NaN;

  try {
    const result = await createOrReactivateGuestGroupForAdmin({
      displayName,
      assignedSeats,
    });
    if (result.ok) {
      // Refresh both admin surfaces so the new/reactivated card appears on
      // the next render. The public `/i/[slug]` route is force-dynamic, so no
      // revalidate is needed there. The guest-groups editor lists inactive
      // rows too, so it must be refreshed alongside the confirmaciones page.
      revalidatePath("/admin/guest-groups");
      revalidatePath("/admin/confirmaciones");
      return { status: "success", slug: result.group.slug };
    }
    return { status: "error", error: result.error };
  } catch {
    return {
      status: "error",
      error: {
        code: "unexpected",
        message:
          "Ocurrió un problema al crear este grupo. Inténtalo de nuevo en un momento.",
      },
    };
  }
}

/**
 * Admin guest-group soft-delete Server Action.
 *
 * Backs the inline `Eliminar` confirmation inside the `Modificar` panel on
 * `/admin/confirmaciones`. Soft-delete = PATCH `is_active = false`, NOT a hard
 * DELETE: the row survives so `Nueva invitación` can reactivate the same slug
 * later (preserving `display_name` / `assigned_seats` / `seats_note` and any
 * existing RSVP). See `deleteGuestGroupForAdmin` for the why.
 *
 * All cards on `confirmaciones` share this single action — each confirmation
 * form posts its own `slug` as a hidden field — and is consumed via
 * `useActionState` with a `(prevState, formData)` signature. Running on the
 * server keeps the service-role key and all Supabase access off the client.
 *
 * Access is re-verified immediately before the write, mirroring the update and
 * create actions. The layout already redirected unauthenticated visitors, but
 * a Server Action is independently invokable: this guard makes sure no private
 * mutation happens without a valid admin session, even if the action is called
 * directly.
 *
 * Returns a structured `GuestGroupDeleteFormState` — never throws for expected
 * validation failures (`deleteGuestGroupForAdmin` already converts those into
 * `{ ok: false, error }`). Only transport-level failures throw; they are caught
 * here and surfaced as an `error` state so the confirmation form stays usable.
 * `slug` is carried back so the single `useActionState` reducer can fan
 * feedback out to the matching card.
 *
 * On success `revalidatePath` refreshes:
 *   - `/admin/confirmaciones`: the data boundary returns active groups only,
 *     so the card disappears from the unified list the host just acted on.
 *   - `/admin/guest-groups`: the legacy editor lists inactive rows too, so the
 *     row stays visible (now flagged "Inactivo") and the host can reactivate it
 *     later.
 *   - `/admin/rsvps`: the legacy read-only overview filters active groups, so
 *     the card disappears there too — keeps the static overview honest without
 *     waiting for a manual reload.
 */
export async function deleteGuestGroupAction(
  prevState: GuestGroupDeleteFormState,
  formData: FormData
): Promise<GuestGroupDeleteFormState> {
  const rawSlug = formData.get("slug");
  const slug = typeof rawSlug === "string" ? rawSlug.trim() : "";

  if (slug.length === 0) {
    // No slug means the form was tampered or rendered without one. There is no
    // matching card to fan feedback to; return idle so the UI does not flap.
    // The client guards against this by always rendering the hidden slug field.
    return INITIAL_GUEST_GROUP_DELETE_FORM_STATE;
  }

  // Re-verify auth immediately before any private mutation. Cheap and keeps
  // the security decision next to the write.
  if (!isAdminAccessConfigured() || !(await isAdminAuthenticated())) {
    return {
      status: "error",
      slug,
      error: {
        code: "unexpected",
        message:
          "Tu sesión de administrador expiró. Recarga la página para iniciar sesión de nuevo.",
      },
    };
  }

  try {
    const result = await deleteGuestGroupForAdmin(slug);
    if (result.ok) {
      // Refresh the three admin surfaces so every list the host could be
      // looking at reflects the soft-delete on the next render. The public
      // `/i/[slug]` route is already `force-dynamic` (cache: no-store), so no
      // revalidate is needed there: the next visit renders the
      // "not found" view because the public lookup hides inactive rows.
      revalidatePath("/admin/confirmaciones");
      revalidatePath("/admin/guest-groups");
      revalidatePath("/admin/rsvps");
      return { status: "success", slug };
    }
    return { status: "error", slug, error: result.error };
  } catch {
    return {
      status: "error",
      slug,
      error: {
        code: "unexpected",
        message:
          "Ocurrió un problema al eliminar esta invitación. Inténtalo de nuevo en un momento.",
      },
    };
  }
}