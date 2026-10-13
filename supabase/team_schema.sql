-- Team members table
create table if not exists team_members (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text unique not null,
  phone            text,
  role             text default 'salesperson',  -- salesperson only for now
  status           text default 'active',       -- active | inactive
  password_hash    text not null,
  last_assigned_at timestamptz,
  created_at       timestamptz default now()
);

alter table team_members enable row level security;

-- Add assigned_to column to leads
alter table leads add column if not exists assigned_to uuid references team_members(id);
