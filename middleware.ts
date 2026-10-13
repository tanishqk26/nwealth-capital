import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
};

const ADMIN_COOKIE = 'nwealth_admin';
const TEAM_COOKIE = 'nwealth_team';

// UUID pattern for validating team cookie format
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle CORS preflight for API routes
  if (request.method === 'OPTIONS' && pathname.startsWith('/api')) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const expected = process.env.DASHBOARD_TOKEN ?? 'nwealth-dev-token';

  const adminToken = request.cookies.get(ADMIN_COOKIE)?.value;
  const isAdmin = adminToken === expected;

  const teamCookie = request.cookies.get(TEAM_COOKIE)?.value ?? '';
  const [teamMemberId, teamRole] = teamCookie.split('|');
  const isTeam = !!(teamMemberId && UUID_RE.test(teamMemberId) && teamRole === 'salesperson');

  const isAuthenticated = isAdmin || isTeam;

  // Already logged in → skip login page
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Dashboard routes require auth
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const url = new URL('/login', request.url);
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }

    // Team management pages: admin only
    if (pathname.startsWith('/dashboard/team') && !isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  const response = NextResponse.next();

  // Attach CORS headers to all API responses
  if (pathname.startsWith('/api')) {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
  }

  return response;
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/api/:path*'],
};
