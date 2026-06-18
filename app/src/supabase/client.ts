import { createClient } from "@supabase/supabase-js";

export const allowedEmailDomains = [
  "@ku.dk",
  "@di.ku.dk",
  "@dtu.dk",
  "@jur.ku.dk",
] as const;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

export function isAllowedUniversityEmail(email: string | undefined | null) {
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();

  return allowedEmailDomains.some((domain) => normalizedEmail.endsWith(domain));
}
