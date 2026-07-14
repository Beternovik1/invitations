-- Seed guest groups matching the in-repo mock data (src/lib/guest-groups.ts).
--
-- Run after the migration to populate the table for local/preview environments.
-- Safe to re-run: uses upsert on the slug primary key, so editing a row here
-- updates it without duplicating.
--
-- display_name values are reproduced exactly as the host wrote them, including
-- accents, abbreviations (Hdez., Ma., Fco.), and the trailing "y fam." used for
-- "+ family" groupings. Slugs are the URL-safe, lowercase, accent-free,
-- hyphenated form of the same name and are unique.
--
-- Totals from the host's list:
--   - Assigned seats with explicit counts: 184 (across 48 groups)
--   - Venue capacity: 200
--   - Groups whose count is still pending: Cabrera García, García López and
--     Tía Chuy — seeded with assigned_seats = null and seats_note =
--     'Por confirmar', mirroring the mock model's explicit "pending" state.
--
-- The family/grouping structure is preserved only as section comments; it is not
-- modelled as a column because no consumer needs it yet.

insert into public.guest_groups
  (slug, display_name, assigned_seats, is_active, seats_note, notes)
values
  -- Familia Alfaro (29)
  ('alfaro-padilla',                 'Alfaro Padilla',                 5,    true, null,            null),
  ('alfaro-santoyo',                 'Alfaro Santoyo',                 5,    true, null,            null),
  ('alfaro-jimenez',                 'Alfaro Jiménez',                 4,    true, null,            null),
  ('alfaro-gil',                     'Alfaro Gil',                     5,    true, null,            null),
  ('alfaro-garcia',                  'Alfaro García',                  1,    true, null,            null),
  ('sanchez-alfaro',                 'Sánchez Alfaro',                 2,    true, null,            null),
  ('nieto-sanchez',                 'Nieto Sánchez',                 4,    true, null,            null),
  ('sanchez-ruiz',                   'Sánchez Ruiz',                   3,    true, null,            null),
  -- Familia Vital (27)
  ('vital-hernandez',                'Vital Hernández',                6,    true, null,            null),
  ('vital-menchaca',                 'Vital Menchaca',                 8,    true, null,            null),
  ('guadalupe-vital',                'Guadalupe Vital',                4,    true, null,            null),
  ('doris',                          'Doris',                          1,    true, null,            null),
  ('pedro-vital-y-fam',              'Pedro Vital y fam.',             4,    true, null,            null),
  ('san-juana',                      'San Juana',                      4,    true, null,            null),
  -- Familia Herrera (19)
  ('santacruz-hernandez',            'Santacruz Hernández',            4,    true, null,            null),
  ('avila-hernandez',                'Ávila Hernández',                2,    true, null,            null),
  ('herrera-avila',                  'Herrera Ávila',                  4,    true, null,            null),
  ('herrera-cendejas',               'Herrera Cendejas',               2,    true, null,            null),
  ('javier-herrera-y-fam',           'Javier Herrera y fam.',          2,    true, null,            null),
  ('adriana-herrera-y-fam',          'Adriana Herrera y fam.',         5,    true, null,            null),
  -- Familia Hernández Rocha (9)
  ('hernandez-rocha',                'Hernández Rocha',                3,    true, null,            null),
  ('jaime-hdez-y-fam',               'Jaime Hdez. y fam.',             3,    true, null,            null),
  ('carmen-hdez-y-fam',              'Carmen Hdez. y fam.',            3,    true, null,            null),
  -- Familia Gaytán García (8)
  ('gaytan-garcia',                  'Gaytán García',                  8,    true, null,            null),
  -- Real entries: seat count still pending confirmation
  ('cabrera-garcia',                 'Cabrera García',                 null, true, 'Por confirmar', null),
  ('garcia-lopez',                   'García López',                   null, true, 'Por confirmar', null),
  ('tia-chuy',                       'Tía Chuy',                       null, true, 'Por confirmar', null),
  -- Familia Martínez / Hernández (26)
  ('jorge-martinez-y-fam',           'Jorge Martínez y fam.',          6,    true, null,            null),
  ('luis-marcela-y-fam',             'Luis, Marcela y fam.',           5,    true, null,            null),
  ('patricia-hernandez-y-fam',       'Patricia Hernández y fam.',      6,    true, null,            null),
  ('jesica-hernandez-y-fam',         'Jesica Hernández y fam.',        3,    true, null,            null),
  ('brenda-hernandez-y-fam',         'Brenda Hernández y fam.',        2,    true, null,            null),
  ('ismael-hernandez-y-fam',         'Ismael Hernández y fam.',        2,    true, null,            null),
  ('rosalba-hernandez-y-fam',         'Rosalba Hernández y fam.',      2,    true, null,            null),
  -- Familia Almanza (16)
  ('miguel-angel-almanza-y-fam',     'Miguel Ángel Almanza y fam.',    3,    true, null,            null),
  ('clara-almanza-y-fam',            'Clara Almanza y fam.',           3,    true, null,            null),
  ('ma-de-jesus-almanza-y-fam',      'Ma. de Jesús Almanza y fam.',    4,    true, null,            null),
  ('monserrat-almanza-y-fam',        'Monserrat Almanza y fam.',       4,    true, null,            null),
  ('javier-almanza-y-fam',           'Javier Almanza y fam.',          2,    true, null,            null),
  -- Familia Trejo (6)
  ('audiel-trejo-y-fam',             'Audiel Trejo y fam.',            4,    true, null,            null),
  ('cande-trejo-y-fam',              'Cande Trejo y fam.',             2,    true, null,            null),
  -- Familia Hernández Mandilla (22)
  ('antonio-hernandez-y-fam',        'Antonio Hernández y fam.',       3,    true, null,            null),
  ('abel-almanza-hernandez',         'Abel Almanza Hernández',         4,    true, null,            null),
  ('diego-almanza-y-fam',            'Diego Almanza y fam.',           4,    true, null,            null),
  ('raul-hernandez-y-fam',           'Raúl Hernández y fam.',          3,    true, null,            null),
  ('ma-de-la-luz-hernandez-y-fam',   'Ma. de la Luz Hernández y fam.', 4,    true, null,            null),
  ('fco-rico-hernandez',             'Fco. Rico Hernández',            4,    true, null,            null),
  -- Familia Faustino Barroso (6)
  ('faustino-barroso',               'Faustino Barroso',               6,    true, null,            null),
  -- Familia Ángeles (16)
  ('ivana-magdalena-hdez-y-fam',     'Ivana Magdalena Hdez. y fam.',   5,    true, null,            null),
  ('gutierrez-mosqueda',             'Gutiérrez Mosqueda',             8,    true, null,            null),
  ('alberto-gutierrez-y-fam',        'Alberto Gutiérrez y fam.',       3,    true, null,            null)
on conflict (slug) do update
  set
    display_name   = excluded.display_name,
    assigned_seats = excluded.assigned_seats,
    is_active      = excluded.is_active,
    seats_note     = excluded.seats_note,
    notes          = excluded.notes;