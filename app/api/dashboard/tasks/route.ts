// GET  /api/dashboard/tasks?status=open|done|all  — admin: all tasks; salesperson: own tasks
// POST /api/dashboard/tasks                       — manual create

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { getDashboardAuth } from '@/lib/dashboard-auth';
import { createTask, normaliseType, normalisePriority } from '@/lib/tasks';

export async function GET(request: NextRequest) {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const status = request.nextUrl.searchParams.get('status') ?? 'all';

  let query = db
    .from('tasks')
    .select('*, contact:contacts(id, name, phone), assignee:team_members(id, name)')
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(500);

  if (auth.role === 'salesperson') query = query.eq('assignee_id', auth.memberId);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const type = normaliseType(body.type);
  try {
    const { task } = await createTask({
      title: body.title,
      description: body.description || null,
      type,
      priority: normalisePriority(body.priority, type),
      due_at: body.due_at ? new Date(body.due_at).toISOString() : null,
      contact_id: body.contact_id || null,
      // salespeople can only create tasks for themselves
      assignee_id: auth.role === 'salesperson' ? auth.memberId : body.assignee_id || null,
      created_by: auth.role === 'admin' ? 'admin' : auth.memberId,
      source: 'staff',
    });
    return NextResponse.json(task, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
