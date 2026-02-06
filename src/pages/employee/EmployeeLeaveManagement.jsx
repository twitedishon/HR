// src/pages/employee/EmployeeLeaveManagement.jsx
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, X, Check } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

/* ---------------- CONSTANTS ---------------- */
const LEAVES_TABLE = "hrmss_leave_requests";
const APPROVER_TABLE = "hrmss_approvers";

/** ✅ Role/session keys used across your project */
const AUTH_KEY = "HRMSS_AUTH_SESSION";
const LEGACY_EMP_SIGNIN_KEY = "hrmss.employee.signin";

/**
 * ✅ If you want to force-hide specific approver IDs from "Request To",
 * add their ids here. Example: new Set(["APP-002"])
 */
const EXCLUDE_APPROVER_IDS = new Set([]);

/* ---------------- LISTS ---------------- */
const leaveTypes = [
  "Casual Leave",
  "Sick Leave",
  "Maternity/Paternity",
  "Paid Leave",
  "Work from home",
  "Holidays",
  "Permissions",
  "Special Leave",
  "Bereavement Leave",
];
const probationLeaveTypes = ["Emergency Leave"];
const leaveModes = ["Full Day", "Half Day", "Permission"];

/* ---------------- UI helpers ---------------- */
const tone = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const needsTime = (mode) => mode === "Permission" || mode === "Half Day";

const shortTime = (t) => {
  if (!t) return "";
  const s = String(t);
  return s.length >= 5 ? s.slice(0, 5) : s;
};

const calcDuration = (from, to) => {
  if (!from || !to) return "";
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const diff = th * 60 + tm - (fh * 60 + fm);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h ? `${h} Hour${h > 1 ? "s" : ""}` : ""}${h && m ? " " : ""}${m ? `${m} Minutes` : ""
    }`;
};

/* ✅ DD-MM-YYYY format for display */
const toDMY = (v) => {
  if (!v) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(v))) {
    const [y, m, d] = String(v).split("-");
    return `${d}-${m}-${y}`;
  }
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear());
    return `${dd}-${mm}-${yy}`;
  } catch {
    return String(v);
  }
};

const fmtDateTimeDMY = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yy} ${hh}:${mi}`;
  } catch {
    return String(iso);
  }
};

