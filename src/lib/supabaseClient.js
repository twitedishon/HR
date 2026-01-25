// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

// ✅ Helpful debug (safe: shows only first 20 chars)
console.log("[supabase] VITE_SUPABASE_URL:", supabaseUrl || "(missing)");
console.log(
  "[supabase] VITE_SUPABASE_ANON_KEY (first 20):",
  supabaseAnonKey ? supabaseAnonKey.slice(0, 20) : "(missing)"
);
console.log("[supabase] ANON_KEY length:", supabaseAnonKey ? supabaseAnonKey.length : 0);

// ✅ Basic validation (common mistake: key starts with 'eeyJ' instead of 'eyJ')
if (supabaseAnonKey && !supabaseAnonKey.startsWith("eyJ")) {
  console.warn(
    "[supabase] WARNING: ANON key looks wrong (should start with 'eyJ'). " +
      "Re-copy the 'anon public' key from Supabase Dashboard → Project Settings → API."
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// ✅ Create client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
