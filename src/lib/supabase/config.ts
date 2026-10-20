// Supabase is optional until the project is connected: without these values the site
// still runs, showing empty states instead of live data.
// Supabase's newer "publishable" key and the older "anon" key both work here.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
