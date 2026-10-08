-- Topplistan räknar med spelen live: medan ett spel är öppet ger nuvarande placering preliminära poäng.
-- När admin stänger spelet låses poängen i point_awards och den preliminära räkningen upphör,
-- så inget räknas två gånger.

create or replace function public.leaderboard()
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
        select t.id, t.username, t.points, rank() over (order by t.points desc) as rank
        from (
          select p.id, p.username,
                 -- Låsta poäng från alla avslutade aktiviteter.
                 coalesce((select sum(pa.points) from public.point_awards pa where pa.player_id = p.id), 0)
                 -- Preliminära poäng från spel som fortfarande är öppna.
                 + coalesce((
                     select sum(public.game_rank_points(r.rank))
                     from unnest(array['flyg', 'plattor', 'pricka']) as g (key)
                     cross join lateral public.game_ranking(v_player.room_id, g.key) r
                     where public.section_phase(v_player.room_id, g.key) = 'open'
                       and r.player_id = p.id
                   ), 0) as points
          from public.players p
          where p.room_id = v_player.room_id
        ) t
      ) s
    ), '[]'::json)
  );
end;
$$;

-- Spelresultat är inte hemliga: spelare får läsa resultaten i sitt eget rum.
-- Behövs för att Realtime ska kunna ringa på topplistan när någon får ett nytt resultat.
create policy "players read game scores in own room"
  on public.game_scores for select
  to authenticated
  using (room_id = public.my_room_id());

alter publication supabase_realtime add table public.game_scores;
