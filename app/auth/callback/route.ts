import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const isLocalhost = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';

  if (siteUrl && isLocalhost) {
    const redirectUrl = new URL('/auth/callback', siteUrl);
    requestUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(redirectUrl);
  }

  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      // Redirect to home with error
      return NextResponse.redirect(`${origin}/en?error=auth_failed`);
    }
  }

  // URL to redirect to after sign in process completes
  // Redirect to the locale-specific home page
  return NextResponse.redirect(`${origin}/en`);
}
