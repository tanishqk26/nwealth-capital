// GET /api/cron/reminders — deliver due reminders. For hosts without a persistent process
// (the in-process scheduler in instrumentation.ts covers dev / VPS). Protect with CRON_SECRET.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { runDueReminders } from '@/lib/reminders';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ sent: await runDueReminders() });
}
