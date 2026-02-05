// src/pages/managerApprover/ManagerApproverDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,

  Eye,
  Lock,
  Users,
  ArrowLeft,
  X,
  UserRound,
  FileText,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";
import { getManagerSession } from "./managerApproverData";

/* ===================== CONFIG ===================== */

const EMP_TABLE = "hrmss_employees"; // ✅ your real table
const LEAVE_TABLE = "hrmss_leave_requests"; // change if different
const APPROVERS_TABLE = "hrmss_approvers";

/* ===================== small UI blocks ===================== */
const toneMap = {
  indigo: "bg-indigo-50 text-indigo-700",
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  slate: "bg-slate-100 text-slate-700",
};

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "indigo", onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border p-4 bg-white shadow-sm flex gap-3 text-left hover:shadow-md hover:ring-2 hover:ring-indigo-100 transition"
    >

      <div
        className={`h-12 w-12 rounded-xl flex items-center justify-center ${toneMap[tone]}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      </div>
    </button>
  );
}

function ViewHeader({ title, subtitle, onBack, right }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2>

          {subtitle ? (
            <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">

      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
      />
      <div className="absolute left-1/2 top-1/2 w-[min(620px,88vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-xl border">
        <div className="p-4 border-b flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Details
            </p>
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl border bg-white hover:bg-slate-50 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function LoadingPanel({ label = "Loading..." }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm flex items-center gap-3">
      <Loader2 className="animate-spin" size={18} />
      <p className="text-sm text-slate-700">{label}</p>
    </div>
  );
}

function ErrorPanel({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{title}</p>

          <p className="text-sm text-slate-600 mt-1 break-words">
            {message || "Unknown error"}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              <RefreshCw size={16} /> Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ===================== Helpers ===================== */
const safeText = (v) => (v == null ? "" : String(v));
const safeObj = (v) => (v && typeof v === "object" ? v : {});
const isDmy = (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);
const formatDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (isDmy(raw)) return raw;
  const formatted = formatDDMMYYYY(raw);
  return formatted === "-" ? raw : formatted;
};
const toDateOnly = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};
const isSameDay = (a, b) => {
  const dayA = toDateOnly(a);
  const dayB = toDateOnly(b);
  if (!dayA || !dayB) return false;
  return dayA === dayB;
};
const isApprovedStatus = (status) => /approved/i.test(String(status || ""));
const isPendingStatus = (status) =>
  /pending|requested/i.test(String(status || ""));
const shouldShowOnLeave = (leave) => {
  if (!leave) return false;
  if (isApprovedStatus(leave.status)) return !!leave.isToday;
  if (isPendingStatus(leave.status)) return !!leave.appliedToday;
  return false;
};
const getLeaveBadge = (status) => {
  const text = status ? String(status) : "Pending";
  const approved = isApprovedStatus(text);
  return {
    text,
    className: approved
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200",
  };
};
const formatRange = (from, to) => {
  if (!from && !to) return "-";
  if (!to || to === from) return formatDate(from);
  return `${formatDate(from)} → ${formatDate(to)}`;
};

function normalizeEmployeeFromProfileRow(row) {
  // ✅ ONLY columns that your screenshot shows / most likely exist
  return {
    id: safeText(row.employee_id),
    name: safeText(row.full_name),

    roleRaw: safeText(row.role || ""),
    avatar: safeText(row.avatar || ""),

    personal: {
      dob: safeText(row.dob || row.joining_date),
      gender: safeText(row.gender),
      maritalStatus: "",
      bloodGroup: "",
      personalEmail: "",
      officialEmail: safeText(row.email),
      mobileNumber: safeText(row.phone),
      alternateContactNumber: "",
      currentAddress: "",
      permanentAddress: "",
    },

    // ✅ job fields are NOT requested now (avoid missing columns crash)
    job: {
      employeeId: safeText(row.employee_id),

      title: safeText(row.role || "-"),
      department: safeText(row.department || "-"),
      manager: safeText(row.reporting_manager || "-"),
      joiningDate: safeText(row.join_date || row.joining_date || "-"),
      workMode: safeText(row.work_mode || "-"),
      location: safeText(row.location || "-"),
    },
  };
}

function normalizeLeave(row) {
  const from = safeText(row.from_date);
  const to = safeText(row.to_date || row.from_date);
  const dates = formatRange(from, to);
  const todayStr = new Date().toISOString().slice(0, 10);
  const appliedAt = row.applied_at || row.created_at;
  const appliedToday = isSameDay(appliedAt, todayStr);
  const isToday =
    from &&
    to &&
    todayStr >= safeText(from).slice(0, 10) &&
    todayStr <= safeText(to).slice(0, 10);

  return {
    id: safeText(row.id),

    employeeId: safeText(row.owner_id),
    employee: safeText(row.owner_name || row.employee || ""),
    type: safeText(row.leave_type || ""),
    dates,
    reason: safeText(row.reason || ""),
    handover: "",
    status: safeText(row.status || "Pending"),
    created_at: appliedAt,
    isToday,
    appliedToday,
  };
}

/* ===================== main ===================== */
export default function ManagerDashboard() {
  const session = getManagerSession();

  const access = session.access || session.role;
  const approver = access === "approver";
  const teamLabel = (session.team || "")
    .replace(/\s*[-—]?\s*squad\s*$/i, "")
    .trim();

  const [view, setView] = useState("dashboard");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeCategory, setEmployeeCategory] = useState("all");

  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [todayOnLeave, setTodayOnLeave] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modal, setModal] = useState({ open: false, title: "", payload: null });

  const openModal = (title, payload) =>
    setModal({ open: true, title, payload });
  const closeModal = () => setModal({ open: false, title: "", payload: null });

  const fetchAll = async () => {
    setLoading(true);
    setErr("");

    try {
      // ✅ Employees: ONLY safe columns (no designation)
      const { data: empRows, error: empErr } = await supabase
        .from(EMP_TABLE)
        .select(
          `
          employee_id,
          full_name,

          role,
          department,
          reporting_manager,
          location,
          email,
          phone,
          avatar,
          join_date,
          employee_type,
          status
        `
        )
        .order("full_name", { ascending: true });

      if (empErr) throw new Error(`Employees load failed: ${empErr.message}`);

      // ✅ Also fetch detailed employee profiles with personal info
      const { data: profileRows, error: profileErr } = await supabase
        .from("hrmss_employee_profiles")
        .select(
          `
          employee_id,
          full_name,
          dob,
          gender,
          marital_status,
          blood_group,
          personal_email,
          official_email,
          mobile_number,
          alternate_contact_number,
          current_address,
          permanent_address,

          location
        `
        )
        .order("full_name", { ascending: true });


      // Create a map of profiles by employee_id for quick lookup
      const profileMap = {};
      if (profileRows && !profileErr) {
        profileRows.forEach((p) => {
          profileMap[p.employee_id] = p;
        });
      }

      // Merge employee and profile data
      const baseEmployees = (empRows || []).map((emp) => {
        const profile = profileMap[emp.employee_id] || {};
        return {
          id: safeText(emp.employee_id),
          name: safeText(emp.full_name),
          roleRaw: safeText(emp.role || ""),
          avatar: safeText(emp.avatar || ""),

          personal: {
            dob: safeText(profile.dob || emp.dob || ""),
            gender: safeText(profile.gender || ""),
            maritalStatus: safeText(profile.marital_status || ""),
            bloodGroup: safeText(profile.blood_group || ""),
            personalEmail: safeText(profile.personal_email || ""),
            officialEmail: safeText(profile.official_email || emp.email || ""),
            mobileNumber: safeText(profile.mobile_number || emp.phone || ""),
            alternateContactNumber: safeText(
              profile.alternate_contact_number || ""
            ),
            currentAddress: safeText(profile.current_address || ""),
            permanentAddress: safeText(profile.permanent_address || ""),
          },

          job: {
            employeeId: safeText(emp.employee_id),
            title: safeText(emp.role || "-"),
            department: safeText(emp.department || "-"),
            manager: safeText(emp.reporting_manager || "-"),
            joiningDate: safeText(emp.join_date || profile.joining_date || "-"),
            workMode: safeText(emp.work_mode || "-"),
            location: safeText(emp.location || profile.location || "-"),
          },
        };
      });

      let allEmployees = [...baseEmployees];

      // ✅ Also fetch HR users from hrmss_profiles
      const { data: hrRows, error: hrErr } = await supabase
        .from("hrmss_profiles")
        .select(
          `
          user_id,
          full_name,
          role,
          department,
          email,
          phone,
          location,
          employee_id,
          dob,
          gender,
          marital_status,
          blood_group,
          personal_email,
          official_email,
          mobile_number,
          alternate_contact_number,
          current_address,
          permanent_address
        `
        )
        .eq("role", "hr")
        .order("full_name", { ascending: true });

      if (hrErr) {
        console.warn("HR load warning:", hrErr.message);
      } else {
        // Transform HR users to match employee format
        const hrEmployees = (hrRows || []).map((hr) => ({
          id: hr.user_id || hr.employee_id || hr.email,
          name: hr.full_name || "-",
          roleRaw: "HR",
          avatar: "",
          personal: {
            dob: safeText(hr.dob || ""),
            gender: safeText(hr.gender || ""),
            maritalStatus: safeText(hr.marital_status || ""),
            bloodGroup: safeText(hr.blood_group || ""),
            personalEmail: safeText(hr.personal_email || ""),
            officialEmail: safeText(hr.official_email || hr.email || ""),
            mobileNumber: safeText(hr.mobile_number || hr.phone || ""),
            alternateContactNumber: safeText(hr.alternate_contact_number || ""),
            currentAddress: safeText(hr.current_address || ""),
            permanentAddress: safeText(hr.permanent_address || ""),
          },
          job: {
            employeeId: hr.employee_id || hr.user_id || "",
            title: hr.role || "HR",
            department: hr.department || "-",
            manager: "-",
            joiningDate: "-",
            workMode: "-",
            location: hr.location || "-",
          },
        }));

        allEmployees = [...allEmployees, ...hrEmployees];
      }

      // ✅ Approvers table (manager / hr / admin / admin-head)
      try {
        const { data: approverRows, error: approverErr } = await supabase
          .from("hrmss_approvers")
          .select("id, name, role, team, email, access, active");

        if (!approverErr && approverRows?.length) {
          const roleLabel = (r) => {
            if (r === "admin-head") return "Admin Head";
            if (r === "admin") return "Admin";
            if (r === "manager") return "Founder";
            if (r === "hr") return "HR";
            return r || "-";
          };

          const approverEmployees = (approverRows || [])
            .filter((r) => r?.id && r?.name)
            .map((r) => ({
              id: safeText(r.id),
              name: safeText(r.name),
              roleRaw: safeText(r.role || ""),
              avatar: "",
              personal: {
                dob: "",
                gender: "",
                maritalStatus: "",
                bloodGroup: "",
                personalEmail: "",
                officialEmail: safeText(r.email || ""),
                mobileNumber: "",
                alternateContactNumber: "",
                currentAddress: "",
                permanentAddress: "",
              },
              job: {
                employeeId: safeText(r.id),
                title: roleLabel(r.role),
                department: safeText(r.team || "-"),
                manager: "-",
                joiningDate: "-",
                workMode: safeText(r.access || "-"),
                location: "-",
              },
            }));

          const mergedMap = new Map();
          for (const e of [...allEmployees, ...approverEmployees]) {
            if (!e?.id) continue;
            if (mergedMap.has(e.id)) continue;
            mergedMap.set(e.id, e);
          }
          allEmployees = Array.from(mergedMap.values());
        }
      } catch (mergeErr) {
        console.warn("Approver load warning:", mergeErr?.message || mergeErr);
      }

      setEmployees(allEmployees);

      // ✅ Leaves (optional tables)
      const { data: leaveRows, error: leaveErr } = await supabase
        .from(LEAVE_TABLE)
        .select(
          "id, owner_id, owner_name, leave_type, mode, from_date, to_date, reason, status, applied_at"
        )
        .order("applied_at", { ascending: false });

      if (leaveErr) {
        // not fatal: keep leave empty but show dashboard
        setLeaveRequests([]);
        setTodayOnLeave(0);
      } else {
        const normalizedLeaves = (leaveRows || []).map(normalizeLeave);
        setLeaveRequests(normalizedLeaves);
      }

    } catch (e) {
      setErr(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filteredEmployees = useMemo(() => {
    // Show all employees (removed the role filter)
    return employees;
  }, [employees]);

  // IDs to exclude from the dashboard
  const EXCLUDED_IDS = ["HR-PRIYA", "MGR-SUNIL", "EMP-023", "bcfc2301-7855-488e-a3b5-75a899836cf7"];

  const roleCounts = useMemo(() => {
    const counts = { employee: 0, manager: 0, hr: 0 };
    const detect = (e) => {
      const roleText = `${e.roleRaw || ""} ${safeObj(e.job).title || ""}`.toLowerCase();
      if (roleText.includes("manager")) return "manager";
      if (roleText.includes("hr")) return "hr";
      // admins fall under employees for this view
      return "employee";
    };
    filteredEmployees.forEach((e) => {
      // Skip excluded IDs
      if (EXCLUDED_IDS.includes(e.id)) return;
      const k = detect(e);
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }, [filteredEmployees]);

  const teamMembers = useMemo(() => {
    return filteredEmployees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.job?.title || "-",
      status: "Available",
      location: e.job?.location || "-",
      leaveType: "",
      leaveDates: "",
    }));

  }, [filteredEmployees]);



  const employeesList = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    return filteredEmployees.filter((emp) => {
      // Exclude specific IDs
      if (EXCLUDED_IDS.includes(emp.id)) return false;
      // category filter
      const roleTextFull = `${emp.roleRaw || ""} ${safeObj(emp.job).title || ""}`.toLowerCase();
      if (employeeCategory === "manager" && !roleTextFull.includes("manager")) return false;
      if (employeeCategory === "hr" && !roleTextFull.match(/hr/)) return false;
      if (employeeCategory === "employee") {
        if (roleTextFull.includes("manager") || roleTextFull.includes("hr")) return false;
      }
      if (!q) return true;
      const job = safeObj(emp.job);
      const text = `${emp.name} ${emp.id} ${job.department || ""} ${job.title || ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [employeeQuery, filteredEmployees, employeeCategory]);

  // derive today's on-leave count whenever leave requests update
  useEffect(() => {
    const todayCount = leaveRequests.filter(shouldShowOnLeave).length;
    setTodayOnLeave(todayCount);
  }, [leaveRequests]);

  const openProfile = (emp) => {
    openModal(emp.name || "Employee", {
      kind: "profile",
      profile: emp,
      role: emp.job?.title || "-",
    });
  };

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0">

            <p className="text-sm text-slate-600">
              Welcome back, {session.name}
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Founder Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2 text-sm">{null}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Employees"
          value={roleCounts.employee}
          onClick={() => {
            setEmployeeCategory("employee");
            setView("employees");
          }}
        />
        <StatCard
          icon={Lock}
          label="HR"
          value={roleCounts.hr}
          onClick={() => {
            setEmployeeCategory("hr");
            setView("employees");
          }}
          tone="emerald"
        />
        <StatCard
          icon={CalendarClock}
          label="On Leave"
          value={todayOnLeave}
          tone="amber"
          onClick={() => setView("leave")}
        />
      </div>
    </div>
  );

  const EmployeesView = () => (
    <div className="space-y-4">
      <ViewHeader
        title="Company Employees"
        subtitle="Click an employee to view profile details."
        onBack={() => setView("dashboard")}
        right={
          <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            {employeesList.length} records ({employeeCategory === "all" ? "All" : employeeCategory})
          </span>
        }
      />

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-slate-400" />
          <input
            value={employeeQuery}
            onChange={(e) => setEmployeeQuery(e.target.value)}
            placeholder="Search by name, ID..."
            className="w-full text-sm outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {employeesList.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => openProfile(m)}
            className="rounded-2xl border bg-white p-4 shadow-sm text-left hover:shadow-md hover:ring-2 hover:ring-slate-100 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-slate-500" />
                  <p className="font-bold text-slate-900 truncate">{m.name}</p>
                </div>

                <p className="text-xs text-slate-500 mt-1 truncate">
                  ID: {m.id}
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                Active
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const LeaveView = () => {
    // Deduplicate leave requests by ID to prevent showing the same leave twice
    const seenIds = new Set();
    const todayList = leaveRequests.filter((leave) => {
      if (!shouldShowOnLeave(leave)) return false;
      if (seenIds.has(leave.id)) return false;
      seenIds.add(leave.id);
      return true;
    });

    return (
      <div className="space-y-4">
        <ViewHeader
          title="Leave Board"
          subtitle="Live view from hrmss_leave_requests"
          onBack={() => setView("dashboard")}
          right={
            <span className="inline-flex items-center gap-2 text-xs font-semibold bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-200">
              On Leave Today: {todayList.length}
            </span>
          }
        />

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <p className="text-xs font-semibold text-slate-600">
            On Leave Today ({todayList.length})
          </p>
          {todayList.length === 0 ? (
            <div className="text-sm text-slate-500">No leave updates today.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {todayList.map((l) => {
                const badge = getLeaveBadge(l.status);
                return (
                  <div
                    key={l.id}
                    className="rounded-xl border p-3 bg-slate-50 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {l.employee || l.employeeId || "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {l.type || "-"} • {l.dates || "-"}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {l.reason || "-"}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Go to Leave Management Button */}
        <div className="flex justify-end">
          <Link
            to="/manager-approver-dashboard/approvals"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            <FileText size={16} />
            Go to Leave Management
          </Link>
        </div>
      </div>
    );
  };

  const ModalBody = () => {
    const payload = modal.payload;
    if (!payload) return null;

    if (payload.kind === "profile") {
      const profile = payload.profile || {};
      const personal = safeObj(profile.personal);

      return (
        <div className="space-y-3">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Employee</p>

            <p className="text-lg font-bold text-slate-900">
              {profile.name || "-"}
            </p>
            <p className="text-sm text-slate-600">
              Employee ID: {profile.id || "-"}
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <p className="text-xs text-slate-500 mb-3">Personal Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <DetailItem label="DOB" value={formatDate(personal.dob)} />
              <DetailItem label="Gender" value={personal.gender} />

              <DetailItem
                label="Marital Status"
                value={personal.maritalStatus}
              />
              <DetailItem label="Blood Group" value={personal.bloodGroup} />
              <DetailItem
                label="Personal Email"
                value={personal.personalEmail}
              />
              <DetailItem
                label="Official Email"
                value={personal.officialEmail}
              />
              <DetailItem label="Mobile Number" value={personal.mobileNumber} />
              <DetailItem
                label="Alternate Number"
                value={personal.alternateContactNumber}
              />
              <DetailItem
                label="Current Address"
                value={personal.currentAddress}
              />
              <DetailItem
                label="Permanent Address"
                value={personal.permanentAddress}
              />
            </div>
          </div>
        </div>
      );
    }

    return <div className="text-sm text-slate-600">No details available.</div>;
  };


  if (loading)
    return (
      <LoadingPanel label="Loading manager dashboard data from Supabase..." />
    );
  if (err)
    return (
      <ErrorPanel
        title="Failed to load true data"
        message={err}
        onRetry={fetchAll}
      />
    );

  return (
    <div className="space-y-6">
      {view === "dashboard" && <DashboardView />}
      {view === "employees" && <EmployeesView />}
      {view === "leave" && <LeaveView />}

      <Modal open={modal.open} title={modal.title} onClose={closeModal}>
        <ModalBody />
      </Modal>
    </div>
  );
}
