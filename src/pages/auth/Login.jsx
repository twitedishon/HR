// src/pages/auth/Login.jsx
import { useMemo, useRef, useState, useEffect, forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { MANAGER_SESSION_KEY } from "../manager/managerData";
import { ensureAdminSupabaseSession } from "../../lib/employeeAuthBridge";

import Preloader from "../../components/Preloader";

const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";

const Field = forwardRef(
  (
    { icon: Icon, type = "text", placeholder, right, autoComplete, required },
    ref
  ) => {
    return (
      <div className="flex items-center gap-3 border-b border-gray-300 pb-2 focus-within:border-purple-600 transition">
        <span className="text-purple-600 pointer-events-none">
          <Icon size={18} />
        </span>

        <input
          ref={ref}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="flex-1 min-w-0 w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
        />

        {right}
      </div>
    );
  }
);
Field.displayName = "Field";



/* ---------------- Login ---------------- */
export default function Login() {
  const navigate = useNavigate();

  const [role, setRole] = useState("manager"); // "hr" | "employee" | "manager"
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // refs (uncontrolled inputs)
  const hrEmailRef = useRef(null);
  const hrPassRef = useRef(null);

  const managerEmailRef = useRef(null);
  const managerPassRef = useRef(null);

  const empEmailRef = useRef(null);
  const empPassRef = useRef(null);

  const roleTitle = useMemo(() => {
    if (role === "manager") return "Founder Login";
    if (role === "employee") return "Employee Login";
    if (role === "hr") return "HR Login";
    return "Login";
  }, [role]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (role === "hr") hrEmailRef.current?.focus();
      if (role === "manager") managerEmailRef.current?.focus();
      if (role === "employee") empEmailRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
  }, [role]);

  const clearAllInputs = () => {
    setErr("");

    if (hrEmailRef.current) hrEmailRef.current.value = "";
    if (hrPassRef.current) hrPassRef.current.value = "";

    if (managerEmailRef.current) managerEmailRef.current.value = "";
    if (managerPassRef.current) managerPassRef.current.value = "";


    if (empEmailRef.current) empEmailRef.current.value = "";
    if (empPassRef.current) empPassRef.current.value = "";
  };

  const resetFields = (nextRole) => {
    setRole(nextRole);
    setShowPassword(false);
    clearAllInputs();
  };

  const roleRedirects = {
    hr: "/hr-dashboard",
    manager: "/manager-dashboard",
    admin: "/dashboard",
    employee: "/employee-dashboard",
  };

  const MANAGER_COMPLETION_KEY = "hrmss.signin.completed.manager";

  // ✅ completion keys for all roles (used by Sign-In + Guard)
  const COMPLETION_KEY = (r) => `hrmss.signin.completed.${r}`;
  const isCompleted = (r) => localStorage.getItem(COMPLETION_KEY(r)) === "true";

  // ✅ Shared helper to prefer verify_login_json for all roles
  const tryVerifyLoginJson = async (params) => {
    try {
      const session = await rpcVerifyApp(params);
      return session || null;
    } catch (err) {
      console.warn(
        `[Login] verify_login_json failed for role ${params?.p_role}:`,
        err?.message
      );
      return null;
    }
  };

  /* ---------- Local manager fallback (optional) ---------- */
  const resolveLocalManagerLogin = (email, password) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPassword = String(password || "").trim();

    const localAccounts = [
      {
        email: "arun.murugappa@twite.ai",

        password: "Twite@Arun",
        session: {
          id: "MGR-ARUN",
          name: "Arun Murugappa",
          email: "arun.murugappa@twite.ai",
          access: "approver",
          team: "Approvals",
        },
        route: "/manager-approver-dashboard",
      },
      {
        email: "sunil.reddy@twite.ai",

        password: "Twite@Sunil",
        session: {
          id: "MGR-SUNIL",
          name: "Sunil Reddy",
          email: "sunil.reddy@twite.ai",
          access: "viewer",
          team: "Operations",
        },
        route: "/manager-dashboard",
      },
    ];

    const match = localAccounts.find(
      (acct) =>
        acct.email.toLowerCase() === normalizedEmail &&
        acct.password === normalizedPassword
    );
    return match || null;
  };


  /* ---------------- RPC HELPERS ---------------- */

  // ✅ HR/Admin login RPC (JSON)
  const rpcVerifyApp = async ({
    p_role,
    p_identifier,
    p_admin_id = null,
    p_secret,
  }) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        "Supabase env missing. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
      );
    }

    const { data, error } = await supabase.rpc("verify_login_json", {
      p_role,
      p_identifier,
      p_admin_id,
      p_secret,
    });

    if (error) throw new Error(error.message || "Login failed");
    if (!data) throw new Error("Invalid credentials");


    // ✅ Don't expose internal errors like "role mismatch" - show generic message
    if (data.error) {
      console.error("Login error:", data.error); // Log for debugging
      throw new Error("Invalid credentials or access denied");
    }

    return data;
  };

  // ✅ Manager login RPC (JSON)
  const rpcManagerLogin = async ({ p_email, p_password }) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        "Supabase env missing. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
      );
    }


    // 1. Try normal login
    const { data, error } = await supabase.rpc("manager_login_js", {
      p_email,
      p_password,
    });

    if (error) throw new Error(error.message || "Founder login failed");


    // 2. If valid data, return it
    if (data) return data;

    // 3. If login failed, run debug helper for console tracing only
    console.warn("Login failed. Running debug tool...");
    try {
      const { data: debugMsg, error: debugErr } = await supabase.rpc(
        "debug_manager_login",
        {
          p_email,
          p_password,
        }
      );

      if (debugErr) {
        console.error("Debug tool error:", debugErr);
      } else if (debugMsg) {
        console.debug("Manager login debug info:", debugMsg);
      }
    } catch (e) {
      console.error("Debug execution failed:", e);
    }

    throw new Error("Invalid email or password");
  };

  // ✅ Check HR/Admin/Manager profile exists in hrmss_profiles
  const appProfileExists = async (userId) => {
    const uid = String(userId || "").trim();
    if (!uid) return false;

    const { data, error } = await supabase
      .from("hrmss_profiles")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  };

  // ✅ Check Employee profile completion in hrmss_employee_profiles
  const employeeProfileCompleted = async (employeeId, email) => {
    const empId = String(employeeId || "").trim();
    const empEmail = String(email || "").trim();
    if (!empId && !empEmail) return false;

    let query = supabase
      .from("hrmss_employee_profiles")
      .select("profile_completed");

    if (empId) {
      query = query.eq("employee_id", empId);
    } else {
      query = query.or(
        `official_email.eq.${empEmail},personal_email.eq.${empEmail}`
      );
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw error;
    return !!data?.profile_completed;
  };

  /* ---------------- SUPABASE AUTH BRIDGE (FOR DOCUMENTS) ---------------- */

  const persistDocsAuth = (params) => {
    if (!params?.password) return;
    const payload = {
      role: params?.role || "",
      identifier: params?.identifier || "",
      preferredEmail: params?.preferredEmail || "",
      password: params?.password || "",
    };
    try {
      sessionStorage.setItem(DOCS_AUTH_KEY, JSON.stringify(payload));
    } catch {
      try {
        localStorage.setItem(DOCS_AUTH_KEY, JSON.stringify(payload));
      } catch { }
    }
  };


  // ✅ Don’t break app login if bridge fails; only log a warning.
  const tryEnsureSupabaseForDocs = async (params, roleLabelForError = "") => {
    try {
      persistDocsAuth(params);
      await ensureAdminSupabaseSession(params);


      // mark ok
      const k = `hrmss.supabase.docsAuth.ok.${params?.role || "unknown"}`;
      localStorage.setItem(k, "true");
      return true;
    } catch (e) {
      const k = `hrmss.supabase.docsAuth.ok.${params?.role || "unknown"}`;
      localStorage.setItem(k, "false");


      // Keep app login working, only warn in console. 
      // Background sync is secondary to app-level RPC login.
      console.warn(`[DocsAuth] Background sync warning for ${roleLabelForError || "user"}:`, e.message);

      return false;
    }
  };

  /* ---------------- SUBMIT (LOGIN) ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const hrEmail = hrEmailRef.current?.value?.trim() || "";
    const hrPassword = hrPassRef.current?.value?.trim() || "";

    const managerEmail = managerEmailRef.current?.value?.trim() || "";
    const managerPassword = managerPassRef.current?.value?.trim() || "";


    const empEmail = empEmailRef.current?.value?.trim() || "";
    const empPassword = empPassRef.current?.value?.trim() || "";

    try {
      setLoading(true);

      // HR
      if (role === "hr") {
        if (!hrEmail || !hrPassword) {
          setErr("Enter email and password");
          return;
        }

        const session = await rpcVerifyApp({
          p_role: "hr",
          p_identifier: hrEmail,
          p_admin_id: null,
          p_secret: hrPassword,
        });

        localStorage.setItem(
          "HRMSS_AUTH_SESSION",
          JSON.stringify({ ...session, loginRole: "hr" })
        );

        // ✅ Ensure Supabase session for Documents/Storage (will not block app login)
        await tryEnsureSupabaseForDocs(
          {
            role: "hr",
            identifier: hrEmail,
            password: hrPassword,
            preferredEmail: hrEmail,
          },
          "hr"
        );

        const userId =
          session?.user_id || session?.id || session?.userId || null;
        const completed =
          isCompleted("hr") || (userId ? await appProfileExists(userId) : false);

        const isHariPriya =
          String(hrEmail || "").trim().toLowerCase() ===
          "haripriya@twite.ai" &&
          String(hrPassword || "").trim() === "Twite@HariPriya";

        if (isHariPriya) {
          // ✅ Approver employee: check profile completion before redirecting
          const employeeProfileDone = await employeeProfileCompleted(null, hrEmail);
          localStorage.setItem(COMPLETION_KEY("admin"), employeeProfileDone ? "true" : "false");

          if (!employeeProfileDone) {
            navigate("/sign-in", {
              replace: true,
              state: { role: "admin", redirectTo: roleRedirects.admin },
            });
            return;
          }

          navigate(roleRedirects.admin, { replace: true });
          return;
        }

        if (!completed) {
          navigate("/sign-in", {
            replace: true,
            state: { role: "hr", redirectTo: roleRedirects.hr },
          });
          return;
        }

        navigate(roleRedirects.hr, { replace: true });
        return;
      }

      // MANAGER
      if (role === "manager") {
        if (!managerEmail || !managerPassword) {
          setErr("Enter email and password");
          return;
        }

        // 1) Prefer unified RPC (same as HR) if available
        const managerSessionFromVerify = await tryVerifyLoginJson({
          p_role: "manager",
          p_identifier: managerEmail,
          p_admin_id: null,
          p_secret: managerPassword,
        });

        if (managerSessionFromVerify) {
          const access = String(
            managerSessionFromVerify.access ||
            managerSessionFromVerify.role ||
            "viewer"
          ).toLowerCase();

          const route =
            access === "approver"
              ? "/manager-approver-dashboard"
              : "/manager-dashboard";

          const managerSession = {
            id:
              managerSessionFromVerify.manager_code ||
              managerSessionFromVerify.id ||
              managerSessionFromVerify.user_id ||
              "MGR",
            name:
              managerSessionFromVerify.full_name ||
              managerSessionFromVerify.name ||
              "Founder",
            email: managerSessionFromVerify.email || managerEmail,
            role: "manager",
            access,
            team:
              managerSessionFromVerify.team ||
              managerSessionFromVerify.department ||
              "Team",
          };

          localStorage.setItem(
            MANAGER_SESSION_KEY,
            JSON.stringify(managerSession)
          );
          localStorage.setItem(
            "HRMSS_AUTH_SESSION",
            JSON.stringify({
              ...managerSession,
              loginRole: "manager",
              role: "manager",
            })
          );

          await tryEnsureSupabaseForDocs(
            {
              role: "manager",
              identifier: managerEmail,
              password: managerPassword,
              preferredEmail: managerEmail,
            },
            "manager"
          );

          if (!localStorage.getItem(MANAGER_COMPLETION_KEY)) {
            localStorage.setItem(MANAGER_COMPLETION_KEY, "false");
          }

          const completed =
            localStorage.getItem(MANAGER_COMPLETION_KEY) === "true" ||
            isCompleted("manager") ||
            (managerSession?.id
              ? await appProfileExists(managerSession.id)
              : false);

          if (!completed) {
            navigate("/sign-in", {
              replace: true,
              state: { role: "manager", access, redirectTo: route },
            });
            return;
          }

          navigate(route, { replace: true });
          return;
        }

        // 2) Local fallback (unchanged)
        const localLogin = resolveLocalManagerLogin(
          managerEmail,
          managerPassword
        );
        if (localLogin) {
          localStorage.setItem(
            MANAGER_SESSION_KEY,
            JSON.stringify(localLogin.session)
          );
          localStorage.setItem(
            "HRMSS_AUTH_SESSION",
            JSON.stringify({
              ...localLogin.session,
              loginRole: "manager",
              role: "manager",
            })
          );

          // ✅ Ensure Supabase session for Documents/Storage (will not block app login)
          await tryEnsureSupabaseForDocs(
            {
              role: "manager",
              identifier: managerEmail,
              password: managerPassword,
              preferredEmail: managerEmail,
            },
            "manager"
          );

          if (!localStorage.getItem(MANAGER_COMPLETION_KEY)) {

            localStorage.setItem(MANAGER_COMPLETION_KEY, "true");
          }

          const redirectTo = localLogin.route;

          const completed =
            localStorage.getItem(MANAGER_COMPLETION_KEY) === "true" ||
            isCompleted("manager") ||
            (localLogin.session?.id
              ? await appProfileExists(localLogin.session.id)
              : false);

          if (!completed) {
            navigate("/sign-in", {
              replace: true,
              state: {
                role: "manager",
                access: localLogin.session.access,
                redirectTo,
              },
            });
            return;
          }

          navigate(redirectTo, { replace: true });
          return;
        }

        // 3) Legacy RPC fallback
        const m = await rpcManagerLogin({
          p_email: managerEmail,
          p_password: managerPassword,
        });


        const access = String(m.access || m.role || "viewer").toLowerCase();
        const route =
          access === "approver"
            ? "/manager-approver-dashboard"
            : "/manager-dashboard";

        const managerSession = {
          id: m.manager_code || m.id || "MGR",
          name: m.full_name || "Founder",
          email: m.email,

          role: "manager",
          access,
          team: m.team || "Team",
        };

        localStorage.setItem(
          MANAGER_SESSION_KEY,
          JSON.stringify(managerSession)
        );
        localStorage.setItem(
          "HRMSS_AUTH_SESSION",
          JSON.stringify({
            ...managerSession,
            loginRole: "manager",
            role: "manager",
          })
        );

        // ✅ Ensure Supabase session for Documents/Storage (will not block app login)
        await tryEnsureSupabaseForDocs(
          {
            role: "manager",
            identifier: managerEmail,
            password: managerPassword,
            preferredEmail: managerEmail,
          },
          "manager"
        );

        if (!localStorage.getItem(MANAGER_COMPLETION_KEY)) {
          localStorage.setItem(MANAGER_COMPLETION_KEY, "false");
        }

        const completed =
          localStorage.getItem(MANAGER_COMPLETION_KEY) === "true" ||
          isCompleted("manager") ||
          (managerSession?.id ? await appProfileExists(managerSession.id) : false);

        if (!completed) {
          navigate("/sign-in", {
            replace: true,
            state: { role: "manager", access, redirectTo: route },
          });
          return;
        }

        navigate(route, { replace: true });
        return;
      }

      // ✅ EMPLOYEE
      if (role === "employee") {
        if (!empEmail || !empPassword) {
          setErr("Enter employee email and password");
          return;
        }

        const session = await rpcVerifyApp({
          p_role: "employee",
          p_identifier: empEmail,
          p_admin_id: null,
          p_secret: empPassword,
        });

        const normalizedEmpEmail = String(empEmail || "").trim().toLowerCase();
        const isHariPriyaEmployee = normalizedEmpEmail === "haripriya@twite.ai";
        const targetRole = isHariPriyaEmployee ? "admin" : "employee";

        // If HariPriya signs in via the Employee tab, treat her as Admin so she lands
        // on the admin dashboard without extra setup screens.
        const sessionPayload = {
          ...session,
          loginRole: targetRole,
          role: targetRole,
        };

        localStorage.setItem("HRMSS_AUTH_SESSION", JSON.stringify(sessionPayload));

        // ✅ Ensure Supabase session for Documents/Storage (will not block app login)
        await tryEnsureSupabaseForDocs(
          {
            role: targetRole,
            identifier: empEmail,
            password: empPassword,
            preferredEmail: empEmail,
          },
          targetRole
        );

        const employeeId =
          session?.employee_id ||
          session?.employeeId ||
          session?.id ||
          session?.user_id ||
          session?.userId ||
          null;

        const completed = await employeeProfileCompleted(employeeId, empEmail);

        localStorage.setItem(
          COMPLETION_KEY("employee"),
          completed ? "true" : "false"
        );

        if (isHariPriyaEmployee) {
          // ✅ Approver employee: check profile completion before redirecting
          localStorage.setItem(COMPLETION_KEY("admin"), completed ? "true" : "false");

          if (!completed) {
            navigate("/sign-in", {
              replace: true,
              state: { role: "admin", redirectTo: roleRedirects.admin },
            });
            return;
          }

          navigate(roleRedirects.admin, { replace: true });
          return;
        }

        if (!completed) {
          navigate("/sign-in", {
            replace: true,
            state: { role: "employee", redirectTo: "/employee-dashboard" },
          });
          return;
        }

        navigate(roleRedirects.employee, { replace: true });
        return;
      }
    } catch (ex) {

      const friendlyMessage =
        typeof ex?.message === "string" &&
          ex.message.toLowerCase().includes("invalid")
          ? "Invalid email or password"
          : ex?.message || "Login failed";
      setErr(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const RoleTab = ({ value, label }) => {
    const active = role === value;
    return (
      <button
        type="button"
        onClick={() => resetFields(value)}
        className={`text-sm font-semibold pb-2 transition ${active
          ? "text-purple-700 border-b-2 border-purple-700"
          : "text-gray-500 hover:text-gray-700"
          }`}
      >
        {label}
      </button>
    );
  };

  const rightImageUrl =
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=60";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#6D28D9] p-4">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* LEFT */}
          <div className="p-8 md:p-10">
            <div className="max-w-md">
              <h1 className="text-3xl font-extrabold text-gray-900">Login</h1>
              <div className="mt-2 h-1 w-10 rounded bg-purple-700" />

              <div className="mt-6 flex items-center gap-6 flex-wrap">
                <RoleTab value="manager" label="Founder" />
                <RoleTab value="hr" label="HR" />
                <RoleTab value="employee" label="Employee" />
              </div>

              <div className="mt-2 text-xs text-gray-500">{roleTitle}</div>

              {err && (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex gap-2">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div className="min-w-0">{err}</div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                {/* HR */}
                {role === "hr" && (
                  <>
                    <Field
                      ref={hrEmailRef}
                      icon={Mail}
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      required
                    />
                    <Field
                      ref={hrPassRef}
                      icon={Lock}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      right={
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setShowPassword((s) => !s);
                            setTimeout(() => hrPassRef.current?.focus(), 0);
                          }}
                          className="shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                  </>
                )}

                {/* MANAGER */}
                {role === "manager" && (
                  <>
                    <Field
                      ref={managerEmailRef}
                      icon={Mail}
                      type="email"
                      placeholder="Enter manager email"
                      autoComplete="email"
                      required
                    />
                    <Field
                      ref={managerPassRef}
                      icon={Lock}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter manager password"
                      autoComplete="current-password"
                      required
                      right={
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setShowPassword((s) => !s);
                            setTimeout(() => managerPassRef.current?.focus(), 0);
                          }}
                          className="shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                  </>
                )}

                {/* EMPLOYEE */}
                {role === "employee" && (
                  <>
                    <Field
                      ref={empEmailRef}
                      icon={Mail}
                      type="email"
                      placeholder="Enter your email"
                      autoComplete="email"
                      required
                    />
                    <Field
                      ref={empPassRef}
                      icon={Lock}
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      right={
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setShowPassword((s) => !s);
                            setTimeout(() => empPassRef.current?.focus(), 0);
                          }}
                          className="shrink-0 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                    />
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-md text-white font-semibold transition shadow-md ${loading
                    ? "bg-purple-400 cursor-not-allowed"
                    : "bg-purple-700 hover:bg-purple-800"
                    }`}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>


                {!isSupabaseConfigured && (
                  <div className="text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Supabase env missing. Add <b>VITE_SUPABASE_URL</b> and{" "}
                    <b>VITE_SUPABASE_ANON_KEY</b> in .env
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* RIGHT */}
          <div className="relative hidden md:block">
            <div
              className="absolute inset-0 bg-center bg-cover"
              style={{ backgroundImage: `url(${rightImageUrl})` }}
            />
            <div className="absolute inset-0 bg-purple-800/70" />
            <div className="relative h-full flex items-center justify-center p-10 text-center">
              <div className="text-white">
                <div className="text-3xl font-extrabold leading-snug">
                  HUMAN RESOURCE <br /> MANAGEMENT SYSTEM
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE */}
          {/* <div className="md:hidden bg-purple-800 text-white px-8 py-8 text-center">
            <div className="text-xl font-bold">Welcome</div>
            <div className="text-white/80 text-sm mt-1">Role based login</div>
          </div> */}
        </div>
      </div>
    </div>
  );
}


