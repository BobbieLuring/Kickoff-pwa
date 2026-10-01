-- Lokal testdata, körs av `npx supabase db reset`.

-- Testrum så att startskärmen kan provas innan admin-sidorna finns.
insert into public.rooms (name, code) values ('Testrum', 'KICK26');