/* ---------------- ✅ CURRENT EMPLOYEE FROM STORAGE (NO FAKE FALLBACK) ---------------- */
const safeJson = (v) => {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const normalizeUser = (obj) => {
  if (!obj || typeof obj !== "object") return null;

  const id =
    obj.employee_id ||
    obj.employeeId ||
    obj.emp_id ||
    obj.empId ||
    obj.identifier ||
    obj.id ||
    obj.user_id ||
    obj.userId ||
    "";

  const name =
    obj.employee_name ||
    obj.employeeName ||
    obj.name ||
    obj.full_name ||
    obj.fullName ||
    obj.username ||
    obj.user_name ||
    "";

  const empId = String(id || "").trim();
  const empName = String(name || "").trim();

  if (!empId) return null;
  return { id: empId, name: empName || empId };
};

const readAuthCache = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readLegacyEmployeeSignin = () => {
  try {
    const raw = localStorage.getItem(LEGACY_EMP_SIGNIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readManagerFromCache = (empId) => {
  if (!empId) return "";
  const key = `hrmss.profile.cache.employee.${empId}`;
  try {
    const parsed = safeJson(localStorage.getItem(key));
    if (!parsed) return "";
    return (
      parsed?.manager ||
      parsed?.reporting_manager ||
      parsed?.reportingManager ||
      parsed?.job?.manager ||
      parsed?.job?.reporting_manager ||
      ""
    );
  } catch {
    return "";
  }
};

const readProfileFromCache = (empId) => {
  if (!empId) return {};
  const key = `hrmss.profile.cache.employee.${empId}`;
  const parsed = safeJson(localStorage.getItem(key));
  if (!parsed || typeof parsed !== "object") return {};
  const employeeType =
    parsed.employeeType ||
    parsed.employee_type ||
    parsed.job?.employeeType ||
    parsed.job?.employee_type ||
    "";
  return {
    status:
      parsed.status ||
      parsed.employee_status ||
      parsed.employment_status ||
      "",
    joinDate: parsed.join_date || parsed.joinDate || parsed.joining_date || "",
    employeeType: String(employeeType || "").trim(),
  };
};

const getEmployeeFromStorage = () => {
  if (typeof window === "undefined") return null;

  // 1) Preferred: HRMSS_AUTH_SESSION
  const auth = readAuthCache();
  const authUser = normalizeUser(auth?.user || auth);
  const authManager =
    auth?.manager ||
    auth?.reporting_manager ||
    auth?.reportingManager ||
    auth?.job?.manager ||
    "";
  const authManagerFromCache = readManagerFromCache(authUser?.id);
  const authManagerFinal = authManager || authManagerFromCache;
  const role1 = String(
    auth?.role || auth?.loginRole || authUser?.role || ""
  ).toLowerCase();
  if (authUser?.id && (!role1 || role1.includes("employee")))
    return authManagerFinal
      ? { ...authUser, manager: String(authManagerFinal) }
      : authUser;

  // 2) Legacy employee sign-in
  const legacy = readLegacyEmployeeSignin();
  const legacyUser = normalizeUser(legacy?.user || legacy);
  const legacyManager =
    legacy?.manager ||
    legacy?.reporting_manager ||
    legacy?.reportingManager ||
    legacy?.job?.manager ||
    "";
  const legacyManagerFromCache = readManagerFromCache(legacyUser?.id);
  const legacyManagerFinal = legacyManager || legacyManagerFromCache;
  const role2 = String(legacy?.role || legacy?.loginRole || "").toLowerCase();
  if (legacyUser?.id && (!role2 || role2.includes("employee")))
    return legacyManagerFinal
      ? { ...legacyUser, manager: String(legacyManagerFinal) }
      : legacyUser;

  // 3) Profile cache pattern
  const enrichWithManager = (base, manager) =>
    base && manager ? { ...base, manager: String(manager) } : base;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith("hrmss.profile.cache.employee.")) continue;
      const parsed = safeJson(localStorage.getItem(k));
      const u = normalizeUser(parsed);
      if (!u?.manager) {
        const mgr =
          parsed?.manager ||
          parsed?.reporting_manager ||
          parsed?.reportingManager ||
          parsed?.job?.manager ||
          parsed?.job?.reporting_manager;
        if (mgr) u.manager = String(mgr);
      }
      if (u?.id) return u;
    }
  } catch {
    // ignore
  }

  // 4) If we had manager in auth/legacy, attach and return
  if (authUser?.id) return enrichWithManager(authUser, authManagerFinal);
  if (legacyUser?.id) return enrichWithManager(legacyUser, legacyManagerFinal);

  return null;
};

const isProbationComplete = (joinDate) => {
  if (!joinDate) return false;
  const joined = new Date(joinDate);
  if (Number.isNaN(joined.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - joined.getTime();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return diffMs >= ninetyDaysMs;
};

// Show reporting manager + other managers (not admins or HR)
const filterApproversForEmployee = (list, emp, managerOverride = "") => {
  if (!Array.isArray(list) || !list.length) return [];

  const mgrValue = String(managerOverride || emp?.manager || "")
    .trim()
    .toLowerCase();
  const seen = new Set();
  const filtered = [];
  const add = (item) => {
    if (!item?.id || seen.has(item.id)) return;
    seen.add(item.id);
    filtered.push(item);
  };

  // First, add the employee's reporting manager
  if (mgrValue) {
    const match = list.find((x) => {
      const email = String(x.email || "").toLowerCase();
      const id = String(x.id || "").toLowerCase();
      const name = String(x.name || "").toLowerCase();
      return email === mgrValue || id === mgrValue || name === mgrValue;
    });
    if (match) add(match);
  }

  // Then add all managers (not admins or HR)
  list.filter((x) => x.role === "manager").forEach(add);
  return filtered;
};

/* ---------------- APPLY MODAL (Create) ---------------- */
const ApplyModal = ({ open, onClose, children }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl ring-1 ring-slate-200 overflow-hidden flex flex-col">
        <div className="shrink-0 bg-gradient-to-r from-fuchsia-700 via-indigo-700 to-sky-600 text-white px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mt-1 text-lg font-semibold">Apply Leave</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/15"
            aria-label="Close"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

const TimePreset = ({ onMorning, onAfternoon }) => (
  <div className="flex gap-2 flex-wrap">
    <button
      type="button"
      onClick={onMorning}
      className="px-3 py-1 text-xs border rounded-lg hover:bg-slate-50"
    >
      Morning (09:00 - 13:00)
    </button>
    <button
      type="button"
      onClick={onAfternoon}
      className="px-3 py-1 text-xs border rounded-lg hover:bg-slate-50"
    >
      Afternoon (13:00 - 17:00)
    </button>
  </div>
);

/* ---------------- MULTI SELECT (checkbox list) ---------------- */
const MultiApproverSelect = ({ items, valueIds, setValueIds, errorText }) => {
  const toggle = (id) => {
    setValueIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const selectedNames = useMemo(() => {
    const map = new Map(items.map((x) => [x.id, x]));
    return valueIds
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((x) => x.name);
  }, [items, valueIds]);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-3 py-2 bg-white border-b text-xs font-semibold text-slate-700">
          Request To
        </div>

        <div className="max-h-44 overflow-y-auto bg-white">
          {items.length === 0 ? (
            <div className="p-3 text-xs text-rose-600">
              Approver list empty.
              {errorText ? (
                <div className="mt-1">Error: {errorText}</div>
              ) : (
                <div className="mt-1">
                  Check <b>hrmss_approvers</b> table + RLS SELECT policy.
                </div>
              )}
            </div>
          ) : (
            items.map((a) => {
              const checked = valueIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {a.id}
                      {a.role
                        ? ` • ${a.role === "manager" ? "Founder" : a.role}`
                        : ""}
                      {a.access ? ` • ${a.access}` : ""}
                    </div>
                  </div>

                  <span
                    className={`shrink-0 w-6 h-6 rounded-lg border flex items-center justify-center ${checked
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-transparent"
                      }`}
                  >
                    <Check size={14} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ======================= COMMON SMALL INFO CARD ======================= */
function InfoCard({ label, value, multiline = false, big = false, children }) {
  return (
    <div className="rounded-2xl border bg-slate-50 p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={`mt-1 font-semibold text-slate-900 ${big ? "text-sm" : "text-base"
          }`}
      >
        {children ? (
          children
        ) : multiline ? (
          <div className="whitespace-pre-line leading-5">{value}</div>
        ) : (
          <div className="leading-5">{value}</div>
        )}
      </div>
    </div>
  );
}

/* ======================= ✅ VIEW MODAL (Compact) ======================= */
function LeaveViewModal({ open, onClose, emp, data }) {
  if (!open || !data) return null;

  const initials = String(emp?.name || "EMP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");

  const topLine = `${data.leaveType || ""} • ${data.mode || ""}${data.timeFrom && data.timeTo ? ` • ${data.timeFrom} → ${data.timeTo}` : ""
    }${data.hours ? ` • ${data.hours}` : ""}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-[26px] bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col">
        <div className="shrink-0 bg-gradient-to-r from-fuchsia-700 via-indigo-700 to-purple-600 text-white px-5 py-4 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/15"
            aria-label="Close"
          >
            <X size={18} className="text-white" />
          </button>

          <div className="text-[11px] tracking-widest opacity-90">
            LEAVE REQUEST
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="text-xl font-bold">
              #{String(data.id).slice(0, 8)}
            </div>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone[data.status]
                }`}
            >
              {data.status}
            </span>
          </div>

          <div className="mt-2 text-xs text-white/90">{topLine}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl border bg-indigo-50 grid place-items-center text-indigo-700 font-bold text-sm">
              {initials || "E"}
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 leading-6">
                {emp?.name || "-"}
              </div>
              <div className="text-sm text-slate-500">{emp?.id || "-"}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard label="From" value={toDMY(data.from)} />
            <InfoCard label="To" value={toDMY(data.to)} />
            <InfoCard
              label="Days"
              value={(() => {
                // For half day or permission, always 1 day
                if (data.mode === "Half Day" || data.mode === "Permission") return "0.5";
                // Calculate days between from and to (inclusive)
                const from = new Date(data.from);
                const to = new Date(data.to);
                if (isNaN(from.getTime()) || isNaN(to.getTime())) return "1";
                from.setHours(0, 0, 0, 0);
                to.setHours(0, 0, 0, 0);
                const diffMs = to - from;
                const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
                return String(Math.max(days, 1));
              })()}
            />
            <InfoCard
              label="Applied"
              value={
                data.appliedAt
                  ? `${toDMY(String(data.appliedAt).slice(0, 10))}\n${new Date(
                    data.appliedAt
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                  : "-"
              }
              multiline
            />
          </div>

          {data.timeFrom && data.timeTo ? (
            <div className="mt-3">
              <InfoCard
                label="Time"
                value={`${data.timeFrom} → ${data.timeTo}${data.hours ? ` • ${data.hours}` : ""}`}
              />
            </div>
          ) : null}

          <div className="mt-3">
            <InfoCard label="Reason" value={data.reason || "-"} big />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= ✅ EDIT MODAL (Same size as VIEW) ======================= */
function LeaveEditModal({
  open,
  onClose,
  emp,
  data,
  approvers,
  onSave,
  allowedTypes,
}) {
  const [requestToId, setRequestToId] = useState("");
  const [type, setType] = useState("");
  const [mode, setMode] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [reason, setReason] = useState("");

  const leaveOptions =
    Array.isArray(allowedTypes) && allowedTypes.length ? allowedTypes : leaveTypes;

  useEffect(() => {
    if (!open || !data) return;
    setRequestToId(data.requestToId ? String(data.requestToId) : "");
    const initialType = leaveOptions.includes(data.leaveType)
      ? data.leaveType
      : leaveOptions[0] || "Casual Leave";
    setType(initialType);
    setMode(data.mode || "Full Day");
    setFrom(data.from || "");
    setTo(data.to || "");
    setFromTime(data.timeFrom || "");
    setToTime(data.timeTo || "");
    setReason(data.reason || "");
  }, [open, data, leaveOptions]);

  if (!open || !data) return null;

  const initials = String(emp?.name || "EMP")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("");

  const durationText = needsTime(mode)
    ? calcDuration(shortTime(fromTime), shortTime(toTime)) || "-"
    : from && to
      ? `${toDMY(from)} → ${toDMY(to)}`
      : "-";

  const topLine = `${type || ""} • ${mode || ""}${needsTime(mode) && fromTime && toTime
    ? ` • ${shortTime(fromTime)} → ${shortTime(toTime)}`
    : ""
    }${needsTime(mode) ? ` • ${durationText !== "-" ? durationText : ""}` : ""}`;

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!requestToId) return alert("Please select Request To (approver).");
    if (!leaveOptions.includes(type))
      return alert("This leave type is not allowed for your current status.");
    if (!from) return alert("From date required.");
    if (mode === "Full Day" && !to) return alert("To date required.");
    if (!reason.trim()) return alert("Reason required.");

    if (needsTime(mode)) {
      if (!fromTime || !toTime) return alert("Time From/To required.");
      const dur = calcDuration(shortTime(fromTime), shortTime(toTime));
      if (!dur) return alert("Invalid time range.");
    }

    onSave({
      requestToId,
      type,
      mode,
      from,
      to: mode === "Full Day" ? to : from,
      fromTime,
      toTime,
      reason,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-[26px] bg-white shadow-2xl ring-1 ring-slate-200 flex flex-col">
        <div className="shrink-0 bg-gradient-to-r from-fuchsia-700 via-indigo-700 to-purple-600 text-white px-5 py-4 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-xl border border-white/20 bg-white/10 p-2 hover:bg-white/15"
            aria-label="Close"
          >
            <X size={18} className="text-white" />
          </button>

          <div className="text-[11px] tracking-widest opacity-90">
            EDIT LEAVE
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div className="text-xl font-bold">
              #{String(data.id).slice(0, 8)}
            </div>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone[data.status]
                }`}
            >
              {data.status}
            </span>
          </div>

          <div className="mt-2 text-xs text-white/90">{topLine}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl border bg-indigo-50 grid place-items-center text-indigo-700 font-bold text-sm">
              {initials || "E"}
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900 leading-6">
                {emp?.name || "-"}
              </div>
              <div className="text-sm text-slate-500">{emp?.id || "-"}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {/* Request To */}
            <InfoCard label="Request To">
              <select
                value={requestToId}
                onChange={(e) => setRequestToId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">Select Approver</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}{" "}
                    {a.role
                      ? `(${a.role === "manager" ? "Founder" : a.role})`
                      : ""}
                  </option>
                ))}
              </select>
            </InfoCard>

            {/* Type + Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard label="Leave Type">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                >
                  {leaveOptions.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </InfoCard>

              <InfoCard label="Mode">
                <select
                  value={mode}
                  onChange={(e) => {
                    const next = e.target.value;
                    setMode(next);
                    if (needsTime(next)) setTo(from);
                    if (!needsTime(next)) {
                      setFromTime("");
                      setToTime("");
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                >
                  {leaveModes.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </InfoCard>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoCard label="From">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFrom(v);
                    if (needsTime(mode)) setTo(v);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </InfoCard>

              <InfoCard label="To">
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={needsTime(mode)}
                  className={`w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ${needsTime(mode)
                    ? "bg-slate-100 cursor-not-allowed"
                    : "bg-white"
                    }`}
                />
              </InfoCard>
            </div>

            {/* Time */}
            {needsTime(mode) && (
              <div className="space-y-2">
                <TimePreset
                  onMorning={() => {
                    setFromTime("09:00");
                    setToTime("13:00");
                  }}
                  onAfternoon={() => {
                    setFromTime("13:00");
                    setToTime("17:00");
                  }}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoCard label="Time From">
                    <input
                      type="time"
                      value={fromTime}
                      onChange={(e) => setFromTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </InfoCard>

                  <InfoCard label="Time To">
                    <input
                      type="time"
                      value={toTime}
                      onChange={(e) => setToTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    />
                  </InfoCard>
                </div>

                <InfoCard
                  label="Duration"
                  value={
                    calcDuration(shortTime(fromTime), shortTime(toTime)) || "-"
                  }
                />
              </div>
            )}

            {/* Reason */}
            <InfoCard label="Reason">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="Reason..."
              />
            </InfoCard>

            {/* Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm border bg-white hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Save
              </button>
            </div>

            {data.status !== "Pending" ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                Note: Only <b>Pending</b> requests should be edited (UI disable
                already). If opened by any reason, save may be blocked in your
                flow.
              </div>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}

/* ======================= MAIN ======================= */
export default function EmployeeLeaveManagement() {
  const EMP = useMemo(() => getEmployeeFromStorage(), []);

  const [empProfile, setEmpProfile] = useState({
    status: "",
    joinDate: "",
    employeeType: "",
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewId, setViewId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  // approvers
  const [approvers, setApprovers] = useState([]);
  const [approverError, setApproverError] = useState("");
  const [managerOverride, setManagerOverride] = useState("");

  /* CREATE */
  const [cRequestToIds, setCRequestToIds] = useState([]);
  const [cType, setCType] = useState("Casual Leave");
  const [cMode, setCMode] = useState("Full Day");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [cFromTime, setCFromTime] = useState("");
  const [cToTime, setCToTime] = useState("");
  const [cReason, setCReason] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  /* ---------------- FETCH APPROVERS ---------------- */
  const fetchApprovers = async () => {
    setApproverError("");

    const { data, error } = await supabase
      .from(APPROVER_TABLE)
      .select("id,name,role,access,active,email")
      .eq("active", true)
      .eq("access", "approver")
      .in("role", ["hr", "manager", "admin"])
      .order("role", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.warn("Approver fetch error:", error.message);
      setApprovers([]);
      setApproverError(error.message);
      return;
    }

    const seen = new Set();
    const list = (data || [])
      .map((r) => ({
        id: String(r.id),
        name: String(r.name || ""),
        role: String(r.role || ""),
        access: String(r.access || ""),
        email: String(r.email || "").toLowerCase(),
      }))
      .filter((x) => x.id && x.name)
      .filter((x) => !EXCLUDE_APPROVER_IDS.has(x.id))
      .filter((x) => {
        const key = `${x.role}:${x.name.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    setApprovers(filterApproversForEmployee(list, { ...EMP, manager: managerOverride || EMP?.manager }, managerOverride));
  };

  /* ---------------- FETCH LEAVES ---------------- */
  const fetchLeaves = async () => {
    if (!EMP?.id) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from(LEAVES_TABLE)
      .select("*")
      .eq("owner_role", "employee")
      .or(`owner_id.eq.${EMP.id},request_to_id.eq.${EMP.id}`)
      .order("applied_at", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setRows(
      (data || []).map((r) => ({
        id: r.id,
        leaveType: r.leave_type,
        mode: r.mode,
        from: r.from_date,
        to: r.to_date,
        timeFrom: shortTime(r.time_from),
        timeTo: shortTime(r.time_to),
        hours: r.hours,
        reason: r.reason,
        status: r.status,
        appliedAt: r.applied_at,

        requestToId: r.request_to_id,
        requestToName: r.request_to_name,
        requestToRole: r.request_to_role,

        ownerId: r.owner_id,
        ownerName: r.owner_name,
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [EMP?.id]);

  useEffect(() => {
    fetchApprovers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [EMP?.id, managerOverride]);

  // Auto-select reporting manager as default approver when available
  useEffect(() => {
    if (!approvers.length) return;
    if (cRequestToIds.length) return;
    const mgr = String(managerOverride || EMP?.manager || "")
      .trim()
      .toLowerCase();
    if (!mgr) return;
    const match = approvers.find((a) => {
      const email = String(a.email || "").toLowerCase();
      const id = String(a.id || "").toLowerCase();
      const name = String(a.name || "").toLowerCase();
      return email === mgr || id === mgr || name === mgr;
    });
    if (match?.id) setCRequestToIds([match.id]);
  }, [approvers, cRequestToIds.length, EMP?.manager, managerOverride]);

  // Fetch reporting manager from DB if missing locally (for employees whose manager isn't in cached profile)
  useEffect(() => {
    let active = true;
    (async () => {
      if (managerOverride) return;
      if (EMP?.manager) return;
      if (!EMP?.id) return;
      if (!isSupabaseConfigured) return;
      const { data, error } = await supabase
        .from("hrmss_employees")
        .select("reporting_manager")
        .eq("employee_id", EMP.id)
        .maybeSingle();
      if (error || !data?.reporting_manager) return;
      if (active) setManagerOverride(String(data.reporting_manager));
    })();
    return () => {
      active = false;
    };
  }, [EMP?.id, EMP?.manager, managerOverride]);

  useEffect(() => {
    if (needsTime(cMode) && cFrom) setCTo(cFrom);
  }, [cMode, cFrom]);

  // Fetch employee status/join date + auto-upgrade to Permanent after 3 months
  useEffect(() => {
    if (!EMP?.id) return;

    const cached = readProfileFromCache(EMP.id);
    if (cached.status || cached.joinDate) {
      setEmpProfile((p) => ({
        status: cached.status || p.status,
        joinDate: cached.joinDate || p.joinDate,
        employeeType: cached.employeeType || p.employeeType,
      }));
    }

    let active = true;
    (async () => {
      if (!isSupabaseConfigured) return;
      const { data, error } = await supabase
        .from("hrmss_employees")
        .select("status, join_date, employee_type")
        .eq("employee_id", EMP.id)
        .maybeSingle();
      if (error) return;

      let status = data?.status || cached.status || "";
      const joinDate = data?.join_date || cached.joinDate || cached.join_date || "";

      const shouldUpgrade =
        String(status || "").toLowerCase() === "probation" &&
        isProbationComplete(joinDate);

      if (shouldUpgrade) {
        await supabase
          .from("hrmss_employees")
          .update({ status: "Permanent" })
          .eq("employee_id", EMP.id);
        status = "Permanent";
        try {
          const key = `hrmss.profile.cache.employee.${EMP.id}`;
          const existing = safeJson(localStorage.getItem(key)) || {};
          localStorage.setItem(
            key,
            JSON.stringify({ ...existing, status: "Permanent" })
          );
        } catch {
          // ignore cache write failures
        }
      }

      if (active)
        setEmpProfile({
          status,
          joinDate,
          employeeType: data?.employee_type || cached.employeeType || "",
        });
    })();

    return () => {
      active = false;
    };
  }, [EMP?.id]);

  const effectiveStatus = useMemo(() => {
    const raw = empProfile.status || "";
    const provisional =
      String(raw).toLowerCase() === "probation" &&
        isProbationComplete(empProfile.joinDate)
        ? "Permanent"
        : raw;
    return provisional;
  }, [empProfile.joinDate, empProfile.status]);

  const isProbation = String(effectiveStatus || "").toLowerCase() === "probation";
  const isIntern = useMemo(() => {
    const raw = String(empProfile.employeeType || "").trim().toLowerCase();
    return raw.startsWith("intern");
  }, [empProfile.employeeType]);
  const allowedLeaveTypes = useMemo(() => {
    if (isIntern) return ["Casual Leave"];
    return isProbation ? probationLeaveTypes : leaveTypes;
  }, [isIntern, isProbation]);

  useEffect(() => {
    if (!allowedLeaveTypes.length) return;
    if (!allowedLeaveTypes.includes(cType)) {
      setCType(allowedLeaveTypes[0]);
    }
  }, [allowedLeaveTypes, cType]);

  /* ---------------- STATS ---------------- */
  const stats = useMemo(
    () => ({
      Pending: rows.filter((r) => r.status === "Pending").length,
      Approved: rows.filter((r) => r.status === "Approved").length,
      Rejected: rows.filter((r) => r.status === "Rejected").length,
      All: rows.length,
    }),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = [...rows];
    if (statusFilter !== "All")
      list = list.filter((r) => r.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.leaveType || "").toLowerCase().includes(q) ||
          (r.mode || "").toLowerCase().includes(q) ||
          (r.requestToName || "").toLowerCase().includes(q) ||
          (r.requestToRole || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const selectedView = rows.find((r) => r.id === viewId);
  const selectedEdit = rows.find((r) => r.id === editId);

  const approverById = useMemo(() => {
    const m = new Map();
    for (const a of approvers) m.set(a.id, a);
    return m;
  }, [approvers]);

  /* ---------------- CREATE ---------------- */
  const createLeave = async (e) => {
    e.preventDefault();

    if (!EMP?.id)
      return alert("Employee session not found. Please login again.");
    if (!cRequestToIds.length)
      return alert("Please select at least 1 Request To (approver).");
    if (!allowedLeaveTypes.includes(cType))
      return alert("This leave type is not allowed for your current status.");

    const toDateForDB = cMode === "Full Day" ? cTo : cFrom;
    if (!cFrom) return alert("From date required.");
    if (!toDateForDB) return alert("To date required.");
    if (!cReason.trim()) return alert("Reason required.");

    if (needsTime(cMode)) {
      if (!cFromTime || !cToTime) return alert("Time From/To required.");
      const dur = calcDuration(shortTime(cFromTime), shortTime(cToTime));
      if (!dur) return alert("Invalid time range.");
    }

    const nowIso = new Date().toISOString();

    const common = {
      owner_role: "employee",
      owner_id: EMP.id,
      owner_name: EMP.name,
      leave_type: cType,
      mode: cMode,
      from_date: cFrom,
      to_date: toDateForDB,
      time_from: needsTime(cMode) ? cFromTime : null,
      time_to: needsTime(cMode) ? cToTime : null,
      hours: needsTime(cMode)
        ? calcDuration(shortTime(cFromTime), shortTime(cToTime))
        : null,
      reason: cReason.trim(),
      status: "Pending",
      applied_at: nowIso,
    };

    const rowsToInsert = cRequestToIds.map((id) => {
      const a = approverById.get(id);
      return {
        ...common,
        request_to_id: a?.id ?? id,
        request_to_name: a?.name ?? null,
        request_to_role: a?.role ?? null,
      };
    });

    const { error } = await supabase.from(LEAVES_TABLE).insert(rowsToInsert);
    if (error) return alert(error.message);

    // ✅ Notify approvers via hrmss_notifications
    try {
      const notifRows = rowsToInsert.map((row) => {
        // Get the approver's info for targeting
        const approver = approverById.get(row.request_to_id);
        const targetEmail = approver?.email || "";
        const approverRole = String(approver?.role || "admin").toLowerCase();

        // Set audience based on approver's role
        let audience = "admin";
        let route = "/dashboard/leave";
        if (approverRole === "manager") {
          audience = "manager";
          route = "/manager-approver-dashboard/approvals";
        } else if (approverRole === "hr") {
          audience = "hr";
          route = "/hr-dashboard/leave";
        }

        return {
          title: "New Leave Request",
          detail: `${EMP.name} submitted a ${row.leave_type} (${row.mode}) request for ${row.from_date}${row.to_date ? ` to ${row.to_date}` : ""}.`,
          type: "info",
          source: "LeaveManagement",
          route: route,
          audience: audience,
          unread: true,
          // Note: target_email column not available in database schema
        };
      });

      await supabase.from("hrmss_notifications").insert(notifRows);
    } catch (notifErr) {
      console.warn("Notification insert failed:", notifErr?.message || notifErr);
      // Do not block the user flow on notification errors
    }


    setCreateOpen(false);
    setCRequestToIds([]);
    setCType(allowedLeaveTypes[0] || "Casual Leave");
    setCMode("Full Day");
    setCFrom("");
    setCTo("");
    setCFromTime("");
    setCToTime("");
    setCReason("");

    fetchLeaves();
  };

  /* ---------------- SAVE EDIT (from modal) ---------------- */
  const saveEditFromModal = async (payload) => {
    if (!selectedEdit?.id) return;

    const a = approverById.get(payload.requestToId);

    const updatePayload = {
      leave_type: payload.type,
      mode: payload.mode,
      from_date: payload.from,
      to_date: payload.mode === "Full Day" ? payload.to : payload.from,
      time_from: needsTime(payload.mode) ? payload.fromTime : null,
      time_to: needsTime(payload.mode) ? payload.toTime : null,
      hours: needsTime(payload.mode)
        ? calcDuration(shortTime(payload.fromTime), shortTime(payload.toTime))
        : null,
      reason: payload.reason,
      request_to_id: a?.id ?? payload.requestToId,
      request_to_name: a?.name ?? null,
      request_to_role: a?.role ?? null,
    };

    const { error } = await supabase
      .from(LEAVES_TABLE)
      .update(updatePayload)
      .eq("id", selectedEdit.id);
    if (error) return alert(error.message);

    setEditId(null);
    fetchLeaves();
  };

  /* ---------------- UI ---------------- */
  if (!EMP?.id) {
    return (
      <div className="bg-white border rounded-2xl p-6">
        <div className="text-lg font-semibold text-slate-900">
          Leave Management
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Employee session not found. Please login again (Employee Sign-In) to
          view/apply leaves.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="bg-purple-200 border border-purple-300 text-slate-800 rounded-2xl p-5">
        <div className="flex justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Leave Management</h2>
            <p className="text-sm text-slate-600">
              Full Day · Half Day · Permission
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Logged in: <span className="font-semibold">{EMP.name}</span> •{" "}
              {EMP.id}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex gap-2 items-center hover:bg-purple-700 transition"
            type="button"
          >
            <Plus size={16} /> New Leave
          </button>
        </div>

        <div className="mt-4 flex gap-2 flex-wrap text-xs">
          {Object.keys(stats).map((k) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k)}
              className={`px-3 py-1 rounded-full border ${statusFilter === k
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              type="button"
            >
              {k}: {stats[k]}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-white border rounded-xl p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leave / mode / request to..."
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left">Leave</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Request To</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Loading...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  No leave requests found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    {r.ownerId !== EMP.id && (
                      <div className="text-xs font-bold text-indigo-600 mb-0.5">
                        {r.ownerName} ({r.ownerId})
                      </div>
                    )}
                    <div className="font-semibold">{r.leaveType}</div>
                    <div className="text-xs text-slate-500">
                      {r.mode} {r.hours ? `• ${r.hours}` : ""}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Applied: {fmtDateTimeDMY(r.appliedAt)}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">
                      {toDMY(r.from)} {r.to ? `→ ${toDMY(r.to)}` : ""}
                    </div>
                    {needsTime(r.mode) && r.timeFrom && r.timeTo ? (
                      <div className="text-xs text-slate-500 mt-1">
                        Time: {r.timeFrom} → {r.timeTo}
                      </div>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-700 font-semibold">
                      {r.requestToName || "-"}
                      {r.requestToRole ? (
                        <span className="ml-2 px-2 py-0.5 border rounded-full text-[11px] font-semibold">
                          {r.requestToRole === "manager"
                            ? "Founder"
                            : r.requestToRole}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full border text-xs ${tone[r.status]
                        }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setViewId(r.id)}
                      className="p-2"
                      type="button"
                    >
                      <Eye size={16} />
                    </button>

                    <button
                      disabled={r.status !== "Pending"}
                      onClick={() => setEditId(r.id)}
                      className="p-2 disabled:opacity-40"
                      title={
                        r.status !== "Pending"
                          ? "Only Pending can be edited"
                          : "Edit"
                      }
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ VIEW MODAL */}
      <LeaveViewModal
        open={!!selectedView}
        onClose={() => setViewId(null)}
        emp={EMP}
        data={selectedView}
      />

      {/* ✅ EDIT MODAL (same size as view) */}
      <LeaveEditModal
        open={!!selectedEdit}
        onClose={() => setEditId(null)}
        emp={EMP}
        data={selectedEdit}
        approvers={approvers}
        onSave={saveEditFromModal}
        allowedTypes={allowedLeaveTypes}
      />

      {/* CREATE MODAL */}
      <ApplyModal open={createOpen} onClose={() => setCreateOpen(false)}>
        <form onSubmit={createLeave} className="space-y-4 text-sm">
          <MultiApproverSelect
            items={approvers}
            valueIds={cRequestToIds}
            setValueIds={setCRequestToIds}
            errorText={approverError}
          />

          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Leave Type
            </label>
            <select
              value={cType}
              onChange={(e) => setCType(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
            >
              {allowedLeaveTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <div className="text-[11px] text-slate-500 mt-1">
              {isProbation
                ? "You are on probation. Only Emergency Leave is available until you complete 3 months from your joining date."
                : "You can apply for all leave types."}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">Mode</label>
            <select
              value={cMode}
              onChange={(e) => {
                const next = e.target.value;
                setCMode(next);

                if (!needsTime(next)) {
                  setCFromTime("");
                  setCToTime("");
                } else {
                  if (cFrom) setCTo(cFrom);
                }
              }}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
            >
              {leaveModes.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">From</label>
              <input
                type="date"
                value={cFrom}
                onChange={(e) => {
                  const v = e.target.value;
                  setCFrom(v);
                  if (needsTime(cMode)) setCTo(v);
                }}
                required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">To</label>
              <input
                type="date"
                value={cTo}
                onChange={(e) => setCTo(e.target.value)}
                disabled={needsTime(cMode)}
                required
                className={`w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 ${needsTime(cMode) ? "bg-slate-100 cursor-not-allowed" : ""
                  }`}
              />
            </div>
          </div>

          {needsTime(cMode) && (
            <div className="space-y-2">
              <TimePreset
                onMorning={() => {
                  setCFromTime("09:00");
                  setCToTime("13:00");
                }}
                onAfternoon={() => {
                  setCFromTime("13:00");
                  setCToTime("17:00");
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Time From
                  </label>
                  <input
                    type="time"
                    value={cFromTime}
                    onChange={(e) => setCFromTime(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">
                    Time To
                  </label>
                  <input
                    type="time"
                    value={cToTime}
                    onChange={(e) => setCToTime(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-600 mb-1">Reason</label>
            <textarea
              value={cReason}
              onChange={(e) => setCReason(e.target.value)}
              rows={4}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400"
              placeholder="Write reason..."
            />
          </div>

          <div className="border-t pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 rounded-xl text-sm border bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
        </form>
      </ApplyModal>
    </div>
  );
}
