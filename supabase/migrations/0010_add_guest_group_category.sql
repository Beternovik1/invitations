-- Add guest-group category labels for Confirmaciones and future seating filters.

alter table public.guest_groups
  add column if not exists category text;

update public.guest_groups
set category = 'Otros'
where category is null or btrim(category) = '';

alter table public.guest_groups
  alter column category set default 'Otros',
  alter column category set not null;

alter table public.guest_groups
  add constraint guest_groups_category_not_blank
  check (length(btrim(category)) > 0);

comment on column public.guest_groups.category is
  'Human-facing guest group category edited in Confirmaciones and reserved for future seating filters.';
