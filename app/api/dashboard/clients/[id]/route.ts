export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [
    { data: contact, error: contactError },
    { data: conversations },
    { data: leads },
  ] = await Promise.all([
    db.from('contacts').select('*').eq('id', id).single(),
    db.from('conversations')
      .select('id, status, handoff_reason, handoff_summary, created_at, last_message_at')
      .eq('contact_id', id)
      .order('last_message_at', { ascending: false }),
    db.from('leads')
      .select('id, intent, amount_range, callback_time, status, created_at, conversation_id')
      .eq('contact_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (contactError) return NextResponse.json({ error: contactError.message }, { status: 404 });
  return NextResponse.json({ contact, conversations: conversations ?? [], leads: leads ?? [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const allowed = ['name', 'phone', 'type', 'language'];
  const update: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { error } = await db.from('contacts').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error } = await db.from('contacts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
