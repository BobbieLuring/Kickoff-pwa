-- Kortare gränser: spelarnamn högst 12 tecken, meddelanden högst 40 tecken.

-- Som tidigare, men namnet får vara högst 12 tecken.
-- Gäller nya spelare; befintliga namn och admins namn påverkas inte.
create or replace function public.register_player(p_code text, p_username text, p_pin text)
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

  if length(v_name) not between 1 and 12 then
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

-- Meddelanden: högst 40 tecken. "not valid" så att redan skickade (längre) testmeddelanden inte stoppar ändringen.
alter table public.player_messages drop constraint player_messages_text_check;
alter table public.player_messages
  add constraint player_messages_text_check check (length(trim(text)) between 1 and 40) not valid;

-- Som tidigare, men högst 40 tecken.
create or replace function public.send_message(p_recipient_id uuid, p_text text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_text text := trim(p_text);
  v_last timestamptz;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if v_text is null or length(v_text) not between 1 and 40 then
    return json_build_object('ok', false, 'error', 'invalid_text');
  end if;

  if p_recipient_id = v_player.id or not exists (
    select 1 from public.players where id = p_recipient_id and room_id = v_player.room_id
  ) then
    return json_build_object('ok', false, 'error', 'unknown_player');
  end if;

  select max(created_at) into v_last from public.player_messages where sender_id = v_player.id;
  if v_last is not null and v_last > now() - interval '10 seconds' then
    return json_build_object(
      'ok', false, 'error', 'too_fast',
      'wait_seconds', ceil(extract(epoch from (v_last + interval '10 seconds' - now())))::int
    );
  end if;

  insert into public.player_messages (room_id, sender_id, recipient_id, text)
  values (v_player.room_id, v_player.id, p_recipient_id, v_text);

  return json_build_object('ok', true);
end;
$$;
