-- English Arena: Supabase cloud mode
-- Run this entire file in Supabase Dashboard > SQL Editor.
-- Requires Anonymous Sign-Ins to be enabled in Authentication settings.
-- Access codes are stored as SHA-256 hashes, never as plaintext.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.access_codes (
  code_hash text primary key,
  label text not null default 'Terminale',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.student_profiles (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique references public.access_codes(code_hash) on delete restrict,
  auth_uid uuid unique references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 32),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.student_states (
  student_id uuid primary key references public.student_profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.access_codes enable row level security;
alter table public.student_profiles enable row level security;
alter table public.student_states enable row level security;

-- No direct table access from anon/authenticated clients. All access goes through
-- carefully-scoped SECURITY DEFINER functions below.
revoke all on public.access_codes from anon, authenticated;
revoke all on public.student_profiles from anon, authenticated;
revoke all on public.student_states from anon, authenticated;

create or replace function public.login_with_code(p_code text, p_display_name text)
returns table (id uuid, display_name text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Sign-in session missing. Try again.' using errcode = '28000';
  end if;
  if p_code is null or length(trim(p_code)) < 12 or length(trim(p_code)) > 64 then
    raise exception 'Invalid individual code.' using errcode = '22023';
  end if;
  if p_display_name is null or char_length(trim(p_display_name)) < 2 or char_length(trim(p_display_name)) > 32 then
    raise exception 'Name must contain 2 to 32 characters.' using errcode = '22023';
  end if;
  v_hash := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  v_name := regexp_replace(trim(p_display_name), '\s+', ' ', 'g');

  if not exists (select 1 from public.access_codes c where c.code_hash = v_hash and c.is_enabled = true) then
    raise exception 'Code not recognized. Ask the class administrator for a valid code.' using errcode = 'P0001';
  end if;

  -- A student code acts as the sign-in secret. Logging in on another device moves
  -- the active session to that device; the old anonymous session loses profile access.
  update public.student_profiles
     set auth_uid = null
   where auth_uid = v_uid and code_hash <> v_hash;

  return query
  insert into public.student_profiles as p (code_hash, auth_uid, display_name, last_seen_at)
  values (v_hash, v_uid, v_name, now())
  on conflict (code_hash) do update
    set auth_uid = excluded.auth_uid,
        display_name = excluded.display_name,
        last_seen_at = now()
    where exists (select 1 from public.access_codes c where c.code_hash = v_hash and c.is_enabled = true)
  returning p.id, p.display_name, p.created_at;
end;
$$;

create or replace function public.save_student_state(p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_student uuid;
begin
  if auth.uid() is null then raise exception 'Sign-in required.' using errcode = '28000'; end if;
  if p_state is null or pg_column_size(p_state) > 150000 then raise exception 'State too large.' using errcode = '22023'; end if;
  select p.id into v_student from public.student_profiles p join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true where p.auth_uid = auth.uid();
  if v_student is null then raise exception 'No active student profile for this device.' using errcode = '42501'; end if;
  insert into public.student_states(student_id, state, updated_at)
  values(v_student, p_state, now())
  on conflict(student_id) do update set state = excluded.state, updated_at = now();
  update public.student_profiles set last_seen_at = now() where id = v_student;
  return true;
end;
$$;

create or replace function public.load_student_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_student uuid; v_state jsonb;
begin
  if auth.uid() is null then raise exception 'Sign-in required.' using errcode = '28000'; end if;
  select p.id into v_student from public.student_profiles p join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true where p.auth_uid = auth.uid();
  if v_student is null then return null; end if;
  update public.student_profiles set last_seen_at = now() where id = v_student;
  select state into v_state from public.student_states where student_id = v_student;
  return coalesce(v_state, '{}'::jsonb);
end;
$$;

create or replace function public.class_stats()
returns table (students_total bigint, active_7_days bigint)
language sql
security definer
set search_path = public, pg_temp
as $$
  select count(*)::bigint,
         count(*) filter (where last_seen_at >= now() - interval '7 days')::bigint
    from public.student_profiles p
    join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true
   where p.auth_uid is not null;
$$;

revoke all on function public.login_with_code(text, text) from public;
revoke all on function public.save_student_state(jsonb) from public;
revoke all on function public.load_student_state() from public;
revoke all on function public.class_stats() from public;
grant execute on function public.login_with_code(text, text) to anon, authenticated;
grant execute on function public.save_student_state(jsonb) to authenticated;
grant execute on function public.load_student_state() to authenticated;
grant execute on function public.class_stats() to anon, authenticated;

-- To revoke a leaked code, update its row in the SQL editor:
-- update public.access_codes set is_enabled = false where code_hash = encode(extensions.digest(upper('PASTE-REAL-CODE-HERE'), 'sha256'), 'hex');


-- =====================================================================
-- V2 : PDF privés, annonces, classement et administration
-- (à exécuter dans le même SQL Editor, après la partie ci-dessus)
-- =====================================================================

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 600),
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
alter table public.announcements enable row level security;
revoke all on public.admins from anon, authenticated;
revoke all on public.announcements from anon, authenticated;

-- Un admin = un vrai compte e-mail/mot de passe (pas une session anonyme) listé dans public.admins.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid())
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

create or replace function public.is_active_student() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.student_profiles p
    join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true
    where p.auth_uid = auth.uid());
$$;

-- ---------- Stockage privé des PDF ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-files', 'course-files', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false;

drop policy if exists "ea read course files" on storage.objects;
create policy "ea read course files" on storage.objects for select to authenticated
  using (bucket_id = 'course-files' and (public.is_active_student() or public.is_admin()));

-- ---------- Fonctions pour les élèves ----------
create or replace function public.list_announcements()
returns table (id uuid, title text, body text, is_pinned boolean, created_at timestamptz)
language sql security definer set search_path = public, pg_temp as $$
  select a.id, a.title, a.body, a.is_pinned, a.created_at from public.announcements a
  where public.is_active_student() or public.is_admin()
  order by a.is_pinned desc, a.created_at desc limit 5;
$$;

create or replace function public.leaderboard()
returns table (display_name text, xp int, lessons int)
language sql security definer set search_path = public, pg_temp as $$
  select p.display_name,
         case when jsonb_typeof(s.state -> 'xp') = 'number' then (s.state ->> 'xp')::numeric::int else 0 end,
         case when jsonb_typeof(s.state -> 'completedDays') = 'array' then jsonb_array_length(s.state -> 'completedDays') else 0 end
  from public.student_profiles p
  join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true
  left join public.student_states s on s.student_id = p.id
  where public.is_active_student() and p.auth_uid is not null
  order by 2 desc, 3 desc limit 10;
$$;

-- ---------- Fonctions administrateur ----------
create or replace function public.admin_add_codes(p_codes text[], p_labels text[])
returns int language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare i int; n int := 0; h text;
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  if coalesce(array_length(p_codes,1),0) = 0 or array_length(p_codes,1) > 200 then raise exception 'Between 1 and 200 codes.' using errcode = '22023'; end if;
  for i in 1 .. array_length(p_codes,1) loop
    if length(trim(p_codes[i])) < 12 then continue; end if;
    h := encode(extensions.digest(upper(trim(p_codes[i])), 'sha256'), 'hex');
    insert into public.access_codes(code_hash, label)
    values (h, left(coalesce(nullif(trim(p_labels[i]), ''), 'Terminale'), 60))
    on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.admin_overview()
returns table (codes_total bigint, codes_used bigint, active_7_days bigint, avg_xp numeric, total_lessons bigint)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  return query
  select (select count(*) from public.access_codes),
         (select count(*) from public.student_profiles),
         (select count(*) from public.student_profiles where last_seen_at >= now() - interval '7 days'),
         coalesce((select avg(case when jsonb_typeof(state->'xp')='number' then (state->>'xp')::numeric else 0 end) from public.student_states),0),
         coalesce((select sum(case when jsonb_typeof(state->'completedDays')='array' then jsonb_array_length(state->'completedDays') else 0 end) from public.student_states),0)::bigint;
end $$;

create or replace function public.admin_list_students()
returns table (code_hash text, label text, is_enabled boolean, display_name text, last_seen_at timestamptz,
               has_device boolean, xp int, lessons int, streak int)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  return query
  select c.code_hash, c.label, c.is_enabled, p.display_name, p.last_seen_at, (p.auth_uid is not null),
         case when jsonb_typeof(s.state->'xp')='number' then (s.state->>'xp')::numeric::int else 0 end,
         case when jsonb_typeof(s.state->'completedDays')='array' then jsonb_array_length(s.state->'completedDays') else 0 end,
         case when jsonb_typeof(s.state->'streak')='number' then (s.state->>'streak')::numeric::int else 0 end
  from public.access_codes c
  left join public.student_profiles p on p.code_hash = c.code_hash
  left join public.student_states s on s.student_id = p.id
  order by c.label;
end $$;

create or replace function public.admin_set_code_enabled(p_code_hash text, p_enabled boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  update public.access_codes set is_enabled = p_enabled where code_hash = p_code_hash;
end $$;

create or replace function public.admin_reset_device(p_code_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  update public.student_profiles set auth_uid = null where code_hash = p_code_hash;
end $$;

create or replace function public.admin_delete_code(p_code_hash text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  delete from public.student_profiles where code_hash = p_code_hash;
  delete from public.access_codes where code_hash = p_code_hash;
end $$;

-- Code perdu ou volé : nouveau code, la progression de l'élève est conservée.
create or replace function public.admin_replace_code(p_old_hash text, p_new_code text)
returns void language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare h text; l text;
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  if length(trim(p_new_code)) < 12 then raise exception 'Code too short.' using errcode = '22023'; end if;
  h := encode(extensions.digest(upper(trim(p_new_code)), 'sha256'), 'hex');
  select label into l from public.access_codes where code_hash = p_old_hash;
  if l is null then raise exception 'Unknown code.' using errcode = 'P0002'; end if;
  insert into public.access_codes(code_hash, label) values (h, l);
  update public.student_profiles set code_hash = h, auth_uid = null where code_hash = p_old_hash;
  delete from public.access_codes where code_hash = p_old_hash;
end $$;

create or replace function public.admin_post_announcement(p_title text, p_body text, p_pinned boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  insert into public.announcements(title, body, is_pinned) values (trim(p_title), trim(p_body), coalesce(p_pinned,false));
end $$;

create or replace function public.admin_delete_announcement(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  delete from public.announcements where id = p_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'is_admin()','is_active_student()','list_announcements()','leaderboard()',
    'admin_add_codes(text[],text[])','admin_overview()','admin_list_students()',
    'admin_set_code_enabled(text,boolean)','admin_reset_device(text)','admin_delete_code(text)',
    'admin_replace_code(text,text)','admin_post_announcement(text,text,boolean)','admin_delete_announcement(uuid)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- Créer TON compte administrateur ----------
-- 1) Supabase > Authentication > Users > Add user > e-mail + mot de passe fort (coche "Auto Confirm User").
-- 2) Remplace l'e-mail ci-dessous par le tien, puis exécute cette ligne :
-- insert into public.admins(user_id) select id from auth.users where email = 'TON-EMAIL@exemple.com';


-- =====================================================================
-- V3 : petite messagerie de classe (messages courts, quasi aucun stockage)
-- =====================================================================
alter table public.student_profiles add column if not exists is_muted boolean not null default false;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  author text not null,
  body text not null check (char_length(body) between 1 and 220),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_created_idx on public.messages (created_at desc);
create table if not exists public.message_reports (
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter uuid not null references public.student_profiles(id) on delete cascade,
  primary key (message_id, reporter)
);
alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
revoke all on public.messages from anon, authenticated;
revoke all on public.message_reports from anon, authenticated;

create or replace function public.post_message(p_body text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student uuid; v_name text; v_muted boolean; v_body text := regexp_replace(trim(coalesce(p_body,'')), '\s+', ' ', 'g');
begin
  select p.id, p.display_name, p.is_muted into v_student, v_name, v_muted
    from public.student_profiles p join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true
   where p.auth_uid = auth.uid();
  if v_student is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if v_muted then raise exception 'Tu ne peux pas écrire pour le moment.' using errcode = '42501'; end if;
  if char_length(v_body) not between 1 and 220 then raise exception 'Message de 1 à 220 caractères.' using errcode = '22023'; end if;
  if v_body ~* '(https?://|www\.|\.(com|net|org|ml|fr|io|me|ly)(/|\s|$))' then raise exception 'Les liens ne sont pas autorisés dans les messages.' using errcode = '22023'; end if;
  if exists (select 1 from public.messages where student_id = v_student and created_at > now() - interval '8 seconds') then
    raise exception 'Doucement ! Attends quelques secondes.' using errcode = 'P0001'; end if;
  if (select count(*) from public.messages where student_id = v_student and created_at > now() - interval '1 day') >= 40 then
    raise exception 'Limite de 40 messages par jour atteinte.' using errcode = 'P0001'; end if;
  insert into public.messages(student_id, author, body) values (v_student, v_name, v_body);
  -- stockage minuscule : 30 jours max et 200 messages max
  delete from public.messages where created_at < now() - interval '30 days';
  delete from public.messages where id in (select id from public.messages order by created_at desc offset 200);
end $$;

create or replace function public.list_messages()
returns table (id uuid, author text, body text, created_at timestamptz, mine boolean)
language sql security definer set search_path = public, pg_temp as $$
  select m.id, m.author, m.body, m.created_at,
         coalesce(m.student_id = (select p.id from public.student_profiles p where p.auth_uid = auth.uid()), false)
  from public.messages m
  where not m.is_hidden and (public.is_active_student() or public.is_admin())
  order by m.created_at desc limit 50;
$$;

create or replace function public.delete_my_message(p_id uuid) returns void
language sql security definer set search_path = public, pg_temp as $$
  delete from public.messages where id = p_id
    and student_id = (select p.id from public.student_profiles p where p.auth_uid = auth.uid());
$$;

-- 3 signalements d'élèves différents = message masqué automatiquement (l'admin décide ensuite)
create or replace function public.report_message(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_student uuid;
begin
  select p.id into v_student from public.student_profiles p
    join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true where p.auth_uid = auth.uid();
  if v_student is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  insert into public.message_reports(message_id, reporter) values (p_id, v_student) on conflict do nothing;
  update public.messages set is_hidden = true
   where id = p_id and (select count(*) from public.message_reports r where r.message_id = p_id) >= 3;
end $$;

create or replace function public.admin_list_messages()
returns table (id uuid, author text, body text, created_at timestamptz, is_hidden boolean, reports bigint, code_hash text, is_muted boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  return query
  select m.id, m.author, m.body, m.created_at, m.is_hidden,
         (select count(*) from public.message_reports r where r.message_id = m.id),
         p.code_hash, p.is_muted
  from public.messages m join public.student_profiles p on p.id = m.student_id
  order by m.created_at desc limit 100;
end $$;

create or replace function public.admin_delete_message(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  delete from public.messages where id = p_id;
end $$;

create or replace function public.admin_restore_message(p_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  delete from public.message_reports where message_id = p_id;
  update public.messages set is_hidden = false where id = p_id;
end $$;

create or replace function public.admin_set_muted(p_code_hash text, p_muted boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  update public.student_profiles set is_muted = p_muted where code_hash = p_code_hash;
end $$;

do $$
declare f text;
begin
  foreach f in array array['post_message(text)','list_messages()','delete_my_message(uuid)','report_message(uuid)',
    'admin_list_messages()','admin_delete_message(uuid)','admin_restore_message(uuid)','admin_set_muted(text,boolean)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;


-- =====================================================================
-- V4 : sécurité renforcée (anti-force-brute, journal d'audit, temps réel privé)
-- =====================================================================
create table if not exists public.login_failures (
  id bigint generated always as identity primary key,
  auth_uid uuid, at timestamptz not null default now());
create index if not exists login_failures_at_idx on public.login_failures (at);
alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated;

create or replace function public.login_with_code(p_code text, p_display_name text)
returns table (id uuid, display_name text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_uid uuid := auth.uid(); v_hash text; v_name text;
begin
  if v_uid is null then raise exception 'Sign-in session missing. Try again.' using errcode = '28000'; end if;
  if p_code is null or length(trim(p_code)) < 12 or length(trim(p_code)) > 64 then raise exception 'Invalid individual code.' using errcode = '22023'; end if;
  if p_display_name is null or char_length(trim(p_display_name)) < 2 or char_length(trim(p_display_name)) > 32 then raise exception 'Name must contain 2 to 32 characters.' using errcode = '22023'; end if;
  if (select count(*) from public.login_failures f where f.auth_uid = v_uid and f.at > now() - interval '10 minutes') >= 8 then
    raise exception 'Trop de tentatives. Attends 10 minutes.' using errcode = 'P0001'; end if;
  if (select count(*) from public.login_failures f where f.at > now() - interval '1 minute') >= 300 then
    raise exception 'Service très sollicité, réessaie dans une minute.' using errcode = 'P0001'; end if;
  v_hash := encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex');
  v_name := regexp_replace(trim(p_display_name), '\s+', ' ', 'g');
  if not exists (select 1 from public.access_codes c where c.code_hash = v_hash and c.is_enabled = true) then
    insert into public.login_failures(auth_uid) values (v_uid);
    delete from public.login_failures f where f.at < now() - interval '1 day';
    return; -- aucun profil : l'application affiche « Code non reconnu »
  end if;
  update public.student_profiles set auth_uid = null where auth_uid = v_uid and code_hash <> v_hash;
  return query
  insert into public.student_profiles as p (code_hash, auth_uid, display_name, last_seen_at)
  values (v_hash, v_uid, v_name, now())
  on conflict (code_hash) do update set auth_uid = excluded.auth_uid, display_name = excluded.display_name, last_seen_at = now()
  returning p.id, p.display_name, p.created_at;
end $$;
revoke all on function public.login_with_code(text, text) from public;
grant execute on function public.login_with_code(text, text) to anon, authenticated;

-- Journal d'audit : toute action faite par un administrateur est enregistrée automatiquement.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), actor uuid, tbl text, op text, ref text);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare j jsonb;
begin
  if public.is_admin() then
    j := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
    insert into public.audit_log(actor, tbl, op, ref) values (auth.uid(), TG_TABLE_NAME, TG_OP, left(coalesce(j->>'code_hash', j->>'id', ''), 8));
  end if;
  return null;
end $$;

drop trigger if exists ea_audit_codes on public.access_codes;
create trigger ea_audit_codes after insert or update or delete on public.access_codes for each row execute function public.audit_trigger();
drop trigger if exists ea_audit_news on public.announcements;
create trigger ea_audit_news after insert or update or delete on public.announcements for each row execute function public.audit_trigger();
drop trigger if exists ea_audit_msgs on public.messages;
create trigger ea_audit_msgs after update or delete on public.messages for each row execute function public.audit_trigger();
drop trigger if exists ea_audit_profiles on public.student_profiles;
create trigger ea_audit_profiles after update or delete on public.student_profiles for each row execute function public.audit_trigger();

create or replace function public.admin_audit()
returns table (at timestamptz, email text, tbl text, op text, ref text)
language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  return query select a.at, u.email::text, a.tbl, a.op, a.ref from public.audit_log a left join auth.users u on u.id = a.actor order by a.at desc limit 100;
end $$;
create or replace function public.admin_failed_logins() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.is_admin() then raise exception 'Admin only.' using errcode = '42501'; end if;
  return (select count(*) from public.login_failures f where f.at > now() - interval '24 hours');
end $$;
revoke all on function public.admin_audit() from public; revoke all on function public.admin_failed_logins() from public;
grant execute on function public.admin_audit() to authenticated; grant execute on function public.admin_failed_logins() to authenticated;

-- Temps réel PRIVÉ : seuls les élèves actifs et l'admin peuvent écouter/envoyer (chat et duels).
drop policy if exists "ea realtime read" on realtime.messages;
create policy "ea realtime read" on realtime.messages for select to authenticated using (public.is_active_student() or public.is_admin());
drop policy if exists "ea realtime write" on realtime.messages;
create policy "ea realtime write" on realtime.messages for insert to authenticated with check (public.is_active_student() or public.is_admin());
