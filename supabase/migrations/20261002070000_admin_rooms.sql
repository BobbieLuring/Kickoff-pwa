-- Admin: lista rum, skapa rum och byta rumskod. Koden genereras alltid här, aldrig av klienten.

alter table public.rooms add column created_by uuid references auth.users on delete set null;

-- Slumpar en kod: 6 tecken av A–Z och 2–9, utan 0/O och 1/I som är lätta att blanda ihop.
-- Kontrollerar inte om den är ledig; det gör unika index på rooms.code när koden sparas.
create function public.generate_room_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_code text := '';
begin
  for i in 0..5 loop
    -- 256 är jämnt delbart med 32 tecken, så varje tecken är lika sannolikt.
    v_code := v_code || substr(alphabet, get_byte(v_bytes, i) % 32 + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- Hjälpfunktion, anropas bara från funktionerna nedan.
revoke execute on function public.generate_room_code() from public, anon, authenticated;

-- Alla rum, nyaste först.
create function public.admin_list_rooms()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  return coalesce((
    select json_agg(
      json_build_object('id', id, 'name', name, 'code', code, 'closed_at', closed_at)
      order by created_at desc
    )
    from public.rooms
  ), '[]'::json);
end;
$$;

-- Skapar ett rum med genererad kod. Krockar koden (även med ett samtidigt anrop) provas en ny,
-- högst 10 gånger.
create function public.create_room(p_name text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_tries constant int := 10;
  v_name text := trim(p_name);
  v_room public.rooms;
begin
  if not public.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  if v_name is null or length(v_name) not between 1 and 60 then
    return json_build_object('ok', false, 'error', 'invalid_name');
  end if;

  for i in 1..max_tries loop
    begin
      insert into public.rooms (name, code, created_by)
      values (v_name, public.generate_room_code(), auth.uid())
      returning * into v_room;
      return json_build_object('ok', true, 'id', v_room.id, 'name', v_room.name, 'code', v_room.code);
    exception when unique_violation then
      -- Koden var tagen: försök med en ny.
    end;
  end loop;

  raise exception 'could not generate a free room code after % tries', max_tries;
end;
$$;

-- Ger rummet en ny genererad kod ("Ny kod"). Den gamla koden slutar gälla direkt.
create function public.regenerate_room_code(p_room_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_tries constant int := 10;
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  if not exists (select 1 from public.rooms where id = p_room_id) then
    return json_build_object('ok', false, 'error', 'unknown_room');
  end if;

  for i in 1..max_tries loop
    begin
      update public.rooms set code = public.generate_room_code()
      where id = p_room_id
      returning code into v_code;
      return json_build_object('ok', true, 'code', v_code);
    exception when unique_violation then
      -- Koden var tagen: försök med en ny.
    end;
  end loop;

  raise exception 'could not generate a free room code after % tries', max_tries;
end;
$$;

revoke execute on function public.admin_list_rooms() from public, anon;
revoke execute on function public.create_room(text) from public, anon;
revoke execute on function public.regenerate_room_code(uuid) from public, anon;
grant execute on function public.admin_list_rooms() to authenticated;
grant execute on function public.create_room(text) to authenticated;
grant execute on function public.regenerate_room_code(uuid) to authenticated;
