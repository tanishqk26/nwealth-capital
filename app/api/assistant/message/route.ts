// POST /api/assistant/message { text } — staff → assistant. Replies arrive over the conversation SSE stream.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardAuth } from '@/lib/dashboard-auth';
import { getStaffConversation, postAssistantMessage } from '@/lib/staff-chat';
import { processStaffMessage } from '@/lib/assistant';
import { saveMessage } from '@/lib/supabase';
import { emit } from '@/lib/sse';

export async function POST(request: NextRequest) {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 });

  const { conversationId } = await getStaffConversation(auth);
  await saveMessage(conversationId, 'inbound', text);
  emit(conversationId, { type: 'typing' });

  setImmediate(async () => {
    try {
      const reply = await processStaffMessage(auth, conversationId, text);
      await postAssistantMessage(conversationId, reply);
    } catch (err) {
      console.error('[assistant] pipeline failed:', err);
      await postAssistantMessage(conversationId, "Sorry, something went wrong. Please try again.").catch(() => {});
    }
  });

  return NextResponse.json({ ok: true, conversationId });
}
