-- Lokal testdata, körs av `npx supabase db reset`.

-- Testrum så att startskärmen kan provas innan admin-sidorna finns.
insert into public.rooms (name, code) values ('Testrum', 'KICK26');

-- Testspelare med PIN 1234, tills "Ny spelare" finns.
insert into public.players (room_id, username, pin_hash)
select r.id, n.username, extensions.crypt('1234', extensions.gen_salt('bf'))
from public.rooms r, (values ('Anna'), ('Johan')) as n (username)
where r.code = 'KICK26';
