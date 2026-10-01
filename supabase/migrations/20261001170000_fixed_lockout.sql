-- Fast spärr: efter max antal fel i rad spärras nyckeln en bestämd tid, sedan börjar räkningen
-- om från noll. En lyckad inloggning nollställer räkningen.
-- Ersätter fönstret över login_attempts, där spärren släppte när äldsta felet gick ut.

create table public.login_locks (
  kind text not null check (kind in ('code', 'pin')),
  -- 'code': enhetens anonyma användare. 'pin': spelaren.
  key uuid not null,
  failures int not null default 0,
  locked_until timestamptz,
  primary key (kind, key)
);

alter table public.login_locks enable row level security;

-- Tidpunkten spärren släpper, eller null om nyckeln inte är spärrad.
create function public.login_locked_until(p_kind text, p_key uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select locked_until from public.login_locks
  where kind = p_kind and key = p_key and locked_until > now();
$$;

-- Registrerar ett försök. Lyckat: nollställer och returnerar null.
-- Misslyckat: returnerar { ok: false, attempts_left, locked_until }.
create function public.record_login_attempt(
  p_kind text, p_key uuid, p_success boolean, p_max int, p_lock interval
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_failures int;
  v_locked_until timestamptz;
begin
  if p_success then
    delete from public.login_locks where kind = p_kind and key = p_key;
    return null;
  end if;

  insert into public.login_locks as l (kind, key, failures)
  values (p_kind, p_key, 1)
  on conflict (kind, key) do update
    -- En utgången spärr börjar om från noll.
    set failures = case when l.locked_until is not null then 1 else l.failures + 1 end,
        locked_until = null
  returning failures into v_failures;

  if v_failures >= p_max then
    v_locked_until := now() + p_lock;
    update public.login_locks set failures = 0, locked_until = v_locked_until
    where kind = p_kind and key = p_key;
    return json_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_locked_until);
  end if;

  return json_build_object('ok', false, 'attempts_left', p_max - v_failures, 'locked_until', null);
end;
$$;

-- Hjälpfunktionerna anropas bara från andra funktioner, aldrig från appen.
revoke execute on function public.login_locked_until(text, uuid) from public, anon, authenticated;
revoke execute on function public.record_login_attempt(text, uuid, boolean, int, interval)
  from public, anon, authenticated;

-- Rumskod: 5 fel i rad spärrar enheten i 15 minuter.
create or replace function public.check_room_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_locked_until timestamptz;
  v_room public.rooms;
  v_failure json;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  v_locked_until := public.login_locked_until('code', v_uid);
  if v_locked_until is not null then
    return json_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_locked_until);
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code)) and closed_at is null;

  v_failure := public.record_login_attempt('code', v_uid, v_room.id is not null, 5, interval '15 minutes');
  if v_failure is not null then
    return v_failure;
  end if;

  return json_build_object('ok', true, 'room_name', v_room.name);
end;
$$;

-- PIN: 10 fel i rad spärrar spelaren i 15 minuter, oavsett enhet.
create or replace function public.player_login(p_code text, p_player_id uuid, p_pin text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check json := public.check_room_code(p_code);
  v_player public.players;
  v_locked_until timestamptz;
  v_failure json;
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

  v_locked_until := public.login_locked_until('pin', v_player.id);
  if v_locked_until is not null then
    return json_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_locked_until);
  end if;

  v_failure := public.record_login_attempt(
    'pin', v_player.id,
    p_pin is not null and v_player.pin_hash = extensions.crypt(p_pin, v_player.pin_hash),
    10, interval '15 minutes'
  );
  if v_failure is not null then
    return v_failure;
  end if;

  -- En enhet är inloggad som en spelare i taget.
  update public.players set user_id = null where user_id = auth.uid();
  update public.players set user_id = auth.uid() where id = v_player.id;

  return json_build_object('ok', true);
end;
$$;

drop table public.login_attempts;
