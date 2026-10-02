-- Admin går med i ett rum som spelare med sitt namn, utan PIN.

-- Namnet admin har som spelare. Befintliga admins får delen före @ i e-posten (ändra i Studio).
alter table public.admins add column name text;

update public.admins a
set name = split_part(u.email, '@', 1)
from auth.users u
where u.id = a.user_id;

update public.admins set name = 'Admin' where name is null or trim(name) = '';

alter table public.admins
  alter column name set not null,
  add constraint admins_name_length check (length(trim(name)) between 1 and 30);

-- Inloggad admins namn, eller null om anroparen inte är admin. Visas i headern på adminsidorna.
create function public.admin_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.admins where user_id = auth.uid();
$$;

revoke execute on function public.admin_name() from public, anon;
grant execute on function public.admin_name() to authenticated;

-- Admins spelare har ingen PIN; de är knutna till admin-kontot i stället.
alter table public.players
  alter column pin_hash drop not null,
  add column admin_user_id uuid references public.admins on delete cascade,
  add constraint players_pin_or_admin check (pin_hash is not null or admin_user_id is not null);

-- En admin har högst en spelare per rum.
create unique index players_room_admin on public.players (room_id, admin_user_id)
  where admin_user_id is not null;

-- Som tidigare, men admins spelare visas inte i "Vem är du?" (de saknar PIN och loggar in via admin).
create or replace function public.list_room_players(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check json := public.check_room_code(p_code);
begin
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  return json_build_object(
    'ok', true,
    'room_name', v_check->>'room_name',
    'players', coalesce((
      select json_agg(json_build_object('id', p.id, 'username', p.username) order by lower(p.username))
      from public.players p
      join public.rooms r on r.id = p.room_id
      where r.code = upper(trim(p_code)) and p.admin_user_id is null
    ), '[]'::json)
  );
end;
$$;

-- Loggar in anroparens session som admins spelare i rummet. Skapar spelaren första gången.
create function public.admin_join_room(p_room_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_room_id uuid;
  v_player_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  select id into v_room_id from public.rooms where id = p_room_id and closed_at is null;
  if v_room_id is null then
    return json_build_object('ok', false, 'error', 'unknown_room');
  end if;

  select id into v_player_id
  from public.players
  where room_id = v_room_id and admin_user_id = auth.uid();

  if v_player_id is null then
    select trim(name) into v_name from public.admins where user_id = auth.uid();
    begin
      insert into public.players (room_id, username, admin_user_id)
      values (v_room_id, v_name, auth.uid())
      returning id into v_player_id;
    exception when unique_violation then
      -- En spelare i rummet har redan samma namn.
      return json_build_object('ok', false, 'error', 'name_taken', 'name', v_name);
    end;
  end if;

  -- En enhet är inloggad som en spelare i taget.
  update public.players set user_id = null where user_id = auth.uid();
  update public.players set user_id = auth.uid() where id = v_player_id;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.admin_join_room(uuid) from public, anon;
grant execute on function public.admin_join_room(uuid) to authenticated;
