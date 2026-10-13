export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { verifyPassword } from '@/lib/team-auth';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  const expectedUser = process.env.DASHBOARD_USERNAME ?? 'admin';
  const expectedPass = process.env.DASHBOARD_PASSWORD ?? 'nwealth2024';
  const token = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';

  const fwdProto = request.headers.get('x-forwarded-proto');
  const isHttps = fwdProto === 'https' || request.url.startsWith('https://');

  console.log('[login] x-forwarded-proto:', fwdProto, 'isHttps:', isHttps, 'url:', request.url);

  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHttps,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };

  // Admin login
  if (username === expectedUser && password === expectedPass) {
    const response = NextResponse.json({ ok: true, role: 'admin' });
    response.cookies.set('nwealth_admin', token, cookieOpts);
    return response;
  }

  // Salesperson / team member login — look up by email
  const { data: member } = await db
    .from('team_members')
    .select('id, name, role, status, password_hash')
    .eq('email', username)
    .eq('status', 'active')
    .single();

  if (member && verifyPassword(password, member.password_hash)) {
    const cookieValue = `${member.id}|${member.role}`;
    const response = NextResponse.json({ ok: true, role: member.role, name: member.name });
    response.cookies.set('nwealth_team', cookieValue, cookieOpts);
    return response;
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
