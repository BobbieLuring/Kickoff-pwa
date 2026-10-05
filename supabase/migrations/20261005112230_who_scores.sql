-- Vem svarade?: resultatet visar även allas poäng för aktiviteten, inte bara ens egna.

create or replace function public.who_player_state()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_phase text;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  v_phase := public.section_phase(v_player.room_id, 'who');

  if v_phase = 'answering' then
    return json_build_object(
      'phase', v_phase,
      'questions', coalesce((
        select json_agg(
          json_build_object('id', q.id, 'text', q.text, 'my_answer', a.text)
          order by q.created_at
        )
        from public.who_questions q
        left join public.who_answers a on a.question_id = q.id and a.player_id = v_player.id
        where q.room_id = v_player.room_id
      ), '[]'::json)
    );
  end if;

  if v_phase = 'guessing' then
    return json_build_object(
      'phase', v_phase,
      'cards', coalesce((
        select json_agg(
          json_build_object(
            'answer_id', a.id,
            'question', q.text,
            'text', a.text,
            'my_guess', g.guessed_player_id
          )
          -- Blandad ordning, men samma för spelaren varje gång sidan laddas.
          order by md5(a.id::text || v_player.id::text)
        )
        from public.who_answers a
        join public.who_questions q on q.id = a.question_id
        left join public.who_guesses g on g.answer_id = a.id and g.guesser_id = v_player.id
        where q.room_id = v_player.room_id and a.player_id <> v_player.id
      ), '[]'::json),
      -- De man kan gissa på: alla som har svarat, utom en själv.
      'players', coalesce((
        select json_agg(json_build_object('id', p.id, 'username', p.username) order by lower(p.username))
        from public.players p
        where p.room_id = v_player.room_id and p.id <> v_player.id
          and exists (
            select 1 from public.who_answers a
            join public.who_questions q on q.id = a.question_id
            where a.player_id = p.id and q.room_id = v_player.room_id
          )
      ), '[]'::json)
    );
  end if;

  if v_phase = 'finished' then
    return json_build_object(
      'phase', v_phase,
      'results', coalesce((
        select json_agg(
          json_build_object(
            'question', q.text,
            'text', a.text,
            'author', author.username,
            'mine', a.player_id = v_player.id,
            'my_guess', guessed.username,
            'correct', g.guessed_player_id = a.player_id
          )
          order by q.created_at, lower(author.username)
        )
        from public.who_answers a
        join public.who_questions q on q.id = a.question_id
        join public.players author on author.id = a.player_id
        left join public.who_guesses g on g.answer_id = a.id and g.guesser_id = v_player.id
        left join public.players guessed on guessed.id = g.guessed_player_id
        where q.room_id = v_player.room_id
      ), '[]'::json),
      'my_points', coalesce((
        select sum(points) from public.point_awards
        where player_id = v_player.id and section = 'who'
      ), 0),
      -- Allas poäng för aktiviteten, även de som fick 0. Lika poäng ger samma placering.
      'scores', coalesce((
        select json_agg(
          json_build_object('player_id', s.id, 'username', s.username, 'points', s.points, 'rank', s.rank)
          order by s.rank, lower(s.username)
        )
        from (
          select p.id, p.username, coalesce(sum(pa.points), 0) as points,
                 rank() over (order by coalesce(sum(pa.points), 0) desc) as rank
          from public.players p
          left join public.point_awards pa on pa.player_id = p.id and pa.section = 'who'
          where p.room_id = v_player.room_id
          group by p.id, p.username
        ) s
      ), '[]'::json),
      'my_player_id', v_player.id
    );
  end if;

  return json_build_object('phase', v_phase);
end;
$$;