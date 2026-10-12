// GET /api/conversations/[id]/messages — fetch message history for a conversation

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getRecentMessages } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const messages = await getRecentMessages(id, 50);
    return NextResponse.json(messages);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
