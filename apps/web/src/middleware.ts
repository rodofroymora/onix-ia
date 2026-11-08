import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC = ['/login', '/r', '/api/auth', '/api/health'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Detrás del proxy del host la petición llega como http aunque el usuario use https:
  // hay que buscar la cookie segura (__Secure-authjs.session-token) en ese caso.
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const secureCookie =
    forwardedProto === 'https' ||
    req.nextUrl.protocol === 'https:' ||
    (process.env.AUTH_URL ?? '').startsWith('https://');

  const token = await getToken({
    req,
    secret: authSecret,
    secureCookie,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
