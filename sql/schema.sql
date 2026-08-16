-- The Elo Edit — Supabase schema
-- Run this in Supabase: Project → SQL Editor → New query → paste → Run

-- 1. Listings table (doubles as seller submission intake + curated catalog)
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- seller-submitted fields
  seller_ig_handle text not null,
  brand text not null,
  item_name text,
  size text,
  price numeric(10,2) not null,
  original_price numeric(10,2),
  description text,
  condition text,           -- e.g. 'New with tags', 'Like new', 'Gently worn'
  category text,            -- e.g. 'Dress', 'Bag', 'Shoes', 'Top'
  tags text[] not null default '{}', -- admin-only, set from a fixed list in admin.html (Bridal, Wedding Guest, Vacation, Accessories, Ready to Wear)
  go_live_at timestamptz,   -- when a 'live' item actually becomes visible to buyers; null/past = visible now
  dm_sent boolean not null default false, -- admin-only checkbox: have you sent the seller their "you're in the drop" DM?
  photo_urls text[] not null default '{}',

  -- curation state, controlled by Mary only
  status text not null default 'pending' check (status in ('pending', 'live', 'sold', 'rejected'))
);

-- If the table already existed before a given column was added, this brings
-- it up to date. Safe to run every time — does nothing if already applied.
alter table listings add column if not exists original_price numeric(10,2);
alter table listings add column if not exists tags text[] not null default '{}';
alter table listings add column if not exists go_live_at timestamptz;
alter table listings add column if not exists dm_sent boolean not null default false;

create index if not exists listings_status_idx on listings (status);

-- keep updated_at fresh
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_listings_updated_at on listings;
create trigger trg_listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

-- 2. Row Level Security
alter table listings enable row level security;

-- Anyone (buyers browsing the site) can read only "live" listings
drop policy if exists "public can read live listings" on listings;
create policy "public can read live listings"
  on listings for select
  to anon
  using (status = 'live' and (go_live_at is null or go_live_at <= now()));

-- Anyone (sellers) can submit a new listing, but it always lands as 'pending'
-- and only the intake columns are meant to be set client-side.
drop policy if exists "public can submit listings" on listings;
create policy "public can submit listings"
  on listings for insert
  to anon
  with check (status = 'pending');

-- Only a logged-in admin (Mary) can read everything, including pending/sold
drop policy if exists "admin can read all listings" on listings;
create policy "admin can read all listings"
  on listings for select
  to authenticated
  using (true);

-- Only a logged-in admin can update status (approve, mark sold, reject) or edit details
drop policy if exists "admin can update listings" on listings;
create policy "admin can update listings"
  on listings for update
  to authenticated
  using (true)
  with check (true);

-- Only a logged-in admin can delete listings
drop policy if exists "admin can delete listings" on listings;
create policy "admin can delete listings"
  on listings for delete
  to authenticated
  using (true);

-- 3. Storage bucket for listing photos
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

-- Anyone can upload a photo (sellers submitting via the public form)
drop policy if exists "public can upload listing photos" on storage.objects;
create policy "public can upload listing photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'listing-photos');

-- Anyone can view listing photos (public bucket, needed for the buyer feed)
drop policy if exists "public can view listing photos" on storage.objects;
create policy "public can view listing photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'listing-photos');

-- Admin can delete photos (cleanup on reject)
drop policy if exists "admin can delete listing photos" on storage.objects;
create policy "admin can delete listing photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos');

-- 4. Let a seller mark their own item sold via a private link (see sold.html),
-- without giving anonymous visitors general update access to the table.
-- Only flips a 'live' item to 'sold' — nothing else is editable this way,
-- and it only works if you know the item's exact id (from its private link).
create or replace function mark_listing_sold(listing_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update listings set status = 'sold' where id = listing_id and status = 'live';
$$;

grant execute on function mark_listing_sold(uuid) to anon;

-- 5. Create Mary's admin login
-- Do this in the Supabase dashboard instead of SQL:
-- Authentication → Users → Add user → enter Mary's email + a password.
-- That's the only account that should exist — anyone who logs in via
-- admin.html is treated as the admin.
