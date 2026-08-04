-- Add private capability identity without changing current invitation URLs.
--
-- access_token is distinct from internal UUID identity and the readable slug.
-- Existing rows are backfilled before the column becomes required, while the
-- default gives future rows a cryptographically random token automatically.

alter table public.guest_groups
  add column access_token uuid null default gen_random_uuid();

update public.guest_groups
set access_token = gen_random_uuid()
where access_token is null;

alter table public.guest_groups
  alter column access_token set not null,
  add constraint guest_groups_access_token_key unique (access_token);

comment on column public.guest_groups.access_token is
  'Private capability token for future invitation access; not yet used in URLs.';
