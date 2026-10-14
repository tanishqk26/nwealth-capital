// POST /api/dashboard/tasks/quick  { text }
// Natural-language task creation, e.g.
//   "Tomorrow 5pm meeting with Rahul Sharma to review his portfolio, remind me"
// Parses with Gemini, links the client if exactly one contact matches, and creates the task.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { getDashboardAuth } from '@/lib/dashboard-auth';
import { createTask, findContactByName, parseTaskText } from '@/lib/tasks';

export async function POST(request: NextRequest) {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const { data: team } = await db.from('team_members').select('id, name').eq('status', 'active');
  const members = team ?? [];

  let parsed;
  try {
    parsed = await parseTaskText(text, members.map((m) => m.name));
  } catch (err) {
    console.error('[tasks/quick] parse failed:', err);
    return NextResponse.json({ error: 'Could not understand that note. Try rephrasing.' }, { status: 422 });
  }

  // Link client only when the match is unambiguous
  let contactId: string | null = null;
  let contactName: string | null = null;
  if (parsed.client_name) {
    const match = await findContactByName(parsed.client_name);
    if (match) { contactId = match.id; contactName = match.name; }
  }

  // Assignee: salesperson → self; admin → named member if mentioned, otherwise admin's own (null)
  let assigneeId: string | null = null;
  if (auth.role === 'salesperson') {
    assigneeId = auth.memberId;
  } else if (parsed.assignee_name) {
    const m = members.find((x) => x.name.toLowerCase() === parsed.assignee_name!.toLowerCase());
    assigneeId = m?.id ?? null;
  }

  try {
    const { task } = await createTask({
      title: parsed.title,
      description: parsed.description ?? (parsed.client_name && !contactId ? `Client: ${parsed.client_name} (not found in contacts)` : null),
      type: parsed.type,
      priority: parsed.priority,
      due_at: parsed.due_at,
      remind_at: parsed.remind_at,
      contact_id: contactId,
      assignee_id: assigneeId,
      created_by: auth.role === 'admin' ? 'admin' : auth.memberId,
      source: 'admin_text',
    });
    return NextResponse.json({ task, linkedClient: contactName, unmatchedClient: parsed.client_name && !contactId ? parsed.client_name : null }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
