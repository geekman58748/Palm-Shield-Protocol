-- Palmshield databse schema
-- Run in Supabase → SQL Editr
-- ============================================================

-- Add stake_tx column to submissions (this func tracks the 100 PUSD stake tx)
alter table submissions add column if not exists stake_tx text;

-- Add stake_tx column to votes (tracks the 50 PUSD stake tx too)
alter table votes add column if not exists stake_tx text;



create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  role text check (role in ('hunter','dao','both')) not null default 'hunter',
  pusd_balance numeric default 0,
  created_at timestamptz default now()
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_wallet text not null,
  target_wallet text not null,
  threat_type text,
  remark text,
  image_url text,
  bounty int default 250,
  severity text default 'review',
  status text default 'pending',
  confirm_votes int default 0,
  deny_votes int default 0,
  stake_tx text,
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  voter_wallet text not null,
  vote text check (vote in ('confirm','deny')) not null,
  stake_tx text,
  cast_at timestamptz default now(),
  unique(submission_id, voter_wallet)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id) on delete cascade,
  author_wallet text not null,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references submissions(id),
  hunter_wallet text not null,
  amount numeric not null,
  tx_signature text,
  paid_at timestamptz default now()
);

-- RLS
alter table users enable row level security;
alter table submissions enable row level security;
alter table votes enable row level security;
alter table comments enable row level security;
alter table payouts enable row level security;

do $$ begin
  create policy "public read users"         on users        for select using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public insert users"       on users        for insert with check (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public update users"       on users        for update using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read submissions"   on submissions  for select using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public insert submissions" on submissions  for insert with check (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public update submissions" on submissions  for update using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read votes"         on votes        for select using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public insert votes"       on votes        for insert with check (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read comments"      on comments     for select using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public insert comments"    on comments     for insert with check (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read payouts"       on payouts      for select using (true);
  exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public insert payouts"     on payouts      for insert with check (true);
  exception when duplicate_object then null; end $$;
