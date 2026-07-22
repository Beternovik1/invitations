-- Add nullable `sent_at` to `guest_groups` to persist the `Enviada` toggle.
--
-- The unified `/admin/confirmaciones` page shipped a per-card "Enviada" toggle
-- backed only by client-side session state, because at that point the schema
-- had no column to record that the host had already sent the invitation link.
-- The host approved persisting it, so this slice adds `sent_at`:
--
--   - NULL           => the host has NOT marked this invitation as sent yet.
--   - non-NULL UTC  => the host tapped the toggle to record that the link was
--                       sent (typically over WhatsApp). Toggling off resets it
--                       back to NULL.
--
-- The toggle writes through `toggleGuestGroupSentAction` -> the
-- `setGuestGroupSentAtForAdmin` boundary -> `setGuestGroupSentAtInSupabase`,
-- which PATCHes ONLY `sent_at` on the row selected by slug.
--
-- Permissions: no new GRANT is needed here. Migration 0003 already granted
-- UPDATE on `public.guest_groups` to `service_role`, and a PATCH of `sent_at`
-- is an UPDATE — RLS bypass via the service-role key is NOT the same as the
-- table permission, so the existing UPDATE grant covers it. Do not re-grant
-- or widen here; 0003 stays the single home for the UPDATE grant.
--
-- This migration does not edit 0001 or 0003 (both already applied in prod) and
-- adds no DELETE or INSERT grant (out of scope for this slice).
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting this file
-- into the Supabase SQL editor. No secrets are required to run this migration.

alter table public.guest_groups
  add column if not exists sent_at timestamptz null;

comment on column public.guest_groups.sent_at is
  'Server timestamp the host marked this invitation as sent (e.g. via WhatsApp). NULL means not sent yet.';