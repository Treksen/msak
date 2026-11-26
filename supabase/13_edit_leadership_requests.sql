-- =====================================================================
-- 13 · Members can edit or withdraw their leadership requests, and edit past leadership entries
-- =====================================================================
-- - A leader request that is still waiting: change the position title, or withdraw it.
--   (Changing the level means withdrawing and requesting again: a different person approves each level.)
-- - A past leadership entry: edit any detail; it goes back to "waiting for confirmation".
-- Safe to run more than once.

create or replace function public.update_leader_request(p_role_id uuid, p_position text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pos text := btrim(coalesce(p_position, ''));
begin
  if length(v_pos) not between 2 and 100 then
    raise exception 'Enter your position (2–100 characters).' using errcode = '22023';
  end if;
  update public.leader_roles
     set position = v_pos, requested_at = now()
   where id = p_role_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Only your own requests that are still waiting can be changed.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.withdraw_leader_request(p_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.leader_roles where id = p_role_id and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Only your own requests that are still waiting can be withdrawn.' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.update_past_role(
  p_id uuid, p_level text, p_institution_id bigint, p_association_id smallint, p_position text,
  p_from integer, p_to integer
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_assoc smallint := p_association_id;
begin
  if not exists (select 1 from public.past_roles where id = p_id and user_id = auth.uid()) then
    raise exception 'That entry was not found.' using errcode = 'P0002';
  end if;
  if p_level not in ('institutional', 'regional', 'national') then
    raise exception 'Choose campus, regional or national.' using errcode = '22023';
  end if;
  if p_level = 'institutional' then
    v_assoc := public.institution_association_id(p_institution_id);
    if v_assoc is null then
      raise exception 'Choose the institution.' using errcode = '22023';
    end if;
  elsif p_level = 'regional' and v_assoc is null then
    raise exception 'Choose the association.' using errcode = '22023';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'The end year must be the same as or after the start year.' using errcode = '22023';
  end if;
  if p_to - p_from > 10 then
    raise exception 'A single position can cover at most 10 years; add separate entries.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_position, ''))) not between 2 and 100 then
    raise exception 'Enter the position (2–100 characters).' using errcode = '22023';
  end if;
  if p_to > extract(year from public.kenya_today())::integer then
    raise exception 'Past positions must have ended by this year.' using errcode = '22023';
  end if;
  update public.past_roles
     set level = p_level,
         association_id = case when p_level = 'national' then null else v_assoc end,
         institution_id = case when p_level = 'institutional' then p_institution_id else null end,
         position = btrim(p_position),
         from_year = p_from, to_year = p_to,
         show_publicly = case when p_level = 'institutional' then false else show_publicly end,
         status = 'pending', reviewed_by = null, reviewed_at = null, review_note = null  -- checked again
   where id = p_id and user_id = auth.uid();
end;
$$;

revoke all on function public.update_leader_request(uuid, text) from public, anon;
revoke all on function public.withdraw_leader_request(uuid) from public, anon;
revoke all on function public.update_past_role(uuid, text, bigint, smallint, text, integer, integer) from public, anon;
grant execute on function public.update_leader_request(uuid, text) to authenticated;
grant execute on function public.withdraw_leader_request(uuid) to authenticated;
grant execute on function public.update_past_role(uuid, text, bigint, smallint, text, integer, integer) to authenticated;
