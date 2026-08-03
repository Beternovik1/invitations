-- Add stable guest-group UUID identity to RSVPs without changing slug writes.
--
-- guest_group_slug remains the RSVP primary key and existing foreign-key path.
-- The trigger derives UUID identity for the current slug-only application write
-- contract and rejects writes that could make the two identities disagree.

alter table public.rsvps
  add column guest_group_id uuid null;

update public.rsvps as rsvp
set guest_group_id = guest_group.id
from public.guest_groups as guest_group
where rsvp.guest_group_slug = guest_group.slug
  and rsvp.guest_group_id is null;

create or replace function public.resolve_rsvp_guest_group_id()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  resolved_guest_group_id uuid;
begin
  select guest_group.id
  into resolved_guest_group_id
  from public.guest_groups as guest_group
  where guest_group.slug = new.guest_group_slug;

  if resolved_guest_group_id is null then
    raise foreign_key_violation using
      message = format(
        'insert or update on table "rsvps" violates foreign key constraint "rsvps_guest_group_slug_fkey"'
      ),
      detail = format(
        'Key (guest_group_slug)=(%s) is not present in table "guest_groups".',
        new.guest_group_slug
      ),
      schema = 'public',
      table = 'rsvps',
      constraint = 'rsvps_guest_group_slug_fkey';
  end if;

  if new.guest_group_id is not null
    and new.guest_group_id <> resolved_guest_group_id then
    raise check_violation using
      message = 'RSVP guest_group_id does not match guest_group_slug',
      detail = format(
        'guest_group_slug (%s) resolves to guest_group_id (%s), not (%s).',
        new.guest_group_slug,
        resolved_guest_group_id,
        new.guest_group_id
      ),
      schema = 'public',
      table = 'rsvps',
      constraint = 'rsvps_guest_group_identity_match';
  end if;

  new.guest_group_id = resolved_guest_group_id;
  return new;
end;
$$;

create trigger rsvps_resolve_guest_group_id
  before insert or update on public.rsvps
  for each row
  execute function public.resolve_rsvp_guest_group_id();

alter table public.rsvps
  alter column guest_group_id set not null,
  add constraint rsvps_guest_group_id_key unique (guest_group_id),
  add constraint rsvps_guest_group_id_fkey
    foreign key (guest_group_id) references public.guest_groups(id) on delete cascade;

comment on column public.rsvps.guest_group_id is
  'Stable guest-group UUID identity; guest_group_slug remains the physical primary key.';
