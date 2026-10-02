-- Gör en befintlig användare till admin.
-- 1. Skapa användaren: Studio/Dashboard → Authentication → Users → Add user → Create new user
--    (e-post + riktigt lösenord, bocka i "Auto Confirm User").
-- 2. Byt e-posten nedan och kör i SQL Editor.

insert into public.admins (user_id)
select id from auth.users where email = 'namn@exempel.se'
on conflict do nothing;

-- Kontroll: ska visa användaren.
select u.email, a.created_at
from public.admins a
join auth.users u on u.id = a.user_id;
