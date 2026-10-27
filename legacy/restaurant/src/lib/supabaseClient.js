import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

const isValidSupabaseUrl = (value) => /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(value);
const isLikelyPublishableKey = (value) =>
  /^(eyJ|sb_publishable_)[A-Za-z0-9_.-]{20,}$/.test(value) && !/service_role|sb_secret_/i.test(value);

const getSessionStorage = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : undefined;
  } catch {
    return undefined;
  }
};

export const supabaseConfigStatus = {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  isValidUrl: isValidSupabaseUrl(supabaseUrl),
  isPublishableKey: isLikelyPublishableKey(supabaseAnonKey),
};

export const isSupabaseConfigured =
  supabaseConfigStatus.hasUrl &&
  supabaseConfigStatus.hasAnonKey &&
  supabaseConfigStatus.isValidUrl &&
  supabaseConfigStatus.isPublishableKey;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: getSessionStorage(),
      },
    })
  : null;
