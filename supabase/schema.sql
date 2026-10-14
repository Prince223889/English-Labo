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

-- =====================================================================
-- DUELS EN TEMPS RÉEL + TOURNOIS : moteur de score AUTORITAIRE côté serveur
-- (ajouts uniquement : aucune table existante n'est modifiée, aucun élève n'est effacé)
--  * la bonne réponse n'est JAMAIS envoyée aux joueurs avant qu'ils aient répondu ;
--  * le chrono et les points sont calculés par la base (now()), pas par le navigateur ;
--  * le Broadcast ne sert plus qu'à « réveiller » les clients, qui relisent l'état officiel.
-- =====================================================================
create or replace function public.ea_me() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id from public.student_profiles p
  join public.access_codes c on c.code_hash = p.code_hash and c.is_enabled = true
  where p.auth_uid = auth.uid();
$$;
revoke all on function public.ea_me() from public; grant execute on function public.ea_me() to authenticated;

create table if not exists public.duel_rooms (
  code text primary key check (code ~ '^[A-Z]{4}$'),
  host uuid not null references public.student_profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','running','done')),
  nq int not null check (nq between 3 and 30),
  qtime_ms int not null check (qtime_ms between 5000 and 60000),
  cur int not null default -1,
  q_started timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.duel_questions (
  code text not null references public.duel_rooms(code) on delete cascade,
  idx int not null, question text not null, options jsonb not null,
  primary key (code, idx)
);
create table if not exists public.duel_keys (
  code text not null, idx int not null, answer int not null check (answer between 0 and 3),
  primary key (code, idx), foreign key (code, idx) references public.duel_questions(code, idx) on delete cascade
);
create table if not exists public.duel_players (
  code text not null references public.duel_rooms(code) on delete cascade,
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  name text not null, score int not null default 0, joined_at timestamptz not null default now(),
  primary key (code, student_id)
);
create table if not exists public.duel_answers (
  code text not null, idx int not null, student_id uuid not null,
  choice int not null, ok boolean not null, pts int not null, ms int not null,
  primary key (code, idx, student_id),
  foreign key (code, student_id) references public.duel_players(code, student_id) on delete cascade
);
alter table public.duel_rooms enable row level security;
alter table public.duel_questions enable row level security;
alter table public.duel_keys enable row level security;
alter table public.duel_players enable row level security;
alter table public.duel_answers enable row level security;
revoke all on public.duel_rooms, public.duel_questions, public.duel_keys, public.duel_players, public.duel_answers from anon, authenticated;

create or replace function public.create_duel(p_code text, p_questions jsonb, p_qtime_ms int default 15000)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_me uuid := public.ea_me(); v_name text; v_n int; v_i int; v_q jsonb;
begin
  if v_me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_code !~ '^[A-Z]{4}$' then raise exception 'Code invalide.' using errcode = '22023'; end if;
  if jsonb_typeof(p_questions) <> 'array' then raise exception 'Questions invalides.' using errcode = '22023'; end if;
  v_n := jsonb_array_length(p_questions);
  if v_n not between 3 and 30 then raise exception 'Entre 3 et 30 questions.' using errcode = '22023'; end if;
  if p_qtime_ms not between 5000 and 60000 then raise exception 'Temps invalide.' using errcode = '22023'; end if;
  delete from public.duel_rooms where created_at < now() - interval '1 day' or host = v_me;
  if exists (select 1 from public.duel_rooms where code = p_code) then raise exception 'Ce code est déjà utilisé, réessaie.' using errcode = 'P0001'; end if;
  select display_name into v_name from public.student_profiles where id = v_me;
  insert into public.duel_rooms(code, host, nq, qtime_ms) values (p_code, v_me, v_n, p_qtime_ms);
  for v_i in 0 .. v_n - 1 loop
    v_q := p_questions -> v_i;
    if jsonb_typeof(v_q -> 'o') <> 'array' or jsonb_array_length(v_q -> 'o') <> 4 or (v_q ->> 'a') !~ '^[0-3]$'
       or char_length(coalesce(v_q ->> 'q', '')) not between 3 and 400 then raise exception 'Question % invalide.', v_i using errcode = '22023'; end if;
    insert into public.duel_questions(code, idx, question, options) values (p_code, v_i, v_q ->> 'q', v_q -> 'o');
    insert into public.duel_keys(code, idx, answer) values (p_code, v_i, (v_q ->> 'a')::int);
  end loop;
  insert into public.duel_players(code, student_id, name) values (p_code, v_me, v_name);
end $$;

create or replace function public.join_duel(p_code text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_me uuid := public.ea_me(); v_name text; v_r public.duel_rooms;
begin
  if v_me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select * into v_r from public.duel_rooms where code = upper(p_code);
  if not found or v_r.status = 'done' then raise exception 'Duel introuvable ou terminé.' using errcode = 'P0001'; end if;
  if (select count(*) from public.duel_players where code = v_r.code) >= 60 then raise exception 'Duel complet (60 joueurs).' using errcode = 'P0001'; end if;
  select display_name into v_name from public.student_profiles where id = v_me;
  insert into public.duel_players(code, student_id, name) values (v_r.code, v_me, v_name) on conflict do nothing;
end $$;

create or replace function public.start_duel(p_code text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.duel_rooms set status = 'running', cur = 0, q_started = now()
   where code = p_code and host = public.ea_me() and status = 'lobby';
  if not found then raise exception 'Seul le créateur peut lancer un duel en attente.' using errcode = '42501'; end if;
end $$;

create or replace function public.advance_duel(p_code text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_r public.duel_rooms; v_answered int; v_players int;
begin
  select * into v_r from public.duel_rooms where code = p_code and host = public.ea_me() for update;
  if not found or v_r.status <> 'running' then raise exception 'Duel non lancé.' using errcode = '42501'; end if;
  select count(*) into v_players from public.duel_players where code = p_code;
  select count(*) into v_answered from public.duel_answers where code = p_code and idx = v_r.cur;
  if now() < v_r.q_started + make_interval(secs => v_r.qtime_ms / 1000.0) and v_answered < v_players then
    raise exception 'Trop tôt : la question est encore en cours.' using errcode = 'P0001'; end if;
  if v_r.cur + 1 >= v_r.nq then update public.duel_rooms set status = 'done' where code = p_code;
  else update public.duel_rooms set cur = cur + 1, q_started = now() where code = p_code; end if;
end $$;

create or replace function public.submit_duel_answer(p_code text, p_idx int, p_choice int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_me uuid := public.ea_me(); v_r public.duel_rooms; v_ms int; v_key int; v_ok boolean; v_pts int;
begin
  if v_me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_choice not between 0 and 3 then raise exception 'Choix invalide.' using errcode = '22023'; end if;
  select * into v_r from public.duel_rooms where code = p_code;
  if not found or v_r.status <> 'running' or v_r.cur <> p_idx then raise exception 'Question terminée.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.duel_players where code = p_code and student_id = v_me) then raise exception 'Tu ne joues pas dans ce duel.' using errcode = '42501'; end if;
  if exists (select 1 from public.duel_answers where code = p_code and idx = p_idx and student_id = v_me) then raise exception 'Déjà répondu.' using errcode = 'P0001'; end if;
  v_ms := floor(extract(epoch from (now() - v_r.q_started)) * 1000)::int;
  if v_ms > v_r.qtime_ms + 1500 then raise exception 'Trop tard.' using errcode = 'P0001'; end if;
  select answer into v_key from public.duel_keys where code = p_code and idx = p_idx;
  v_ok := (v_key = p_choice);
  v_pts := case when v_ok then 100 + round(greatest(0, v_r.qtime_ms - v_ms) / 150.0)::int else 0 end;
  insert into public.duel_answers(code, idx, student_id, choice, ok, pts, ms) values (p_code, p_idx, v_me, p_choice, v_ok, v_pts, v_ms);
  update public.duel_players set score = score + v_pts where code = p_code and student_id = v_me;
  return jsonb_build_object('ok', v_ok, 'pts', v_pts, 'correct', v_key);
end $$;

create or replace function public.duel_state(p_code text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_me uuid := public.ea_me(); v_r public.duel_rooms; v_el int; v_reveal boolean; v_ans int; v_pl int; v_q jsonb; v_key int; v_mine int;
begin
  if v_me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select * into v_r from public.duel_rooms where code = p_code;
  if not found then raise exception 'Duel introuvable.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.duel_players where code = p_code and student_id = v_me) then raise exception 'Tu ne joues pas dans ce duel.' using errcode = '42501'; end if;
  v_el := case when v_r.q_started is null then null else floor(extract(epoch from (now() - v_r.q_started)) * 1000)::int end;
  select count(*) into v_pl from public.duel_players where code = p_code;
  if v_r.status = 'running' then
    select count(*) into v_ans from public.duel_answers where code = p_code and idx = v_r.cur;
    v_reveal := v_el >= v_r.qtime_ms or v_ans >= v_pl;
    select jsonb_build_object('idx', idx, 'q', question, 'o', options) into v_q from public.duel_questions where code = p_code and idx = v_r.cur;
    select choice into v_mine from public.duel_answers where code = p_code and idx = v_r.cur and student_id = v_me;
    if v_reveal or v_mine is not null then select answer into v_key from public.duel_keys where code = p_code and idx = v_r.cur; end if;
  end if;
  return jsonb_build_object('status', v_r.status, 'cur', v_r.cur, 'nq', v_r.nq, 'qtime_ms', v_r.qtime_ms, 'elapsed_ms', v_el,
    'is_host', v_r.host = v_me, 'question', v_q, 'reveal', coalesce(v_reveal, false), 'answer', v_key, 'mine', v_mine,
    'players', (select coalesce(jsonb_agg(jsonb_build_object('name', p.name, 'score', p.score, 'me', p.student_id = v_me,
         'answered', exists (select 1 from public.duel_answers a where a.code = p.code and a.idx = v_r.cur and a.student_id = p.student_id)) order by p.score desc, p.joined_at), '[]'::jsonb)
       from public.duel_players p where p.code = p_code));
end $$;

-- ---------- Tournois : TOUTES les manches sont générées automatiquement ----------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.student_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  format text not null check (format in ('roundrobin','knockout')),
  status text not null default 'running' check (status in ('running','done')),
  created_at timestamptz not null default now()
);
create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  seed int not null, name text not null check (char_length(name) between 1 and 40),
  primary key (tournament_id, seed)
);
create table if not exists public.tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round int not null, slot int not null,
  team_a int, team_b int, score_a int, score_b int, winner int,
  is_bye boolean not null default false,
  next_match uuid, next_side text check (next_side in ('a','b')),
  unique (tournament_id, round, slot)
);
alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_matches enable row level security;
revoke all on public.tournaments, public.tournament_teams, public.tournament_matches from anon, authenticated;

create or replace function public.create_tournament(p_name text, p_format text, p_teams text[]) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_me uuid := public.ea_me(); v_id uuid; v_n int; v_i int; v_r int; v_m int; v_arr int[]; v_p int; v_ord int[]; v_next int[]; v_len int; v_x int; v_rounds int;
  v_a int; v_b int; v_mid uuid; v_nm uuid; rec record;
begin
  if v_me is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_format not in ('roundrobin','knockout') then raise exception 'Format invalide.' using errcode = '22023'; end if;
  v_n := coalesce(array_length(p_teams, 1), 0);
  if v_n not between 2 and 32 then raise exception 'Entre 2 et 32 équipes.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_teams) t where char_length(trim(t)) not between 1 and 40) or (select count(distinct lower(trim(t))) from unnest(p_teams) t) <> v_n then
    raise exception 'Noms d’équipes vides ou en double.' using errcode = '22023'; end if;
  delete from public.tournaments where created_at < now() - interval '60 days';
  insert into public.tournaments(host, name, format) values (v_me, left(trim(p_name), 60), p_format) returning id into v_id;
  for v_i in 1 .. v_n loop insert into public.tournament_teams(tournament_id, seed, name) values (v_id, v_i, left(trim(p_teams[v_i]), 40)); end loop;

  if p_format = 'roundrobin' then
    v_m := v_n + (v_n % 2); v_arr := array(select generate_series(1, v_m));
    if v_n % 2 = 1 then v_arr[v_m] := 0; end if;            -- 0 = exempt
    for v_r in 1 .. v_m - 1 loop
      for v_i in 1 .. v_m / 2 loop
        v_a := v_arr[v_i]; v_b := v_arr[v_m + 1 - v_i];
        if v_a = 0 or v_b = 0 then
          insert into public.tournament_matches(tournament_id, round, slot, team_a, team_b, is_bye) values (v_id, v_r, v_i, greatest(v_a, v_b), null, true);
        else insert into public.tournament_matches(tournament_id, round, slot, team_a, team_b) values (v_id, v_r, v_i, v_a, v_b); end if;
      end loop;
      v_arr := v_arr[1:1] || v_arr[v_m:v_m] || v_arr[2:v_m - 1];   -- rotation (méthode du cercle)
    end loop;
  else
    v_p := 2; while v_p < v_n loop v_p := v_p * 2; end loop;
    v_ord := array[1]; v_len := 1;
    while v_len < v_p loop v_next := '{}'; foreach v_x in array v_ord loop v_next := v_next || v_x || (2 * v_len + 1 - v_x); end loop; v_ord := v_next; v_len := v_len * 2; end loop;
    v_rounds := round(log(2, v_p))::int;
    for v_r in 1 .. v_rounds loop
      for v_i in 1 .. (v_p / (2 ^ v_r))::int loop
        if v_r = 1 then
          v_a := v_ord[2 * v_i - 1]; v_b := v_ord[2 * v_i]; if v_a > v_n then v_a := null; end if; if v_b > v_n then v_b := null; end if;
          insert into public.tournament_matches(tournament_id, round, slot, team_a, team_b, is_bye) values (v_id, 1, v_i, v_a, v_b, (v_a is null or v_b is null));
        else insert into public.tournament_matches(tournament_id, round, slot) values (v_id, v_r, v_i); end if;
      end loop;
    end loop;
    update public.tournament_matches m set next_match = nx.id, next_side = case when m.slot % 2 = 1 then 'a' else 'b' end
      from public.tournament_matches nx where m.tournament_id = v_id and nx.tournament_id = v_id and nx.round = m.round + 1 and nx.slot = (m.slot + 1) / 2;
    for rec in select * from public.tournament_matches where tournament_id = v_id and round = 1 and is_bye loop    -- qualifiés d'office
      v_x := coalesce(rec.team_a, rec.team_b);
      update public.tournament_matches set winner = v_x where id = rec.id;
      if rec.next_match is not null then
        if rec.next_side = 'a' then update public.tournament_matches set team_a = v_x where id = rec.next_match;
        else update public.tournament_matches set team_b = v_x where id = rec.next_match; end if;
      end if;
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.report_match(p_match uuid, p_score_a int, p_score_b int) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_m public.tournament_matches; v_t public.tournaments; v_w int; v_open int;
begin
  select * into v_m from public.tournament_matches where id = p_match;
  if not found then raise exception 'Match introuvable.' using errcode = 'P0001'; end if;
  select * into v_t from public.tournaments where id = v_m.tournament_id and host = public.ea_me();
  if not found then raise exception 'Seul l’organisateur peut saisir les scores.' using errcode = '42501'; end if;
  if v_m.is_bye or v_m.team_a is null or v_m.team_b is null then raise exception 'Match pas encore prêt.' using errcode = 'P0001'; end if;
  if p_score_a < 0 or p_score_b < 0 or p_score_a > 100000 or p_score_b > 100000 then raise exception 'Score invalide.' using errcode = '22023'; end if;
  if v_t.format = 'knockout' and p_score_a = p_score_b then raise exception 'Pas d’égalité en élimination directe.' using errcode = '22023'; end if;
  if v_m.next_match is not null and exists (select 1 from public.tournament_matches where id = v_m.next_match and score_a is not null) then
    raise exception 'Le match suivant est déjà joué.' using errcode = 'P0001'; end if;
  v_w := case when p_score_a > p_score_b then v_m.team_a when p_score_b > p_score_a then v_m.team_b else null end;
  update public.tournament_matches set score_a = p_score_a, score_b = p_score_b, winner = v_w where id = p_match;
  if v_m.next_match is not null then
    if v_m.next_side = 'a' then update public.tournament_matches set team_a = v_w where id = v_m.next_match;
    else update public.tournament_matches set team_b = v_w where id = v_m.next_match; end if;
  end if;
  select count(*) into v_open from public.tournament_matches where tournament_id = v_t.id and not is_bye and (case when v_t.format = 'knockout' then winner is null else score_a is null end);
  if v_open = 0 then update public.tournaments set status = 'done' where id = v_t.id; end if;
end $$;

create or replace function public.tournament_state(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.ea_me() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  return (select jsonb_build_object('id', t.id, 'name', t.name, 'format', t.format, 'status', t.status, 'is_host', t.host = public.ea_me(),
    'teams', (select coalesce(jsonb_agg(jsonb_build_object('seed', seed, 'name', name) order by seed), '[]'::jsonb) from public.tournament_teams where tournament_id = t.id),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'round', round, 'slot', slot, 'a', team_a, 'b', team_b, 'sa', score_a, 'sb', score_b, 'winner', winner, 'bye', is_bye) order by round, slot), '[]'::jsonb) from public.tournament_matches where tournament_id = t.id))
    from public.tournaments t where t.id = p_id);
end $$;

create or replace function public.list_tournaments() returns table (id uuid, name text, format text, status text, created_at timestamptz, is_host boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id, t.name, t.format, t.status, t.created_at, t.host = public.ea_me() from public.tournaments t
  where public.ea_me() is not null order by t.created_at desc limit 20;
$$;

revoke all on function public.create_duel(text, jsonb, int), public.join_duel(text), public.start_duel(text), public.advance_duel(text), public.submit_duel_answer(text, int, int), public.duel_state(text),
  public.create_tournament(text, text, text[]), public.report_match(uuid, int, int), public.tournament_state(uuid), public.list_tournaments() from public;
grant execute on function public.create_duel(text, jsonb, int), public.join_duel(text), public.start_duel(text), public.advance_duel(text), public.submit_duel_answer(text, int, int), public.duel_state(text),
  public.create_tournament(text, text, text[]), public.report_match(uuid, int, int), public.tournament_state(uuid), public.list_tournaments() to authenticated;
