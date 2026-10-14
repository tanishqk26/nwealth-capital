// Staff-facing assistant: the bot contact in the admin's / salesperson's own chat.
// Turns "Tomorrow meeting with Rahul to review his portfolio, remind me" into a task + reminder.

import { GoogleGenerativeAI, SchemaType, type Content } from '@google/generative-ai';
import { db, getRecentMessages } from './supabase';
import {
  createTask, defaultRemindAt, findContactByName, istContextString, normaliseType, TASK_TYPES, type Task,
} from './tasks';
import type { StaffIdentity } from './staff-chat';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `You are the private assistant of a staff member at Nwealth Capital, a mutual fund distributor in Pune. You are NOT customer-facing.
Your job: capture reminders, meetings and to-dos, show what is coming up, and mark things done.

Rules:
- When the user mentions something to remember or an upcoming meeting/call, call add_reminder immediately. Resolve relative dates ("tomorrow", "kal", "Friday") from the current time. If a date has no time, use 10:00 IST. If no date at all, ask once for when.
- Meetings and portfolio reviews are reminded 30 minutes early unless the user says otherwise.
- After tools run, confirm briefly with the title and the exact date/time (e.g. "Tue 14 Oct, 5:00 PM") and when you'll remind them.
- Reply in the user's language (English, Hindi or Hinglish). Keep replies to 1–3 lines.
- Never give investment advice. You only manage the user's own schedule.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'add_reminder',
        description: 'Create a reminder / meeting / to-do for this staff member.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: 'Short title, e.g. "Portfolio review meeting with Rahul Sharma"' },
            type: { type: SchemaType.STRING, description: `One of: ${TASK_TYPES.join(', ')}` },
            due_at: { type: SchemaType.STRING, description: 'ISO-8601 datetime with +05:30 offset of the event' },
            remind_before_minutes: { type: SchemaType.NUMBER, description: 'Minutes before due_at to remind; omit for the default' },
            client_name: { type: SchemaType.STRING, description: 'Client / prospect name if mentioned' },
            details: { type: SchemaType.STRING, description: 'Any extra notes' },
          },
          required: ['title', 'due_at'],
        },
      },
      {
        name: 'list_tasks',
        description: "List this user's open tasks/reminders.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: { range: { type: SchemaType.STRING, description: 'today | tomorrow | upcoming | overdue | all' } },
          required: [],
        },
      },
      {
        name: 'complete_task',
        description: 'Mark one of the user\'s open tasks as done, matched by words in its title.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: { query: { type: SchemaType.STRING, description: 'Words from the task title' } },
          required: ['query'],
        },
      },
    ],
  },
];

function fmt(iso: string | null) {
  if (!iso) return 'no date';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function ownTasks(staff: StaffIdentity) {
  const q = db.from('tasks').select('*').eq('status', 'open').order('due_at', { ascending: true, nullsFirst: false });
  return staff.memberId ? q.eq('assignee_id', staff.memberId) : q.is('assignee_id', null);
}

async function runTool(name: string, args: Record<string, unknown>, staff: StaffIdentity) {
  try {
    switch (name) {
      case 'add_reminder': {
        const dueAt = new Date(String(args.due_at));
        if (isNaN(dueAt.getTime())) return { success: false, message: 'Could not read the date/time' };
        const due = dueAt.toISOString();
        const type = normaliseType(args.type);
        const before = Number(args.remind_before_minutes);
        const remindAt = Number.isFinite(before) && before > 0
          ? new Date(dueAt.getTime() - before * 60000).toISOString()
          : defaultRemindAt(type, due);

        let contact: { id: string; name: string } | null = null;
        if (args.client_name) contact = await findContactByName(String(args.client_name));

        const { task } = await createTask({
          title: String(args.title),
          description: args.details ? String(args.details) : args.client_name && !contact ? `Client: ${args.client_name}` : null,
          type,
          due_at: due,
          remind_at: remindAt,
          contact_id: contact?.id ?? null,
          conversation_id: null,
          assignee_id: staff.memberId,
          created_by: staff.memberId ?? 'admin',
          source: 'admin_text',
        });
        return {
          success: true,
          title: task.title,
          due: fmt(task.due_at),
          will_remind_at: fmt(task.remind_at),
          linked_client: contact?.name ?? null,
        };
      }

      case 'list_tasks': {
        const { data } = await ownTasks(staff);
        const tasks = (data ?? []) as Task[];
        const now = Date.now();
        const range = String(args.range ?? 'upcoming');
        const istDay = (t: number) => new Date(t + 5.5 * 3600000).toISOString().slice(0, 10);
        const today = istDay(now), tomorrow = istDay(now + 86400000);
        const pick = tasks.filter((t) => {
          if (range === 'all') return true;
          if (!t.due_at) return range === 'upcoming';
          const due = new Date(t.due_at).getTime();
          if (range === 'overdue') return due < now;
          if (range === 'today') return istDay(due) === today;
          if (range === 'tomorrow') return istDay(due) === tomorrow;
          return due >= now;
        });
        return { success: true, count: pick.length, tasks: pick.slice(0, 15).map((t) => ({ title: t.title, due: fmt(t.due_at), priority: t.priority })) };
      }

      case 'complete_task': {
        const { data } = await ownTasks(staff);
        const words = String(args.query).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const hits = ((data ?? []) as Task[]).filter((t) => words.every((w) => t.title.toLowerCase().includes(w)));
        if (hits.length !== 1) {
          return { success: false, message: hits.length ? `Multiple matches: ${hits.map((h) => h.title).join('; ')}` : 'No matching open task' };
        }
        await db.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', hits[0].id);
        return { success: true, completed: hits[0].title };
      }

      default:
        return { success: false, message: `Unknown tool ${name}` };
    }
  } catch (err) {
    console.error(`[assistant] tool ${name} failed:`, err);
    return { success: false, message: String(err) };
  }
}

export async function processStaffMessage(staff: StaffIdentity, conversationId: string, text: string): Promise<string> {
  const recent = await getRecentMessages(conversationId, 14);
  // current message is saved before this runs — drop it from history, it goes in sendMessage
  const prior = recent.slice(0, -1);
  const history: Content[] = prior.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'model',
    parts: [{ text: m.body }],
  }));
  while (history.length && history[0].role !== 'user') history.shift();

  const model = genai.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
    systemInstruction: `${SYSTEM_PROMPT}\n\nUser: ${staff.name} (${staff.role}).\nCurrent date/time: ${istContextString()}.`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: TOOLS as any,
  });

  try {
    const chat = model.startChat({ history });
    let result = await chat.sendMessage(text);
    for (let i = 0; i < 4 && result.response.functionCalls()?.length; i++) {
      const calls = result.response.functionCalls()!;
      const responses = await Promise.all(
        calls.map(async (fc) => ({
          functionResponse: { name: fc.name, response: await runTool(fc.name, fc.args as Record<string, unknown>, staff) },
        }))
      );
      result = await chat.sendMessage(responses);
    }
    return result.response.text() || 'Done.';
  } catch (err) {
    console.error('[assistant] Gemini error:', err);
    return "Sorry, I couldn't process that just now. Please try again.";
  }
}
