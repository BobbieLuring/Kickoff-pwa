-- Logga in som befintlig spelare med PIN (skärm "Hej igen").

-- Vilken spelare ett PIN-försök gällde, så att spärren gäller spelaren oavsett enhet.
alter table public.login_attempts add column player_id uuid references public.players on delete cascade;

create index on public.login_attempts (player_id, attempted_at) where kind = 'pin';

-- Loggar in anroparens session som spelaren om PIN stämmer.
-- 10 felaktiga försök inom 15 minuter spärrar spelaren tills det äldsta försöket gått ut.
create function public.player_login(p_code text, p_player_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_attempts constant int := 10;
  lock_window constant interval := interval '15 minutes';
  v_check json := public.check_room_code(p_code);
  v_player public.players;
  v_failed int;
  v_oldest timestamptz;
  v_ok boolean;
begin
  if not (v_check->>'ok')::boolean then
    return v_check;
  end if;

  select p.* into v_player
  from public.players p
  join public.rooms r on r.id = p.room_id
  where p.id = p_player_id and r.code = upper(trim(p_code));

  if v_player.id is null then
    return json_build_object('ok', false, 'error', 'unknown_player');
  end if;

  select count(*), min(attempted_at) into v_failed, v_oldest
  from public.login_attempts
  where player_id = v_player.id and kind = 'pin' and not success
    and attempted_at > now() - lock_window;

  if v_failed >= max_attempts then
    return json_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_oldest + lock_window);
  end if;

  v_ok := p_pin is not null and v_player.pin_hash = extensions.crypt(p_pin, v_player.pin_hash);

  insert into public.login_attempts (user_id, kind, success, player_id)
  values (auth.uid(), 'pin', v_ok, v_player.id);

  if not v_ok then
    v_failed := v_failed + 1;
    return json_build_object(
      'ok', false,
      'attempts_left', max_attempts - v_failed,
      'locked_until', case when v_failed >= max_attempts then now() + lock_window end
    );
  end if;

  -- En enhet är inloggad som en spelare i taget.
  update public.players set user_id = null where user_id = auth.uid();
  update public.players set user_id = auth.uid() where id = v_player.id;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.player_login(text, uuid, text) from public, anon;
grant execute on function public.player_login(text, uuid, text) to authenticated;
