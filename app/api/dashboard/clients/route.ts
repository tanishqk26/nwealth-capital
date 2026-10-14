export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/supabase';

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

  let contactIds: string[] | null = null;

  // Salesperson: only contacts where they have an assigned lead
  if (auth && auth.role !== 'admin' && auth.memberId) {
    const { data: assignedLeads } = await db
      .from('leads')
      .select('contact_id')
      .eq('assigned_to', auth.memberId);
    contactIds = [...new Set((assignedLeads ?? []).map((l) => l.contact_id))];
    if (contactIds.length === 0) return NextResponse.json([]);
  }

  let query = db.from('contacts').select('*').neq('type', 'staff').order('created_at', { ascending: false });
  if (contactIds) query = query.in('id', contactIds);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach conversation + lead counts
  const ids = data?.map((c) => c.id) ?? [];
  if (ids.length === 0) return NextResponse.json([]);

  const [{ data: convCounts }, { data: leadCounts }] = await Promise.all([
    db.from('conversations').select('contact_id').in('contact_id', ids),
    db.from('leads').select('contact_id').in('contact_id', ids),
  ]);

  const convMap: Record<string, number> = {};
  convCounts?.forEach((r) => { convMap[r.contact_id] = (convMap[r.contact_id] ?? 0) + 1; });

  const leadMap: Record<string, number> = {};
  leadCounts?.forEach((r) => { leadMap[r.contact_id] = (leadMap[r.contact_id] ?? 0) + 1; });

  const result = data?.map((c) => ({
    ...c,
    conversation_count: convMap[c.id] ?? 0,
    lead_count: leadMap[c.id] ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { name, phone, type = 'prospect', language = 'en' } = body;

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
  }

  const { data, error } = await db
    .from('contacts')
    .insert({ name: name.trim(), phone: phone.trim(), type, language, source: 'dashboard' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
