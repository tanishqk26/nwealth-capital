-- Tasks / reminders — run in Supabase SQL Editor (after schema.sql and team_schema.sql)

create table if not exists tasks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  type             text default 'follow_up',
    -- callback | meeting | portfolio_review | sip_issue | kyc_help | document_request
    -- cas_review | event_followup | complaint | follow_up | reminder | other
  priority         text default 'normal',   -- low | normal | high
  status           text default 'open',     -- open | done | cancelled
  due_at           timestamptz,
  contact_id       uuid references contacts(id) on delete set null,
  lead_id          uuid references leads(id) on delete set null,
  conversation_id  uuid references conversations(id) on delete set null,
  assignee_id      uuid references team_members(id) on delete set null,  -- null = admin / unassigned
  created_by       text default 'bot',      -- bot | admin | <team_member id>
  source           text default 'bot',      -- bot | admin_text | staff | system
  completed_at     timestamptz,
  created_at       timestamptz default now()
);

create index if not exists idx_tasks_assignee on tasks(assignee_id);
create index if not exists idx_tasks_due on tasks(due_at);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_contact on tasks(contact_id);

alter table tasks enable row level security;
