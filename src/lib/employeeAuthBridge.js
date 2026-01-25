// src/lib/employeeAuthBridge.js
import { supabase } from "./supabaseClient";

/**
 * Ensure Supabase Auth session exists (needed for Storage + RLS).
 * This does NOT change your app login logic (SQL/RPC).

 */

/* ---------------------- helpers ---------------------- */
const normalizeSupabasePassword = (rawPassword) => {
  const raw = String(rawPassword ?? "");
  if (raw.length >= 6) return raw;

  return `docs-${raw || "000000"}`;
};

const normalizeEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()

    .replace(/\s+/g, "")
    .replace(/['"]+/g, "")
    .replace(/[^\x20-\x7E]/g, "");

const isValidEmail = (email) => 
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email);

const looksLikeEmail = (v) => String(v || "").includes("@");

const safeIdForEmail = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()

    .replace(/[^a-z0-9]/g, "");

const simpleHash = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(16);
};

const plusAddress = (email, tag) => {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at === -1) return null;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const suffix = safeIdForEmail(tag || "");
  if (!local || !domain) return null;
  const candidate = `${local}+${suffix}@${domain}`;
  return isValidEmail(candidate) ? candidate : null;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------------------- main ---------------------- */
export async function ensureAdminSupabaseSession({
  role,
  identifier,
  password,

  adminId = null,
  preferredEmail = undefined,
}) {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  if (sess?.session?.user) return sess.session.user;

  const r = String(role || "").trim().toLowerCase();
  const idRaw = String(identifier || "").trim();


  let email = preferredEmail ? normalizeEmail(preferredEmail) : "";
  if (!email && looksLikeEmail(idRaw)) {
    email = normalizeEmail(idRaw);
  }


  if (r === "employee") {
    // Always force employees onto a known-allowed domain to avoid external domain blocks.
    const safeEmp = safeIdForEmail(idRaw || email) || "employee";
    email = `${safeEmp}@twite.ai`;
  } else if (!email) {
    if (r === "hr" || r === "manager") {
      const idMaybe = normalizeEmail(idRaw);
      email = isValidEmail(idMaybe) ? idMaybe : `${safeIdForEmail(idRaw)}@hrmss-internal.com`;
    } else if (r === "admin" || r === "admin-head") {
      email = "admin@twite-hrms.com";
    } else {
      const safe = safeIdForEmail(idRaw) || "user";
      email = `${safe}.user@twite-hrms.com`;
    }
  }

  if (!email || !isValidEmail(email)) {
    const fallback = `${safeIdForEmail(idRaw) || "user"}.${r.slice(0,2)}@twite-bridge.com`;
    email = fallback;
  }
  
  const supabasePassword = normalizeSupabasePassword(password);
  console.info(`[AuthBridge] Attempting session for ${r}. Identifier: ${idRaw}, Target Email: ${email}`);

  let attemptedEmail = email;
  async function tryAuth(targetEmail) {
    attemptedEmail = targetEmail;
    const { data: auth, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: supabasePassword,
    });

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      const canSignup =
        msg.includes("invalid login credentials") ||
        msg.includes("user not found") ||
        msg.includes("no user") ||
        msg.includes("email not confirmed") ||
        error.status === 400;

      if (canSignup) {
        const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
          email: targetEmail,
          password: supabasePassword,
        });

        if (signUpErr) return { error: signUpErr };
        if (signUp?.session?.user) return { user: signUp.session.user };

        const { data: auth2, error: auth2Err } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: supabasePassword,
        });
        return { user: auth2?.user, error: auth2Err };
      }
      return { error };
    }
    attemptedEmail = targetEmail;
    return { user: auth.user };
  }

  let result = await tryAuth(email);

  // If primary attempt failed for ANY reason, try again or fallback alias
  if (result.error) {
    const errMsgRaw = String(result.error.message || "");
    const errMsg = errMsgRaw.toLowerCase();
    const isRateLimited =
      result.error.status === 429 || errMsg.includes("only request this after");

    if (isRateLimited) {
      // Respect Supabase throttling window before retrying once.
      const match = errMsgRaw.match(/after\s+(\d+)\s*seconds?/i);
      const delay = match ? (Number(match[1]) + 1) * 1000 : 45000;
      console.warn(
        `[DocsAuth] Supabase rate-limited signup/signin; waiting ${Math.round(
          delay / 1000
        )}s before retry.`
      );
      await wait(delay);
      result = await tryAuth(email);
    }

    // If still failing and not rate-limited, try password-scoped alias
    if (result.error && !isRateLimited) {
      const suffix = simpleHash(supabasePassword);

      // For employees, avoid plus-addressing (some providers block it); use hyphenated alias instead.
      let fallbackEmail = email;
      if (r === "employee") {
        const at = email.indexOf("@");
        if (at !== -1) {
          const local = email.slice(0, at);
          const domain = email.slice(at + 1);
          fallbackEmail = `${local}-${suffix}@${domain}`;
        }
      } else {
        fallbackEmail = plusAddress(email, suffix);
      }

      if (fallbackEmail && fallbackEmail !== email) {
        console.warn(
          `[DocsAuth] Primary attempt failed (${result.error.message}). Retrying with fallback alias: ${fallbackEmail}`
        );
        await wait(400);
        result = await tryAuth(fallbackEmail);
      }
    }
  }

  if (result.error) {
    console.error(`[AuthBridge] Bridge failure for ${attemptedEmail}:`, result.error);
    throw new Error(
      `Supabase Auth bridge failed for ${r} (${attemptedEmail}). Details: ${result.error.message}`
    );
  }

  return result.user;
}

export async function ensureRoleAuthSession({ role, identifier, password, preferredEmail } = {}) {
  const { data: sess, error: sessErr } = await supabase.auth.getSession();
  if (sessErr) throw sessErr;
  if (sess?.session?.user) return sess.session.user;

  if (!password) return null;

  return ensureAdminSupabaseSession({
    role,
    identifier,
    password,
    preferredEmail,
  });
}
