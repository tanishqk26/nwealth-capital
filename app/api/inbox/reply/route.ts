// POST /api/inbox/reply
// Staff sends a message directly to the customer (bypasses AI agent).
// Saves as outbound with sender='agent' and emits SSE so the inbox updates live.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { emit } from '@/lib/sse';

export async function POST(request: NextRequest) {
  let body: { conversationId?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conversationId, text } = body;
  if (!conversationId || !text?.trim()) {
    return NextResponse.json({ error: 'conversationId and text are required' }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await db
    .from('messages')
    .insert({
      conversation_id: conversationId,
      direction: 'outbound',
      body: text.trim(),
      sender: 'agent',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update last_message_at
  await db
    .from('conversations')
    .update({ last_message_at: now })
    .eq('id', conversationId);

  // Emit SSE so inbox updates live
  emit(conversationId, { type: 'message', message: data });

  return NextResponse.json(data);
}
