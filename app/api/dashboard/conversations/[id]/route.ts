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
    { data: conversation, error: convError },
    { data: messages, error: msgError },
    { data: leads },
  ] = await Promise.all([
    db.from('conversations').select('*, contacts(*)').eq('id', id).single(),
    db.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }),
    db.from('leads').select('*').eq('conversation_id', id).order('created_at', { ascending: false }),
  ]);

  if (convError) return NextResponse.json({ error: convError.message }, { status: 404 });
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  return NextResponse.json({ conversation, messages, leads });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const allowed = ['bot', 'handoff', 'closed'];
  if (!body.status || !allowed.includes(body.status)) {
    return NextResponse.json({ error: 'status must be one of: bot, handoff, closed' }, { status: 400 });
  }

  const { data, error } = await db
    .from('conversations')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
