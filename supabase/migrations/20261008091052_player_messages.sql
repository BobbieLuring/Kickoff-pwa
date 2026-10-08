-- Meddelanden mellan spelare: kort fritext som dyker upp hos mottagaren som en bubbla.
-- Databasen sätter avsändaren, så att ingen kan låtsas vara någon annan.

create table public.player_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms on delete cascade,
  sender_id uuid not null references public.players on delete cascade,
  recipient_id uuid not null references public.players on delete cascade,
  text text not null check (length(trim(text)) between 1 and 60),
  created_at timestamptz not null default now(),
  -- När mottagaren hämtat meddelandet. Null = inte visat än.
  seen_at timestamptz
);

create index on public.player_messages (recipient_id, seen_at);
create index on public.player_messages (sender_id, created_at);

alter table public.player_messages enable row level security;

-- Anroparens spelar-id. Används av policyn, därför körbar för inloggade.
create function public.my_player_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.players where user_id = auth.uid();
$$;

revoke execute on function public.my_player_id() from public, anon;
grant execute on function public.my_player_id() to authenticated;

-- Bara mottagaren får läsa sina meddelanden. Behövs för att Realtime ska leverera till rätt person.
-- Ingen policy för att skriva: meddelanden skickas bara via send_message.
create policy "recipients read their own messages"
  on public.player_messages for select
  to authenticated
  using (recipient_id = public.my_player_id());

-- "Ringklockan": mottagaren får besked när ett nytt meddelande kommer.
alter publication supabase_realtime add table public.player_messages;

-- Skickar ett meddelande. Högst ett per 10 sekunder per avsändare.
create function public.send_message(p_recipient_id uuid, p_text text)
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

  if v_text is null or length(v_text) not between 1 and 60 then
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

-- Hämtar anroparens olästa meddelanden, äldst först, och markerar dem som visade i samma steg.
-- p_limit: hur många som högst hämtas (de senaste); äldre olästa markeras också som visade.
create function public.messages_take(p_limit int default 50)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_result json;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  select coalesce(json_agg(
           json_build_object('id', m.id, 'sender_id', m.sender_id, 'sender_name', s.username, 'text', m.text)
           order by m.created_at
         ), '[]'::json)
  into v_result
  from (
    select * from public.player_messages
    where recipient_id = v_player.id and seen_at is null
    order by created_at desc
    limit greatest(p_limit, 0)
  ) m
  join public.players s on s.id = m.sender_id;

  update public.player_messages set seen_at = now()
  where recipient_id = v_player.id and seen_at is null;

  return v_result;
end;
$$;

-- Nyckeln till rummets Realtime-kanal för onlineprickarna: rummets id, som inte går att gissa.
create function public.my_presence_key()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select room_id from public.players where user_id = auth.uid();
$$;

revoke execute on function public.send_message(uuid, text) from public, anon;
revoke execute on function public.messages_take(int) from public, anon;
revoke execute on function public.my_presence_key() from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.messages_take(int) to authenticated;
grant execute on function public.my_presence_key() to authenticated;