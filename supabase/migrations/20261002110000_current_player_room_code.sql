-- current_player anger även room_code, men bara för anroparens admin-spelare (annars null).
-- Visas på Admin-fliken så att admin kan dela koden. Vanliga spelare får aldrig koden från servern.

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
    'is_admin', coalesce(p.admin_user_id = auth.uid(), false),
    'room_code', case when p.admin_user_id = auth.uid() then r.code end
  )
  from public.players p
  join public.rooms r on r.id = p.room_id
  where p.user_id = auth.uid() and r.closed_at is null;
$$;
