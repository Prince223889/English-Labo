create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.sub', true),'')::uuid $$;
create table public.access_codes(code_hash text primary key, is_enabled boolean default true);
create table public.student_profiles(id uuid primary key default gen_random_uuid(), code_hash text, auth_uid uuid, display_name text);
insert into public.access_codes values ('h1',true),('h2',true),('h3',true);
insert into public.student_profiles(code_hash,auth_uid,display_name) values ('h1','00000000-0000-0000-0000-000000000001','Awa'),('h2','00000000-0000-0000-0000-000000000002','Moussa'),('h3','00000000-0000-0000-0000-000000000003','Rokia');
