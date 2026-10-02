-- current_player anger även is_admin: om spelaren är anroparens admin-spelare.
-- Används för att visa Admin-fliken i bottenmenyn. Behörighet kontrolleras alltid i databasen.

create or replace function public.current_player()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'id', p.id,
    'username', p.username,
    'room_name', r.name,
    'is_admin', coalesce(p.admin_user_id = auth.uid(), false)
  )
  from public.players p
  join public.rooms r on r.id = p.room_id
  where p.user_id = auth.uid() and r.closed_at is null;
$$;
