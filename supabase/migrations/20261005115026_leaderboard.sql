-- Topplistan: totalpoäng per spelare i anroparens rum, och Realtime på poängtabellen.

-- Alla spelare i rummet med summan av sina poäng från alla aktiviteter, även de med 0.
-- Lika poäng ger samma placering.
create function public.leaderboard()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  return json_build_object(
    'my_player_id', v_player.id,
    'entries', coalesce((
      select json_agg(
        json_build_object('player_id', s.id, 'name', s.username, 'points', s.points, 'rank', s.rank)
        order by s.rank, lower(s.username)
      )
      from (
        select p.id, p.username, coalesce(sum(pa.points), 0) as points,
               rank() over (order by coalesce(sum(pa.points), 0) desc) as rank
        from public.players p
        left join public.point_awards pa on pa.player_id = p.id
        where p.room_id = v_player.room_id
        group by p.id, p.username
      ) s
    ), '[]'::json)
  );
end;
$$;

revoke execute on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;

-- "Ringklockan": appen får ett meddelande när poäng delas ut och hämtar då topplistan igen.
-- Realtime följer läspolicyn på point_awards, så spelare får bara händelser från sitt eget rum.
alter publication supabase_realtime add table public.point_awards;