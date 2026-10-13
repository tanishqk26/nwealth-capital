export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { hashPassword } from '@/lib/team-auth';
import { cookies } from 'next/headers';

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get('nwealth_admin')?.value;
  const expected = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';
  return token === expected;
}

export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await db
    .from('team_members')
    .select('id, name, email, phone, role, status, last_assigned_at, created_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { name, email, phone, role = 'salesperson', password } = body;

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 });
  }

  const password_hash = hashPassword(password);

  const { data, error } = await db
    .from('team_members')
    .insert({ name, email, phone: phone || null, role, password_hash })
    .select('id, name, email, phone, role, status, last_assigned_at, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
