import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  CalendarDays,
  ClipboardList,
  ArrowRight,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const AUTH_KEY = "HRMSS_AUTH_SESSION";

const readAuthSession = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const normalizeKey = (value) =>
  String(value || "").trim().toLowerCase();

const buildSessionIdentifiers = (session) => {
  const keys = new Set();
  if (!session || typeof session !== "object") return keys;
  const candidates = [
    session.email,
    session.identifier,
    session.id,
    session.employee_id,
    session.admin_id,
    session.username,
    session.user_id,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeKey(candidate);
    if (normalized) keys.add(normalized);
  }
  return keys;
};

const matchesAssignedEmployee = (employee, sessionKeys) => {
  if (!sessionKeys || !sessionKeys.size) return true;
  const values = [
    employee.reportingManager,
    employee.reporting_manager,
    employee.manager,
    employee.managerEmail,
    employee.assignedTo,
  ];
  for (const value of values) {
    const normalized = normalizeKey(value);
    if (normalized && sessionKeys.has(normalized)) return true;
  }
  return false;
};

/* ===================== CONFIG ===================== */

/** ✅ Change ONLY if your table names differ */
const EMPLOYEES_TABLE = "hrmss_employees"; // <-- if your employees table name is different, change here
const LEAVES_TABLE = "hrmss_leave_requests";
const ADMIN_LEAVES_TABLE = "admin_leaves";

