-- Extras that staff can add to bookings in Bernard but guests never see on the public website.
-- Run this BEFORE deploying the sojourn-cabins change that filters on admin_only.
alter table public.extras
  add column if not exists admin_only boolean not null default false;
