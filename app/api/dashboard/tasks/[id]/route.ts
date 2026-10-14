// PATCH  /api/dashboard/tasks/[id]  — update status / due_at / title / priority / assignee (admin)
// DELETE /api/dashboard/tasks/[id]

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { getDashboardAuth } from '@/lib/dashboard-auth';
import { TASK_PRIORITIES } from '@/lib/tasks';

const STATUSES = ['open', 'done', 'cancelled'];

async function loadOwned(id: string, auth: NonNullable<Awaited<ReturnType<typeof getDashboardAuth>>>) {
  const { data } = await db.from('tasks').select('id, assignee_id').eq('id', id).single();
  if (!data) return null;
  if (auth.role === 'salesperson' && data.assignee_id !== auth.memberId) return null;
  return data;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await loadOwned(id, auth))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    updates.status = body.status;
    updates.completed_at = body.status === 'done' ? new Date().toISOString() : null;
  }
  if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 200);
  if (body.due_at !== undefined) updates.due_at = body.due_at ? new Date(body.due_at).toISOString() : null;
  if (body.priority !== undefined && TASK_PRIORITIES.includes(body.priority)) updates.priority = body.priority;
  if (body.assignee_id !== undefined && auth.role === 'admin') updates.assignee_id = body.assignee_id || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await db.from('tasks').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!(await loadOwned(id, auth))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { error } = await db.from('tasks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
