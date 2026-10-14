-- Staff assistant + reminder delivery — run after tasks_schema.sql
alter table tasks add column if not exists remind_at   timestamptz;  -- when to ping the assignee (defaults to due_at)
alter table tasks add column if not exists reminded_at timestamptz;  -- set once the reminder message was delivered
update tasks set remind_at = due_at where remind_at is null and due_at is not null;
create index if not exists idx_tasks_remind on tasks(remind_at) where status = 'open' and reminded_at is null;
-- Staff assistant chats are stored as contacts with type = 'staff' and phone = 'staff:admin' | 'staff:<team_member_id>'
