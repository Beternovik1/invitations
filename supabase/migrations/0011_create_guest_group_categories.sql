-- Persist reusable custom guest-group category labels per event.
--
-- Default categories stay in application code. This registry stores only custom
-- labels so a label remains available in Confirmaciones even when no current
-- guest group is assigned to it.

create table if not exists public.guest_group_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  label text not null check (length(btrim(label)) > 0),
  label_key text generated always as (lower(btrim(label))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_group_categories_event_id_label_key unique (event_id, label_key)
);

comment on table public.guest_group_categories is
  'Reusable custom guest-group category labels scoped to one event.';
comment on column public.guest_group_categories.event_id is
  'Event root for this custom category label.';
comment on column public.guest_group_categories.label is
  'Human-facing custom category label shown in Confirmaciones.';
comment on column public.guest_group_categories.label_key is
  'Trimmed lowercase label used to prevent duplicate custom labels per event.';
comment on column public.guest_group_categories.created_at is 'Row creation timestamp.';
comment on column public.guest_group_categories.updated_at is 'Row last-update timestamp.';

drop trigger if exists guest_group_categories_touch_updated_at on public.guest_group_categories;
create trigger guest_group_categories_touch_updated_at
  before update on public.guest_group_categories
  for each row
  execute function public.touch_updated_at();

-- Preserve existing non-default category labels that may already be assigned to
-- groups. Defaults are intentionally not stored here because they are owned by
-- application code.
insert into public.guest_group_categories (event_id, label)
select
  event_id,
  min(btrim(category)) as label
from public.guest_groups
where length(btrim(category)) > 0
  and btrim(category) not in (
    'Familia materna',
    'Familia paterna',
    'Amigos',
    'Trabajo',
    'Otros'
  )
group by event_id, lower(btrim(category))
on conflict (event_id, label_key) do nothing;

-- Keep access server-only. Do not grant browser roles direct registry access.
grant select, insert on table public.guest_group_categories to service_role;
