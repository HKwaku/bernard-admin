-- Influencer flag (safe to re-run; the app already reads/writes this column)
alter table public.reservations
  add column if not exists is_influencer boolean not null default false;

-- Set when staff have contacted a pending_payment guest to complete their booking
alter table public.reservations
  add column if not exists contacted_at timestamptz;
