import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const isHttps = request.headers.get('x-forwarded-proto') === 'https' ||
    request.url.startsWith('https://');
  const response = NextResponse.json({ ok: true });
  const clear = {
    maxAge: 0,
    path: '/',
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    secure: isHttps,
  };
  response.cookies.set('nwealth_admin', '', clear);
  response.cookies.set('nwealth_team', '', clear);
  return response;
}
