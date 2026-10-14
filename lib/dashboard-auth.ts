import { cookies } from 'next/headers';
import { db } from '@/lib/supabase';

export type DashboardAuth =
  | { role: 'admin'; memberId: null; name: string }
  | { role: 'salesperson'; memberId: string; name: string };

// Resolves the logged-in dashboard user from cookies, or null if unauthenticated.
export async function getDashboardAuth(): Promise<DashboardAuth | null> {
  const cookieStore = await cookies();

  const adminToken = cookieStore.get('nwealth_admin')?.value;
  const expected = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';
  if (adminToken === expected) return { role: 'admin', memberId: null, name: 'Admin' };

  const teamCookie = cookieStore.get('nwealth_team')?.value;
  if (teamCookie) {
    const [memberId] = teamCookie.split('|');
    if (memberId) {
      const { data } = await db
        .from('team_members')
        .select('id, name')
        .eq('id', memberId)
        .eq('status', 'active')
        .single();
      if (data) return { role: 'salesperson', memberId: data.id, name: data.name };
    }
  }

  return null;
}
