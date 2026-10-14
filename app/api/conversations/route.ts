// GET  /api/conversations        — list all conversations with contact info
// POST /api/conversations        — create a new test contact + conversation (dev UI)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db, getOrCreateConversation } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await db
    .from('conversations')
    .select(`
      id,
      status,
      last_message_at,
      created_at,
      contact:contacts (
        id,
        name,
        phone,
        type,
        language
      )
    `)
    .order('last_message_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach last message preview (staff assistant chats excluded)
  const customerConvs = (data ?? []).filter((c) => {
    const contact = c.contact as { type?: string } | { type?: string }[] | null;
    const t = Array.isArray(contact) ? contact[0]?.type : contact?.type;
    return t !== 'staff';
  });
  const withPreviews = await Promise.all(
    customerConvs.map(async (conv) => {
      const { data: msgs } = await db
        .from('messages')
        .select('body, direction, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      return { ...conv, lastMessage: msgs?.[0] ?? null };
    })
  );

  return NextResponse.json(withPreviews);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name: string = body.name ?? 'Test User';
  const phone: string = body.phone ?? `dev-${Date.now()}`;

  // Create contact
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .insert({ phone, name, source: 'dev_ui' })
    .select()
    .single();

  if (contactErr) {
    return NextResponse.json({ error: contactErr.message }, { status: 500 });
  }

  const conversation = await getOrCreateConversation(contact.id);
  return NextResponse.json({ contact, conversation }, { status: 201 });
}
