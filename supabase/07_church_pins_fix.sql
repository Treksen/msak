-- 07: Correct the imported church pins using the coordinates from the old site's map (properties-map.js).
-- Safe to run once on an existing database. Only touches imported churches whose pin hasn't been
-- confirmed on site, so anything a leader has already pinned on the ground is left as it is.
begin;

update public.churches c
set lat = v.lat,
    lng = v.lng,
    notes = 'Imported from the old NAMSA site map. Contacts need confirming on the ground.'
from (values
  ('Witeithie', -1.074226, 37.058589),
  ('Juja', -1.106577, 37.018261),
  ('Mt. Zion Ruiru', -1.127125, 36.95398),
  ('Mt. Zion Kayole', -1.280683, 36.915833),
  ('Embakasi', -1.310093, 36.878334),
  ('Nyacaba', -1.094734, 37.059106),
  ('Shauri Moyo', -1.290549, 36.847422),
  ('Kangemi', -1.257084, 36.745785),
  ('Cogmers Ruiru', -1.153771, 36.970556),
  ('Kibra', -1.307776, 36.772406),
  ('Mt. Zion CBD', -1.26704, 36.834112)
) as v(name, lat, lng)
where c.name = v.name
  and c.location_verified = false
  and c.notes like 'Imported from the old NAMSA site%';

commit;
