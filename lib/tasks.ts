import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from './supabase';

// ─── Types ──────────────────────────────────────────────────
export const TASK_TYPES = [
  'callback',          // client wants a call back
  'meeting',           // scheduled meeting with a client / prospect
  'portfolio_review',  // periodic or requested portfolio / SIP review
  'sip_issue',         // failed debit, SIP change/pause/stop, mandate problem
  'kyc_help',          // KYC / re-KYC / bank or nominee update help
  'document_request',  // client needs forms, statements, certificates
  'cas_review',        // CAS parse mismatch or manual upload to review
  'event_followup',    // follow up with an event attendee
  'complaint',         // service complaint to resolve
  'follow_up',         // generic follow-up on an enquiry
  'reminder',          // personal reminder for staff / admin
  'other',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: 'open' | 'done' | 'cancelled';
  due_at: string | null;
  contact_id: string | null;
  lead_id: string | null;
  conversation_id: string | null;
  assignee_id: string | null;
  created_by: string;
  source: string;
  completed_at: string | null;
  remind_at: string | null;
  reminded_at: string | null;
  created_at: string;
};

export type NewTask = {
  title: string;
  description?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  due_at?: string | null;
  contact_id?: string | null;
  lead_id?: string | null;
  conversation_id?: string | null;
  assignee_id?: string | null;
  remind_at?: string | null;   // defaults to due_at (minus a lead time for meetings)
  created_by?: string;
  source?: 'bot' | 'admin_text' | 'staff' | 'system';
};

const DEFAULT_PRIORITY: Partial<Record<TaskType, TaskPriority>> = {
  complaint: 'high',
  sip_issue: 'high',
  callback: 'normal',
};

// Meetings and reviews get a heads-up 30 min before; everything else is reminded at the due time.
const DEFAULT_LEAD_MINUTES: Partial<Record<TaskType, number>> = { meeting: 30, portfolio_review: 30 };

export function defaultRemindAt(type: TaskType, dueAt: string | null): string | null {
  if (!dueAt) return null;
  const lead = DEFAULT_LEAD_MINUTES[type] ?? 0;
  return new Date(new Date(dueAt).getTime() - lead * 60000).toISOString();
}

export function normaliseType(t: unknown): TaskType {
  return TASK_TYPES.includes(t as TaskType) ? (t as TaskType) : 'follow_up';
}

export function normalisePriority(p: unknown, type: TaskType): TaskPriority {
  return TASK_PRIORITIES.includes(p as TaskPriority) ? (p as TaskPriority) : DEFAULT_PRIORITY[type] ?? 'normal';
}

// ─── IST helpers ────────────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istNow() {
  return new Date(Date.now() + IST_OFFSET_MS); // read with getUTC* to get IST fields
}

// IST wall-clock → real instant (ISO string)
function istToIso(y: number, m: number, d: number, h: number, min = 0): string {
  return new Date(Date.UTC(y, m, d, h, min) - IST_OFFSET_MS).toISOString();
}

const SLOT_HOURS: Record<string, number> = { morning: 10, afternoon: 14, evening: 18 };

// "morning" / "evening" / "kal shaam" → next occurrence of that slot. Falls back to next morning.
export function slotToDueAt(preference?: string | null): string {
  const p = (preference ?? '').toLowerCase();
  let hour = 10;
  if (/evening|shaam|sham|sandhya/.test(p)) hour = SLOT_HOURS.evening;
  else if (/afternoon|dopahar|lunch/.test(p)) hour = SLOT_HOURS.afternoon;
  else if (/morning|subah|savere/.test(p)) hour = SLOT_HOURS.morning;

  const now = istNow();
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  let iso = istToIso(y, m, d, hour);
  if (new Date(iso).getTime() <= Date.now() + 30 * 60 * 1000) iso = istToIso(y, m, d + 1, hour);
  return iso;
}

