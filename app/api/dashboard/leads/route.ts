export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/supabase';
import { assignLeadToNext } from '@/lib/team-auth';

async function getAuth() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('nwealth_admin')?.value;
  const expected = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';
  if (adminToken === expected) return { role: 'admin' as const, memberId: null };

  const teamCookie = cookieStore.get('nwealth_team')?.value;
  if (teamCookie) {
    const [memberId, role] = teamCookie.split('|');
    if (memberId && role) return { role: role as string, memberId };
  }

  return null;
}

export async function GET() {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = db
    .from('leads')
    .select('*, contacts(id, name, phone, type), assignee:team_members!leads_assigned_to_fkey(id, name)')
    .order('created_at', { ascending: false });

  if (auth.role !== 'admin' && auth.memberId) {
    query = query.eq('assigned_to', auth.memberId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { contact_id, intent, amount_range, callback_time, status = 'new' } = body;

  if (!contact_id || !intent) {
    return NextResponse.json({ error: 'contact_id and intent are required' }, { status: 400 });
  }

  const { data, error } = await db
    .from('leads')
    .insert({ contact_id, intent, amount_range: amount_range || null, callback_time: callback_time || null, status })
    .select('id, contact_id, intent, amount_range, callback_time, status, created_at, assigned_to, contacts(id, name, phone, type)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Round-robin assignment
  const assignedTo = await assignLeadToNext();
  if (assignedTo && data) {
    await db.from('leads').update({ assigned_to: assignedTo }).eq('id', data.id);
    (data as Record<string, unknown>).assigned_to = assignedTo;
  }

  return NextResponse.json(data, { status: 201 });
}
