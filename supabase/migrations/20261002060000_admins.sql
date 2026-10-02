-- Administratörer: riktiga Supabase Auth-användare (e-post + lösenord) som finns i den här tabellen.
-- Skapa användaren i Studio/Dashboard och kör sedan supabase/snippets/make_admin.sql.

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- Inga policies: tabellen nås bara via is_admin().
alter table public.admins enable row level security;

-- Om anroparen är admin.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
