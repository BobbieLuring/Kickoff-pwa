-- Skapa spelare (skärm "Ny spelare") och läsa vem som är inloggad på enheten.

-- Skapar en spelare i rummet med given kod och loggar in den på anroparens (anonyma) session.
-- Koden kontrolleras via check_room_code så att samma spärr gäller.
create function public.register_player(p_code text, p_username text, p_pin text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check json := public.check_room_code(p_code);
  v_room_id uuid;
  v_name text := trim(p_username);
begin
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  if p_pin is null or p_pin !~ '^\d{4}$' then
    return json_build_object('ok', false, 'error', 'invalid_pin');
  end if;

  if length(v_name) not between 1 and 30 then
    return json_build_object('ok', false, 'error', 'invalid_name');
  end if;

  select id into v_room_id from public.rooms where code = upper(trim(p_code));

  begin
    -- En enhet är inloggad som en spelare i taget.
    update public.players set user_id = null where user_id = auth.uid();
    insert into public.players (room_id, username, pin_hash, user_id)
    values (v_room_id, v_name, extensions.crypt(p_pin, extensions.gen_salt('bf')), auth.uid());
  exception when unique_violation then
    return json_build_object('ok', false, 'error', 'name_taken');
  end;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.register_player(text, text, text) from public, anon;
grant execute on function public.register_player(text, text, text) to authenticated;

-- Spelaren som är inloggad på anroparens session, eller null.
create function public.current_player()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('id', p.id, 'username', p.username, 'room_name', r.name)
  from public.players p
  join public.rooms r on r.id = p.room_id
  where p.user_id = auth.uid() and r.closed_at is null;
$$;

revoke execute on function public.current_player() from public, anon;
grant execute on function public.current_player() to authenticated;
