export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';

export async function GET() {
  const [
    { count: totalLeads },
    { count: newLeads },
    { count: handoffs },
    { count: totalConversations },
    { count: kbDocs },
  ] = await Promise.all([
    db.from('leads').select('*', { count: 'exact', head: true }),
    db.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'new'),
    db.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'handoff'),
    db.from('conversations').select('*', { count: 'exact', head: true }),
    db.from('kb_documents').select('*', { count: 'exact', head: true }).eq('status', 'ready'),
  ]);

  return NextResponse.json({ totalLeads, newLeads, handoffs, totalConversations, kbDocs });
}