export function istContextString(): string {
  const now = istNow();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${days[now.getUTCDay()]}, ${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} IST`;
}

// ─── Create ─────────────────────────────────────────────────
// Dedupes bot-created tasks: same contact + type already open within 24h → returns the existing one.
export async function createTask(input: NewTask): Promise<{ task: Task; duplicate: boolean }> {
  const type = normaliseType(input.type);

  if (input.contact_id && (input.source ?? 'bot') === 'bot') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await db
      .from('tasks')
      .select('*')
      .eq('contact_id', input.contact_id)
      .eq('type', type)
      .eq('status', 'open')
      .gte('created_at', since)
      .limit(1);
    if (existing?.[0]) return { task: existing[0] as Task, duplicate: true };
  }

  const { data, error } = await db
    .from('tasks')
    .insert({
      title: input.title.trim().slice(0, 200),
      description: input.description ?? null,
      type,
      priority: normalisePriority(input.priority, type),
      due_at: input.due_at ?? null,
      contact_id: input.contact_id ?? null,
      lead_id: input.lead_id ?? null,
      conversation_id: input.conversation_id ?? null,
      assignee_id: input.assignee_id ?? null,
      remind_at: input.remind_at ?? defaultRemindAt(type, input.due_at ?? null),
      created_by: input.created_by ?? 'bot',
      source: input.source ?? 'bot',
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(`Failed to create task: ${error?.message}`);
  return { task: data as Task, duplicate: false };
}

// ─── Natural-language parsing (admin / staff quick-add) ─────
export type ParsedTask = {
  title: string;
  description: string | null;
  type: TaskType;
  priority: TaskPriority;
  due_at: string | null;
  remind_at: string | null;
  client_name: string | null;
  assignee_name: string | null;
};

export async function parseTaskText(text: string, teamNames: string[]): Promise<ParsedTask> {
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genai.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });

  const prompt = `You convert a staff member's note into a task for a mutual fund distributor's CRM.
Current time: ${istContextString()}. All times are IST (+05:30). Notes may be English, Hindi or Hinglish.

Return ONLY JSON with keys:
- title: short imperative title (max 80 chars), e.g. "Portfolio review meeting with Xyz"
- description: extra detail from the note or null
- type: one of ${TASK_TYPES.join(', ')}
- priority: low | normal | high
- due_at: ISO-8601 with +05:30 offset resolved from relative words (tomorrow, kal, next Monday, 5pm). If a date is given with no time use 10:00. If no date at all use null.
- remind_before_minutes: integer if the note says how early to remind ("1 hour before" = 60), else null
- client_name: the client/prospect name mentioned, or null
- assignee_name: a team member this is explicitly assigned to, matched from [${teamNames.join(', ')}], or null

Use type "reminder" when the note is just a personal reminder with no client. Use "meeting" for meetings.

Note: """${text.slice(0, 600)}"""`;

  const result = await model.generateContent(prompt);
  const raw = JSON.parse(result.response.text());
  const type = normaliseType(raw.type);

  let dueAt: string | null = null;
  if (typeof raw.due_at === 'string') {
    const t = new Date(raw.due_at);
    if (!isNaN(t.getTime())) dueAt = t.toISOString();
  }

  const before = Number(raw.remind_before_minutes);
  const remindAt = dueAt && Number.isFinite(before) && before > 0
    ? new Date(new Date(dueAt).getTime() - before * 60000).toISOString()
    : defaultRemindAt(type, dueAt);

  return {
    title: String(raw.title || text).slice(0, 200),
    description: raw.description ? String(raw.description) : null,
    type,
    priority: normalisePriority(raw.priority, type),
    due_at: dueAt,
    remind_at: remindAt,
    client_name: raw.client_name ? String(raw.client_name) : null,
    assignee_name: raw.assignee_name ? String(raw.assignee_name) : null,
  };
}

// ─── Contact lookup ─────────────────────────────────────────
// Returns the contact only when exactly one customer matches the name.
export async function findContactByName(name: string): Promise<{ id: string; name: string } | null> {
  const safe = name.replace(/[%_,()]/g, ' ').trim();
  if (!safe) return null;
  const { data } = await db
    .from('contacts')
    .select('id, name')
    .neq('type', 'staff')
    .ilike('name', `%${safe}%`)
    .limit(2);
  return data?.length === 1 ? { id: data[0].id, name: data[0].name } : null;
}
