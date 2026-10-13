// POST /api/webhook
// Receives inbound messages from:
//   - Local dev UI (TRANSPORT=local): payload sent directly from the chat page
//   - Zaple (TRANSPORT=zaple): payload from Zaple's webhook delivery
// Both paths normalise to InboundMessage and run the same agent pipeline.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getOrCreateContact, getOrCreateConversation, saveMessage } from '@/lib/supabase';
import { processMessage } from '@/lib/agent';
import { emit } from '@/lib/sse';
import { ZapleTransport } from '@/lib/transport/zaple';

const transport = process.env.TRANSPORT === 'zaple' ? new ZapleTransport() : null;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Normalise payload ──────────────────────────────────────
  let phone: string;
  let name: string;
  let text: string;
  let messageId: string;
  let conversationId: string | undefined;
  let contactId: string | undefined;

  if (process.env.TRANSPORT === 'zaple') {
    const normalised = ZapleTransport.normalizeWebhook(body);
    phone = normalised.phone;
    name = normalised.name;
    text = normalised.text;
    messageId = normalised.messageId;
  } else {
    // Dev UI sends a clean object
    phone = String(body.phone ?? body.contactId ?? 'dev-user');
    name = String(body.name ?? 'Test User');
    text = String(body.text ?? '');
    messageId = String(body.messageId ?? uuidv4());
    conversationId = body.conversationId ? String(body.conversationId) : undefined;
    contactId = body.contactId ? String(body.contactId) : undefined;
  }

  if (!text.trim()) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 });
  }

  // ── Resolve contact & conversation ─────────────────────────
  try {
    const contact = await getOrCreateContact(phone, name);
    const conversation = conversationId
      ? { id: conversationId, contact_id: contact.id }
      : await getOrCreateConversation(contact.id);

    const resolvedConversationId = conversation.id;
    const resolvedContactId = contactId ?? contact.id;

    // ── Store inbound message ──────────────────────────────────
    await saveMessage(resolvedConversationId, 'inbound', text);
    // Note: inbound message is already shown optimistically by the chat UI — don't SSE it again.

    // ── Signal bot is typing ───────────────────────────────────
    emit(resolvedConversationId, { type: 'typing' });

    // ── Run AI agent (async — we respond 200 immediately, SSE pushes the reply)
    setImmediate(async () => {
      try {
        const botText = await processMessage(resolvedConversationId, resolvedContactId, text);

        // Store outbound message
        const outboundMsg = await saveMessage(resolvedConversationId, 'outbound', botText);

        // Push via SSE to dev UI
        emit(resolvedConversationId, {
          type: 'message',
          direction: 'outbound',
          id: outboundMsg.id,
          body: botText,
          created_at: outboundMsg.created_at,
        });

        // If Zaple transport active, also send via Zaple API
        if (transport) {
          await transport.send({ to: phone, body: botText, type: 'text' });
        }
      } catch (err) {
        console.error('[webhook] agent pipeline failed:', err);
      }
    });

    return NextResponse.json({
      ok: true,
      conversationId: resolvedConversationId,
      contactId: resolvedContactId,
      messageId,
    });
  } catch (err) {
    console.error('[webhook] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