/* ===================== HELPERS ===================== */
const safeStr = (v) => (v == null ? "" : String(v));
const pick = (row, keys, fallback = "") => {
  for (const k of keys) {
    if (row && row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return fallback;
};

const normMode = (m) =>
  safeStr(m).toLowerCase().replace(/\s+/g, " ").trim();

const isHalfDay = (m) => normMode(m) === "half day";
const isPermission = (m) => normMode(m) === "permission";

const diffDaysInclusive = (from, to) => {
  if (!from || !to) return 1;
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const ms = b - a;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) ? Math.max(days, 1) : 1;
};


const AdminDashboard = () => {
  const navigate = useNavigate();
  const adminSession = useMemo(() => readAuthSession(), []);
  const sessionKeys = useMemo(
    () => buildSessionIdentifiers(adminSession),
    [adminSession]
  );

  /* ===================== REAL DATA STATES ===================== */
  const [employeesList, setEmployeesList] = useState([]);
  const [leaveRequestsList, setLeaveRequestsList] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState(0);

  // (optional) keep existing UI for present; you can wire later
  const [presentToday, setPresentToday] = useState(0);


  const [dataError, setDataError] = useState("");

  /* ===================== FETCH: EMPLOYEES + LEAVES ===================== */
  const fetchDashboardData = async () => {
    setDataError("");

    // 1) Employees
    const eRes = await supabase
      .from(EMPLOYEES_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (eRes.error) {
      setEmployeesList([]);
      setTotalEmployees(0);
      setDataError((p) => `${p ? p + " | " : ""}Employees: ${eRes.error.message}`);
    } else {
      const list = (eRes.data || []).map((r) => {
        const id = pick(r, ["employee_id", "emp_id", "id", "code"], "");
        const name = pick(r, ["name", "full_name", "employee_name"], "Unknown");
        const role = pick(r, ["role", "position", "designation", "job_title"], "-");
        const department = pick(r, ["department", "dept", "team"], "-");
        const reportingManager = pick(r, [
          "reporting_manager",
          "manager",
          "reportingManager",
        ]);
        const managerEmail = pick(r, ["manager_email", "reporting_manager_email"]);

        // status normalization
        const rawStatus = pick(r, ["status"], "");
        const active =
          r?.active ?? r?.is_active ?? r?.enabled ?? (rawStatus ? null : null);

        let status = "Active";
        if (rawStatus) status = safeStr(rawStatus);
        else if (active === false) status = "Inactive";

        return {
          id: safeStr(id),
          name: safeStr(name),
          role: safeStr(role),
          department: safeStr(department),
          status,
          reportingManager: safeStr(reportingManager),
          reporting_manager: safeStr(reportingManager),
          manager: safeStr(reportingManager),
          managerEmail: safeStr(managerEmail),
        };
      });

      const assigned = list.filter((emp) =>
        matchesAssignedEmployee(emp, sessionKeys)
      );
      setEmployeesList(assigned);
      setTotalEmployees(assigned.length);
    }

    // 2) Leaves (Pending) from BOTH tables
    const p1 = supabase
      .from(LEAVES_TABLE)
      .select("*")
      .eq("status", "Pending")
      .order("applied_at", { ascending: false });

    const p2 = supabase
      .from(ADMIN_LEAVES_TABLE)
      .select("*")
      .eq("status", "Pending")
      .order("applied_at", { ascending: false });

    const [l1, l2] = await Promise.all([p1, p2]);

    if (l1.error) setDataError((p) => `${p ? p + " | " : ""}Leaves: ${l1.error.message}`);
    if (l2.error) setDataError((p) => `${p ? p + " | " : ""}Admin Leaves: ${l2.error.message}`);

    const mapLeaveToStatRow = (r, source) => {
      // employee/owner id + name
      const ownerId =
        source === "admin"
          ? pick(r, ["admin_id", "owner_id", "employee_id", "emp_id", "id"], "")
          : pick(r, ["owner_id", "employee_id", "emp_id", "id"], "");

      const ownerName =
        source === "admin"
          ? pick(r, ["admin_name", "owner_name", "employee_name", "name"], "Unknown")
          : pick(r, ["owner_name", "employee_name", "name"], "Unknown");

      const ownerRole =
        source === "admin" ? "Admin" : safeStr(pick(r, ["owner_role"], "Employee"));

      const department = safeStr(pick(r, ["department", "dept"], "-"));

      return {
        reqId: safeStr(pick(r, ["req_id", "request_id", "id"], "")),
        id: safeStr(ownerId),
        name: safeStr(ownerName),
        role: ownerRole,
        department,
        status: "Pending",
      };
    };

    const mapLeaveToPendingApprovalRow = (r, source) => {
      const mode = safeStr(pick(r, ["mode"], ""));
      const from = pick(r, ["from_date", "from"], "");
      const to = pick(r, ["to_date", "to"], "") || from;

      const days =
        isHalfDay(mode) || isPermission(mode) ? 1 : diffDaysInclusive(from, to);

      const name =
        source === "admin"
          ? pick(r, ["admin_name", "owner_name", "employee_name", "name"], "Unknown")
          : pick(r, ["owner_name", "employee_name", "name"], "Unknown");

      const type = pick(r, ["leave_type", "type"], "-");

      // show "Waiting for HR/Manager" if fields exist, else Pending
      const reqToRole = safeStr(pick(r, ["request_to_role"], ""));
      const statusLabel =
        reqToRole === "hr"
          ? "Waiting for HR"
          : reqToRole === "manager"
            ? "Waiting for Manager"
            : "Pending";

      return {
        reqId: safeStr(pick(r, ["req_id", "request_id", "id"], "")),
        name: safeStr(name),
        type: safeStr(type),
        days,
        status: statusLabel,
      };
    };

    const listLeaves1 = (l1.data || []).map((r) => mapLeaveToStatRow(r, "hrmss"));
    const listLeaves2 = (l2.data || []).map((r) => mapLeaveToStatRow(r, "admin"));

    const mergedStatLeaves = [...listLeaves1, ...listLeaves2];
    setLeaveRequestsList(mergedStatLeaves);
    setPendingLeaveRequests(mergedStatLeaves.length);

    const approval1 = (l1.data || []).map((r) => mapLeaveToPendingApprovalRow(r, "hrmss"));
    const approval2 = (l2.data || []).map((r) => mapLeaveToPendingApprovalRow(r, "admin"));

    // Show top 3 in card (same UI behavior)
    const mergedApprovals = [...approval1, ...approval2]
      .sort((a, b) => safeStr(b.reqId).localeCompare(safeStr(a.reqId)))
      .slice(0, 3);

    setPendingLeaves(mergedApprovals);

  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKeys]);

  /* ===================== DERIVED (UI SAME) ===================== */
  const presentPercentage = Math.min(
    100,
    totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0
  );


  // ✅ demo present list (keep as-is). You can wire attendance later.
  const presentList = useMemo(() => [], []);

  const attendanceSummary = useMemo(
    () => [
      { label: "Present", value: presentToday, color: "bg-sky-500" },
      { label: "Absent", value: Math.max(0, totalEmployees - presentToday), color: "bg-rose-500" },
      { label: "On Leave", value: 0, color: "bg-amber-500" },
    ],
    [presentToday, totalEmployees]
  );


  const notifications = useMemo(() => [], []);

  const quickActions = [
    { label: "Approve Leaves", description: "Review pending leave requests", path: "/dashboard/leave" },
    // { label: "Generate Payroll", description: "Run monthly payroll", path: "/dashboard/payroll" },
    { label: "View Attendance", description: "Check daily attendance report", path: "/dashboard/attendance" },
  ];

  /* ✅ DYNAMIC CARD COLORS (NO GREEN) */
  const cardGradients = {
    employees:
      totalEmployees <= 5
        ? "from-slate-800 to-slate-700"
        : totalEmployees <= 20
          ? "from-slate-900 to-slate-800"
          : "from-slate-950 to-slate-900",

    present:
      presentPercentage < 50
        ? "from-blue-800 to-blue-700"
        : presentPercentage < 80
          ? "from-blue-900 to-blue-800"
          : "from-slate-900 to-blue-900",

    leave:
      pendingLeaveRequests <= 1
        ? "from-slate-700 to-slate-600"
        : pendingLeaveRequests <= 4
          ? "from-slate-800 to-slate-700"
          : "from-slate-900 to-slate-800",
  };

  const statCards = [
    {
      id: "employees",
      title: "Employees",
      value: totalEmployees,
      subtitle: "Assigned to you",
      gradient: cardGradients.employees,
      icon: Users,
    },
    {
      id: "present",
      title: "Present Today",
      value: presentToday,
      subtitle: "Attendance marked",
      gradient: cardGradients.present,
      icon: CalendarDays,
    },
    {
      id: "leave",
      title: "Pending Leave",
      value: pendingLeaveRequests,
      subtitle: "Awaiting approval",
      gradient: cardGradients.leave,
      icon: ClipboardList,
    },
  ];

  // ✅ small view modal (for ALL clicks)
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTitle, setViewTitle] = useState("");
  const [viewType, setViewType] = useState(""); // "people" | "leaves" | "notifications"
  const [viewRows, setViewRows] = useState([]);

  const openView = (title, type, rows) => {
    setViewTitle(title);
    setViewType(type);
    setViewRows(rows);
    setViewOpen(true);
  };

  const onStatClick = (cardId) => {
    if (cardId === "employees")
      return openView(`Employees (${totalEmployees})`, "people", employeesList);

    if (cardId === "present")
      return openView(`Present Today (${presentToday})`, "people", presentList);

    if (cardId === "leave")
      return openView(`Pending Leave (${pendingLeaveRequests})`, "leaves", leaveRequestsList);
  };

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <header className="mb-6">
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-sky-600 to-violet-600 p-5 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">
                Admin Dashboard
              </h1>
              {dataError ? (
                <p className="text-xs text-white/80 mt-1">
                  Data issue: {dataError}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={fetchDashboardData}
              className="self-start sm:self-auto rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* stat cards click -> modal */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-6">
        {statCards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onStatClick(card.id)}
            className={`text-left rounded-xl bg-gradient-to-r ${card.gradient} text-white p-3 shadow-md hover:-translate-y-1 hover:shadow-lg transition`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/80">
                  {card.subtitle}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold">{card.value}</span>
                  <span className="text-xs text-white/80">{card.title}</span>
                </div>
              </div>
              {card.icon ? <card.icon size={18} /> : null}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Attendance */}
          <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-100">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Monthly Attendance Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Overview of employee attendance for the current month.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                Present {presentPercentage}%
              </span>
            </div>

            <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-sky-500 transition-all"
                style={{ width: `${presentPercentage}%` }}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              {attendanceSummary.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl bg-gradient-to-r from-white to-slate-50 px-3 py-2 ring-1 ring-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                    <span className="text-slate-600">{item.label}</span>
                  </div>
                  <span className="font-semibold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Leaves */}
          <div
            className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-100 cursor-pointer"
            onClick={() => openView("Pending Leave Approvals", "leaves", pendingLeaves)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && openView("Pending Leave Approvals", "leaves", pendingLeaves)}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Pending Leave Approvals
              </h2>
              <button
                type="button"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                onClick={(e) => {
                  e.stopPropagation();
                  openView("Pending Leave Approvals", "leaves", pendingLeaves);
                }}
              >
                View all
              </button>
            </div>

            <div className="space-y-2 text-sm">
              {pendingLeaves.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-3 py-4 ring-1 ring-slate-100 text-xs text-slate-500">
                  No pending leaves found.
                </div>
              ) : (
                pendingLeaves.map((leave) => (
                  <button
                    key={leave.reqId}
                    type="button"
                    className="w-full text-left flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100 hover:bg-indigo-50 hover:ring-indigo-200 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      openView(`Leave Request • ${leave.reqId}`, "leaves", [leave]);
                    }}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{leave.name}</p>
                      <p className="text-xs text-slate-500">
                        {leave.type} - {leave.days} day(s)
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">
                      {leave.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">

          {/* Quick Actions */}
          <div className="rounded-2xl bg-white p-4 shadow-md ring-1 ring-slate-100">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              Quick Actions
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-indigo-500 hover:bg-indigo-50 transition"
                  onClick={() => navigate(action.path)}
                >
                  <span className="mb-1 flex items-center justify-between text-sm font-semibold text-slate-900">
                    {action.label}
                    <ArrowRight size={14} className="text-slate-400" />
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ✅ MODAL */}
      {viewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setViewOpen(false)}
            aria-label="Close"
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-900">{viewTitle}</h3>
              <button
                type="button"
                onClick={() => setViewOpen(false)}
                className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 max-h-[70vh] overflow-auto space-y-2">
              {viewType === "people" &&
                viewRows.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                  >
                    <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      ID: <span className="font-medium text-slate-700">{p.id}</span> •{" "}
                      {p.role} • {p.department}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">{p.status}</p>
                  </div>
                ))}

              {viewType === "leaves" &&
                viewRows.map((l, idx) => (
                  <div
                    key={l.reqId || idx}
                    className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {l.name || "-"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {l.reqId ? `Req: ${l.reqId} • ` : ""}
                          {l.type ? `${l.type} • ` : ""}
                          {typeof l.days === "number" ? `${l.days} day(s)` : ""}
                          {l.id ? ` • Emp: ${l.id}` : ""}
                          {l.role ? ` • ${l.role}` : ""}
                          {l.department ? ` • ${l.department}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                        {l.status || "Pending"}
                      </span>
                    </div>
                  </div>
                ))}

              {viewType === "notifications" &&
                viewRows.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">{n.type}</span>
                      <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                        <Clock3 size={12} /> {n.time}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{n.text}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminDashboard;
