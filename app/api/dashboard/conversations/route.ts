export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET() {
  const { data: conversations, error } = await db
    .from('conversations')
    .select('*, contacts(id, name, phone)')
    .order('last_message_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = conversations?.map((c) => c.id) ?? [];
  if (ids.length === 0) return NextResponse.json([]);

  // Fetch last message per conversation
  const { data: messages } = await db
    .from('messages')
    .select('id, conversation_id, direction, body, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false });

  const lastMsg: Record<string, { body: string; direction: string; created_at: string }> = {};
  messages?.forEach((m) => {
    if (!lastMsg[m.conversation_id]) lastMsg[m.conversation_id] = m;
  });

  const result = conversations?.map((c) => ({
    ...c,
    last_message: lastMsg[c.id] ?? null,
  }));

  return NextResponse.json(result);
}
