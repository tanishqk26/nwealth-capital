export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/supabase';

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nwealth_admin')?.value;
  const expected = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';
  return token === expected;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;

  // Only admins can reassign leads
  if (body.assigned_to !== undefined && await isAdmin()) {
    updates.assigned_to = body.assigned_to;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await db.from('leads').update(updates).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
