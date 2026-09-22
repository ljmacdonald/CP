-- Local development seed data only. Never run against production.

insert into investment_products (id, name, target_annual_rate_bps, cycle_days, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Growth Portfolio',
  2500, -- 25.00%
  180,
  'active'
)
on conflict (id) do nothing;
