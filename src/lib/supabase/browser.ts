'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';

/** Supabase in the browser (chat, votes, live updates). Null until configured. */
export function browserClient() {
  return supabaseConfigured ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
}
