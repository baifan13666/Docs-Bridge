import createMiddleware from 'next-intl/middleware';
import { routing } from './src/i18n/routing';
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Create next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const requestUrl = request.nextUrl;
  const code = requestUrl.searchParams.get('code');
  if (code && !requestUrl.pathname.startsWith('/auth/callback')) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl && (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1')) {
      const redirectUrl = new URL('/auth/callback', siteUrl);
      requestUrl.searchParams.forEach((value, key) => {
        redirectUrl.searchParams.set(key, value);
      });
      return NextResponse.redirect(redirectUrl);
    }

    const redirectUrl = requestUrl.clone();
    redirectUrl.pathname = '/auth/callback';
    return NextResponse.redirect(redirectUrl);
  }

  // --- 1. Supabase Auth: Refresh session cookies ---
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — must be called before the response is sent
  await supabase.auth.getUser();

  // --- 2. next-intl: Handle locale routing ---
  const intlResponse = intlMiddleware(request);

  // Copy Supabase auth cookies from the response to the intl response
  response.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  // Match all pathnames except static files, API routes, auth routes, and internal Next.js paths
  matcher: [
    '/',
    '/(en|ms|zh|ta|tl|id)/:path*',
    '/((?!api|auth|_next|_vercel|.*\\..*).*)',
  ],
};
