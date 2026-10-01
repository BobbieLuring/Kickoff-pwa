-- Spelare i ett rum, och listan på skärmen "Vem är du?".

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  username text not null check (length(trim(username)) between 1 and 30),
  pin_hash text not null,
  -- Den anonyma sessionen spelaren senast loggade in med.
  user_id uuid,
  created_at timestamptz not null default now()
);

-- Namn är unika per rum, oavsett versaler.
create unique index players_room_username on public.players (room_id, lower(username));

-- Inga policies: spelare nås bara via funktioner.
alter table public.players enable row level security;

-- Listar spelarna i rummet med given kod. Går via check_room_code så att samma spärr gäller.
create function public.list_room_players(p_code text)
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
      where r.code = upper(trim(p_code))
    ), '[]'::json)
  );
end;
$$;

revoke execute on function public.list_room_players(text) from public, anon;
grant execute on function public.list_room_players(text) to authenticated;
