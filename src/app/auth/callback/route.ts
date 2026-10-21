import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/config';

// Where Discord and emailed sign-in links send people back. Swaps the one-time code for a
// session (saved in cookies), then returns them to the page they started from.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const back = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  // Supabase sends its own reason when a link has expired or was already used.
  const reason = url.searchParams.get('error_description') || url.searchParams.get('error_code') || url.searchParams.get('error');
  if (reason) return back(`/signin?error=${encodeURIComponent(reason)}&next=${encodeURIComponent(next)}`);
  if (!supabaseConfigured || !code) return back(`/signin?error=missing-code&next=${encodeURIComponent(next)}`);

  const response = back(next);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return back(`/signin?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  return response;
}

/** Only allow returning to our own pages. */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
