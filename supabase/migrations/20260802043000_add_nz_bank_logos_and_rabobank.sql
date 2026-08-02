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
on conflict (slug) do update
set
  name = excluded.name,
  brand_color = excluded.brand_color,
  accent_color = excluded.accent_color,
  logo_file = excluded.logo_file,
  domain = excluded.domain,
  country = excluded.country,
  is_active = excluded.is_active,
  auto_redirect = excluded.auto_redirect;
