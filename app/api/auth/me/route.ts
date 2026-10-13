export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/supabase';

export async function GET() {
  const cookieStore = await cookies();

  // Admin check
  const adminToken = cookieStore.get('nwealth_admin')?.value;
  const expected = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';
  if (adminToken === expected) {
    return NextResponse.json({ role: 'admin', name: 'Admin' });
  }

  // Team member check
  const teamCookie = cookieStore.get('nwealth_team')?.value;
  if (teamCookie) {
    const [memberId, role] = teamCookie.split('|');
    if (memberId && role) {
      const { data } = await db
        .from('team_members')
        .select('id, name, role, status')
        .eq('id', memberId)
        .eq('status', 'active')
        .single();

      if (data) {
        return NextResponse.json({ role: data.role, name: data.name, id: memberId });
      }
    }
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
