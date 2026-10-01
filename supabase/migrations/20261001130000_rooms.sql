-- Rum och kontroll av rumskod för startskärmen.

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Inga policies: rummen nås bara via funktionerna nedan.
alter table public.rooms enable row level security;

-- Varje inloggningsförsök, för spärr per enhet (anonym användare).
create table public.login_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null check (kind in ('code', 'pin')),
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index on public.login_attempts (user_id, kind, attempted_at);

alter table public.login_attempts enable row level security;

-- Kontrollerar en rumskod för anroparen.
-- 5 felaktiga försök inom 15 minuter spärrar enheten tills det äldsta försöket gått ut.
create function public.check_room_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_attempts constant int := 5;
  lock_window constant interval := interval '15 minutes';
  v_uid uuid := auth.uid();
  v_failed int;
  v_oldest timestamptz;
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select count(*), min(attempted_at) into v_failed, v_oldest
  from public.login_attempts
  where user_id = v_uid and kind = 'code' and not success
    and attempted_at > now() - lock_window;

  if v_failed >= max_attempts then
    return json_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_oldest + lock_window);
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code)) and closed_at is null;

  insert into public.login_attempts (user_id, kind, success)
  values (v_uid, 'code', v_room.id is not null);

  if v_room.id is null then
    v_failed := v_failed + 1;
    return json_build_object(
      'ok', false,
      'attempts_left', max_attempts - v_failed,
      'locked_until', case when v_failed >= max_attempts then now() + lock_window end
    );
  end if;

  return json_build_object('ok', true, 'room_name', v_room.name);
end;
$$;

revoke execute on function public.check_room_code(text) from public, anon;
grant execute on function public.check_room_code(text) to authenticated;
