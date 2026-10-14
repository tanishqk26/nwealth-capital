// GET /api/assistant/session — the logged-in staff member's assistant chat (created on first use)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDashboardAuth } from '@/lib/dashboard-auth';
import { getStaffConversation } from '@/lib/staff-chat';

export async function GET() {
  const auth = await getDashboardAuth();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { conversationId } = await getStaffConversation(auth);
  return NextResponse.json({ conversationId, name: auth.name, role: auth.role });
}
