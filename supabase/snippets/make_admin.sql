-- Gör en befintlig användare till admin.
-- 1. Skapa användaren: Studio/Dashboard → Authentication → Users → Add user → Create new user
--    (e-post + riktigt lösenord, bocka i "Auto Confirm User").
-- 2. Byt e-posten och namnet nedan och kör i SQL Editor.
--    Namnet (1–30 tecken) är det admin heter som spelare i rummen.

insert into public.admins (user_id, name)
select id, 'Förnamn Efternamn' from auth.users where email = 'namn@exempel.se'
on conflict (user_id) do update set name = excluded.name;

-- Kontroll: ska visa användaren.
select u.email, a.name, a.created_at
from public.admins a
join auth.users u on u.id = a.user_id;
