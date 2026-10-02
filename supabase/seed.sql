-- Lokal testdata, körs bara av `npx supabase db reset` (aldrig av `db push`).

-- Testadmin: admin@kickoff.test / kickoff-admin. Bara lokalt – använd aldrig lösenordet på riktigt.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000ad',
  'authenticated', 'authenticated', 'admin@kickoff.test',
  extensions.crypt('kickoff-admin', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(), '00000000-0000-0000-0000-0000000000ad', '00000000-0000-0000-0000-0000000000ad',
  '{"sub": "00000000-0000-0000-0000-0000000000ad", "email": "admin@kickoff.test", "email_verified": true}',
  'email', now(), now(), now()
);

insert into public.admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');

-- Testrum så att startskärmen kan provas innan admin-sidorna finns.
insert into public.rooms (name, code) values ('Testrum', 'KICK26');
insert into public.rooms (name, code, closed_at) values ('Avslutat testrum', 'GAMMAL', now());

-- Testspelare med PIN 1234, tills "Ny spelare" finns.
insert into public.players (room_id, username, pin_hash)
select r.id, n.username, extensions.crypt('1234', extensions.gen_salt('bf'))
from public.rooms r, (values ('Anna'), ('Johan')) as n (username)
where r.code = 'KICK26';
