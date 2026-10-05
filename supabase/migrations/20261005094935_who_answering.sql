-- Vem svarade?: spelarens vy och att skicka svar.

-- Vad Svara-fliken ska visa. Under 'answering': frågorna med anroparens egna svar.
-- Övriga faser fylls på när gissning och resultat byggs.
create function public.who_player_state()
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

  if v_phase <> 'answering' then
    return json_build_object('phase', v_phase);
  end if;

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
end;
$$;

-- Sparar anroparens svar: [{ "question_id": ..., "text": ... }, ...].
-- Går att skicka igen för att ändra, så länge svar pågår. Allt kontrolleras innan något sparas.
create function public.who_submit_answers(p_answers json)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_item json;
  v_text text;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if public.section_phase(v_player.room_id, 'who') <> 'answering' then
    return json_build_object('ok', false, 'error', 'not_answering');
  end if;

  for v_item in select * from json_array_elements(p_answers) loop
    v_text := trim(v_item->>'text');
    if v_text is null or length(v_text) not between 1 and 200 then
      return json_build_object('ok', false, 'error', 'invalid_text');
    end if;

    -- Bara frågor i spelarens eget rum.
    if not exists (
      select 1 from public.who_questions
      where id = (v_item->>'question_id')::uuid and room_id = v_player.room_id
    ) then
      return json_build_object('ok', false, 'error', 'unknown_question');
    end if;
  end loop;

  for v_item in select * from json_array_elements(p_answers) loop
    insert into public.who_answers (question_id, player_id, text)
    values ((v_item->>'question_id')::uuid, v_player.id, trim(v_item->>'text'))
    on conflict (question_id, player_id) do update set text = excluded.text;
  end loop;

  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.who_player_state() from public, anon;
revoke execute on function public.who_submit_answers(json) from public, anon;
grant execute on function public.who_player_state() to authenticated;
grant execute on function public.who_submit_answers(json) to authenticated;