-- Nwealth Capital — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query

-- ─── contacts ──────────────────────────────────────────────
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  phone       text,
  name        text,
  type        text default 'prospect',  -- prospect | client
  language    text default 'en',        -- en | hi | hinglish
  source      text default 'dev_ui',    -- dev_ui | whatsapp | zaple
  created_at  timestamptz default now()
);

-- ─── conversations ─────────────────────────────────────────
create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid references contacts(id) on delete cascade,
  status           text default 'bot',  -- bot | handoff | closed
  last_message_at  timestamptz default now(),
  created_at       timestamptz default now()
);

-- ─── messages ──────────────────────────────────────────────
create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid references conversations(id) on delete cascade,
  direction        text not null,       -- inbound | outbound
  body             text not null,
  message_type     text default 'text',
  sender           text default 'bot',  -- bot | agent | customer
  created_at       timestamptz default now()
);

-- Migration: add sender column if upgrading from earlier schema
do $$ begin
  alter table messages add column if not exists sender text default 'bot';
exception when others then null;
end $$;

-- ─── leads ─────────────────────────────────────────────────
create table if not exists leads (
  id               uuid primary key default gen_random_uuid(),
  contact_id       uuid references contacts(id),
  conversation_id  uuid references conversations(id),
  intent           text,
  amount_range     text,
  callback_time    text,
  status           text default 'new',  -- new | assigned | closed
  created_at       timestamptz default now()
);

-- ─── kb_documents ─────────────────────────────────────────
create table if not exists kb_documents (
  id            uuid primary key default gen_random_uuid(),
  filename      text not null,
  file_size     integer,
  file_type     text,                 -- application/pdf | text/plain | etc.
  status        text default 'processing',
    -- processing → extracting text
    -- embedding  → chunking + sending to Pinecone
    -- ready      → fully indexed and searchable
    -- error      → something went wrong
  chunk_count   integer,              -- number of vectors upserted to Pinecone
  error_message text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

alter table kb_documents enable row level security;

-- ─── handoff detail columns (added for dashboard) ─────────
alter table conversations add column if not exists handoff_reason  text;
alter table conversations add column if not exists handoff_summary text;

-- ─── indexes ───────────────────────────────────────────────
create index if not exists idx_conversations_contact on conversations(contact_id);
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_messages_created on messages(created_at);
create index if not exists idx_leads_contact on leads(contact_id);

-- ─── Row Level Security ────────────────────────────────────
-- Server-side code uses the service role key which bypasses RLS.
-- Enable RLS so anon key cannot read raw data from the browser.
alter table contacts     enable row level security;
alter table conversations enable row level security;
alter table messages     enable row level security;
alter table leads        enable row level security;
