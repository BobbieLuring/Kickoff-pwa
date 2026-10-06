-- Sortera: rundor där spelarna sorterar sex namn. Redaktören lägger in rundorna,
-- admin öppnar och stänger dem en i taget, och poäng ges per rätt par.

create table public.order_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  phase text not null default 'closed' check (phase in ('closed', 'open', 'finished')),
  created_at timestamptz not null default now()
);

create index on public.order_rounds (room_id, created_at);

alter table public.order_rounds enable row level security;

-- Rundans sex namn. position är den rätta platsen (1–6). Värdet visas bara vid avslöjandet.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.order_rounds on delete cascade,
  label text not null check (length(trim(label)) between 1 and 40),
  value text not null check (length(trim(value)) between 1 and 40),
  position int not null check (position between 1 and 6),
  unique (round_id, position)
);

alter table public.order_items enable row level security;

-- Spelarens inskickade ordning: item_ids från första till sista plats.
create table public.order_submissions (
  round_id uuid not null references public.order_rounds on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  item_ids uuid[] not null,
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

alter table public.order_submissions enable row level security;

-- Antal par spelaren har i rätt inbördes ordning (0–15 för sex namn).
create function public.order_correct_pairs(p_round_id uuid, p_player_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.order_submissions s
  cross join lateral unnest(s.item_ids) with ordinality as a (item_id, ord)
  cross join lateral unnest(s.item_ids) with ordinality as b (item_id, ord)
  join public.order_items ia on ia.id = a.item_id
  join public.order_items ib on ib.id = b.item_id
  where s.round_id = p_round_id and s.player_id = p_player_id
    and a.ord < b.ord and ia.position < ib.position;
$$;

revoke execute on function public.order_correct_pairs(uuid, uuid) from public, anon, authenticated;

-- ── Redaktör ────────────────────────────────────────────────────────────────

-- Redaktörens rundor, med allt: namn, värden och rätt ordning.
create function public.editor_rounds()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  return coalesce((
    select json_agg(
      json_build_object(
        'id', r.id,
        'title', r.title,
        'phase', r.phase,
        'items', coalesce((
          select json_agg(json_build_object('label', i.label, 'value', i.value) order by i.position)
          from public.order_items i where i.round_id = r.id
        ), '[]'::json)
      )
      order by r.created_at
    )
    from public.order_rounds r
    where r.room_id = v_room_id
  ), '[]'::json);
end;
$$;

-- Skapar (p_round_id null) eller uppdaterar en runda. p_items: [{ "label", "value" }, ...] i rätt ordning,
-- exakt sex stycken. Bara medan rundan inte är öppnad.
create function public.editor_save_round(p_round_id uuid, p_title text, p_items json)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
  v_round_id uuid := p_round_id;
  v_title text := trim(p_title);
  v_item json;
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  if v_title is null or length(v_title) not between 1 and 120 then
    return json_build_object('ok', false, 'error', 'invalid_title');
  end if;

  if json_array_length(p_items) <> 6 then
    return json_build_object('ok', false, 'error', 'need_six');
  end if;

  for v_item in select * from json_array_elements(p_items) loop
    if length(trim(coalesce(v_item->>'label', ''))) not between 1 and 40
       or length(trim(coalesce(v_item->>'value', ''))) not between 1 and 40 then
      return json_build_object('ok', false, 'error', 'invalid_item');
    end if;
  end loop;

  if v_round_id is null then
    insert into public.order_rounds (room_id, title) values (v_room_id, v_title)
    returning id into v_round_id;
  else
    update public.order_rounds set title = v_title
    where id = v_round_id and room_id = v_room_id and phase = 'closed';
    if not found then
      return json_build_object('ok', false, 'error', 'not_editable');
    end if;
    delete from public.order_items where round_id = v_round_id;
  end if;

  insert into public.order_items (round_id, label, value, position)
  select v_round_id, trim(e.value->>'label'), trim(e.value->>'value'), e.ord::int
  from json_array_elements(p_items) with ordinality as e (value, ord);

  return json_build_object('ok', true, 'id', v_round_id);
end;
$$;

-- Tar bort en runda. Bara medan den inte är öppnad.
create function public.editor_delete_round(p_round_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  delete from public.order_rounds where id = p_round_id and room_id = v_room_id and phase = 'closed';
  if not found then
    return json_build_object('ok', false, 'error', 'not_editable');
  end if;
  return json_build_object('ok', true);
end;
$$;

-- ── Admin ───────────────────────────────────────────────────────────────────

-- Rundorna för adminfliken: titel, fas och hur många som skickat. Aldrig namn, värden eller ordning.
create function public.admin_order_rounds()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
begin
  return json_build_object(
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id),
    'rounds', coalesce((
      select json_agg(
        json_build_object(
          'id', r.id,
          'title', r.title,
          'phase', r.phase,
          'ready', (select count(*) = 6 from public.order_items i where i.round_id = r.id),
          'submitted_count', (select count(*) from public.order_submissions s where s.round_id = r.id)
        )
        order by r.created_at
      )
      from public.order_rounds r
      where r.room_id = v_admin.room_id
    ), '[]'::json)
  );
end;
$$;

-- Flyttar en runda ett steg framåt: closed → open → finished. När den avslutas delas poängen ut,
-- 2 per rätt par, i samma transaktion.
create function public.admin_advance_round(p_round_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
  v_phase text;
begin
  select phase into v_phase from public.order_rounds
  where id = p_round_id and room_id = v_admin.room_id
  for update;

  if v_phase is null then
    return json_build_object('ok', false, 'error', 'unknown_round');
  end if;

  if v_phase = 'closed' then
    if (select count(*) from public.order_items where round_id = p_round_id) <> 6 then
      return json_build_object('ok', false, 'error', 'not_ready');
    end if;
    update public.order_rounds set phase = 'open' where id = p_round_id;
    return json_build_object('ok', true, 'phase', 'open');
  end if;

  if v_phase = 'open' then
    update public.order_rounds set phase = 'finished' where id = p_round_id;
    insert into public.point_awards (room_id, player_id, section, points)
    select v_admin.room_id, s.player_id, 'order', 2 * public.order_correct_pairs(p_round_id, s.player_id)
    from public.order_submissions s
    where s.round_id = p_round_id and public.order_correct_pairs(p_round_id, s.player_id) > 0;
    return json_build_object('ok', true, 'phase', 'finished');
  end if;

  return json_build_object('ok', false, 'error', 'already_finished');
end;
$$;

-- ── Spelare ─────────────────────────────────────────────────────────────────

-- Alla rundor i rummet. Öppna: namnen i en blandad ordning (fast per spelare) och ens inskickade ordning.
-- Avslutade: rätt ordning med värden, ens ordning, antal rätta par och poäng.
create function public.order_state()
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

  return json_build_object('rounds', coalesce((
    select json_agg(
      case
        when r.phase = 'open' then json_build_object(
          'id', r.id, 'title', r.title, 'phase', r.phase,
          'items', (
            select json_agg(json_build_object('id', i.id, 'label', i.label)
                            order by md5(i.id::text || v_player.id::text))
            from public.order_items i where i.round_id = r.id
          ),
          'my_order', (select s.item_ids from public.order_submissions s
                       where s.round_id = r.id and s.player_id = v_player.id)
        )
        when r.phase = 'finished' then json_build_object(
          'id', r.id, 'title', r.title, 'phase', r.phase,
          'correct', (
            select json_agg(json_build_object('id', i.id, 'label', i.label, 'value', i.value)
                            order by i.position)
            from public.order_items i where i.round_id = r.id
          ),
          'my_order', (select s.item_ids from public.order_submissions s
                       where s.round_id = r.id and s.player_id = v_player.id),
          'correct_pairs', public.order_correct_pairs(r.id, v_player.id),
          'points', 2 * public.order_correct_pairs(r.id, v_player.id)
        )
        else json_build_object('id', r.id, 'title', r.title, 'phase', r.phase)
      end
      order by r.created_at
    )
    from public.order_rounds r
    where r.room_id = v_player.room_id
  ), '[]'::json));
end;
$$;

-- Skickar in eller ändrar spelarens ordning för en öppen runda. Måste innehålla exakt rundans sex namn.
create function public.order_submit(p_round_id uuid, p_item_ids uuid[])
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.order_rounds
    where id = p_round_id and room_id = v_player.room_id and phase = 'open'
  ) then
    return json_build_object('ok', false, 'error', 'not_open');
  end if;

  -- Samma sex namn, var och en exakt en gång.
  if cardinality(p_item_ids) <> 6
     or (select count(distinct x) from unnest(p_item_ids) as x) <> 6
     or exists (
       select 1 from unnest(p_item_ids) as x
       where not exists (select 1 from public.order_items i where i.id = x and i.round_id = p_round_id)
     ) then
    return json_build_object('ok', false, 'error', 'invalid_order');
  end if;

  insert into public.order_submissions (round_id, player_id, item_ids)
  values (p_round_id, v_player.id, p_item_ids)
  on conflict (round_id, player_id) do update set item_ids = excluded.item_ids, updated_at = now();

  return json_build_object('ok', true);
end;
$$;

-- ── Status för Hem och Aktiviteter ──────────────────────────────────────────

-- Som tidigare, plus 'order' för Sortera: 'open' om någon runda är öppen, 'finished' om alla är
-- avslutade, annars 'closed'.
create or replace function public.room_sections()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_result jsonb;
  v_order text;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  v_result := coalesce((
    select jsonb_object_agg(key, phase) from public.sections where room_id = v_player.room_id
  ), '{}'::jsonb);

  select case
           when bool_or(phase = 'open') then 'open'
           when count(*) > 0 and bool_and(phase = 'finished') then 'finished'
           else 'closed'
         end
  into v_order
  from public.order_rounds
  where room_id = v_player.room_id;

  return (v_result || jsonb_build_object('order', v_order))::json;
end;
$$;

revoke execute on function public.editor_rounds() from public, anon;
revoke execute on function public.editor_save_round(uuid, text, json) from public, anon;
revoke execute on function public.editor_delete_round(uuid) from public, anon;
revoke execute on function public.admin_order_rounds() from public, anon;
revoke execute on function public.admin_advance_round(uuid) from public, anon;
revoke execute on function public.order_state() from public, anon;
revoke execute on function public.order_submit(uuid, uuid[]) from public, anon;
grant execute on function public.editor_rounds() to authenticated;
grant execute on function public.editor_save_round(uuid, text, json) to authenticated;
grant execute on function public.editor_delete_round(uuid) to authenticated;
grant execute on function public.admin_order_rounds() to authenticated;
grant execute on function public.admin_advance_round(uuid) to authenticated;
grant execute on function public.order_state() to authenticated;
grant execute on function public.order_submit(uuid, uuid[]) to authenticated;