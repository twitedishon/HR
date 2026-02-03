import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

import { supabase } from "../../lib/supabaseClient";
import {
  Badge,
  SectionCard,
  PrimaryButton,
  GhostButton,
  Modal,
} from "../employee/shared/ui.jsx";
import { formatDDMMYYYY } from "../../lib/dateUtils";

const toneChip = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  Cancelled: "neutral",
};

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const EMPLOYEES_TABLE = "hrmss_employees";
const LEAVES_TABLE = "hrmss_leave_requests";
const ADMIN_LEAVES_TABLE = "admin_leaves";

// Leave type configurations
const HALF_DAY_TYPES = new Set([
  "casual leave (morning)",
  "casual leave (evening)",
  "sick leave (morning)",
  "sick leave (evening)",
  "permissions",
]);

const GROUPED_LEAVE_TYPES = {
  "casual leave (morning)": "casual leave",
  "casual leave (evening)": "casual leave",
  "sick leave (morning)": "sick leave",
  "sick leave (evening)": "sick leave",
};

const baseAbsenceGroups = [
  {
    id: "casual",
    title: "Casual Leave",
    items: [{ type: "Casual Leave", total: 12 }],
  },
  {
    id: "sick",
    title: "Sick Leave",
    items: [{ type: "Sick Leave", total: 12 }],
  },
  {
    id: "other",
    title: "Other Absence Types",
    items: [
      { type: "Maternity/Paternity", total: 12 },
      { type: "Paid Leave", total: 12 },
      { type: "Work from home", total: 12 },
      { type: "Holidays", total: 12 },
      { type: "Permissions", total: 6 },
      { type: "Special Leave", total: 12 },
      { type: "Bereavement Leave", total: 12 },
    ],
  },
];

function normalizeLeaveType(raw) {
  return String(raw || "").trim();
}

function formatLeaveTotal(value) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

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

function fmtDate(d) {
  return formatDDMMYYYY(d);
}

const fmtOrDash = (value) => (value ? String(value) : "-");

// Convert date range "2024-02-26 - 2026-01-29" to "X years Y months" format
const formatExperienceDuration = (value) => {
  if (!value) return "-";
  const str = String(value).trim();

  // Check if it's already in "X years" or "X months" format
  if (str.toLowerCase().includes("year") || str.toLowerCase().includes("month")) {
    return str;
  }

  // Parse date range format: "YYYY-MM-DD - YYYY-MM-DD" or "YYYY-MM-DD - Present"
  const parts = str.split(" - ");
  if (parts.length !== 2) return str;

  const fromDate = new Date(parts[0].trim());
  let toDate;

  if (parts[1].trim().toLowerCase() === "present") {
    toDate = new Date();
  } else {
    toDate = new Date(parts[1].trim());
  }

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return str;
  }

  // Calculate difference in months
  let months = (toDate.getFullYear() - fromDate.getFullYear()) * 12;
  months += toDate.getMonth() - fromDate.getMonth();

  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0 && remainingMonths === 0) {
    return "Less than 1 month";
  }

  const yearText = years > 0 ? `${years} year${years > 1 ? "s" : ""}` : "";
  const monthText = remainingMonths > 0 ? `${remainingMonths} month${remainingMonths > 1 ? "s" : ""}` : "";

  return [yearText, monthText].filter(Boolean).join(" ");
};

const ADMIN_EMPLOYEE_ID = "EMP-029"; // Hari Priya's employee ID

const ApproverEmployeeDashboard = () => {
  const navigate = useNavigate();
  const adminSession = useMemo(() => readAuthSession(), []);
  const sessionKeys = useMemo(
    () => buildSessionIdentifiers(adminSession),
    [adminSession]
  );

  const [employeesList, setEmployeesList] = useState([]);
  const [leaveRequestsList, setLeaveRequestsList] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);

  const [totalEmployees, setTotalEmployees] = useState(0);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState(0);
  const [presentToday, setPresentToday] = useState(0);

  const [dataError, setDataError] = useState("");
  const [loading, setLoading] = useState(true);

  // Admin profile data fetched from database
  const [adminProfile, setAdminProfile] = useState({
    name: "",
    id: ADMIN_EMPLOYEE_ID,
    role: "",
    dept: "",
    reportingManager: "",
    joiningDate: "",
    workMode: "",
    totalExperience: "",
    relevantExperience: "",
  });

  // Admin's own leave requests to calculate leave balance
  const [adminLeaveRequests, setAdminLeaveRequests] = useState([]);
  const [selectedAbsenceGroup, setSelectedAbsenceGroup] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setDataError("");

    // Fetch Hari Priya's profile from database (hrmss_employees)
    const profileRes = await supabase
      .from(EMPLOYEES_TABLE)
      .select("*")
      .eq("employee_id", ADMIN_EMPLOYEE_ID)
      .maybeSingle();

    // Also fetch from hrmss_employee_profiles for experience fields
    const expProfileRes = await supabase
      .from("hrmss_employee_profiles")
      .select("employee_id, total_experience, relevant_experience")
      .eq("employee_id", ADMIN_EMPLOYEE_ID)
      .maybeSingle();

    const empData = profileRes.data || {};
    const expData = expProfileRes.data || {};
    console.log("[Dashboard] Employee data:", empData);
    console.log("[Dashboard] Profile data:", expData);

    if (profileRes.data || expProfileRes.data) {
      const p = empData;
      setAdminProfile({
        name: p.full_name || p.name || "Hari Priya",
        id: p.employee_id || ADMIN_EMPLOYEE_ID,
        // In hrmss_employees: department = Designation, role = Team
        role: p.department || p.designation || "Admin",
        dept: p.role || p.team || "",
        reportingManager: p.reporting_manager || "",
        joiningDate: p.join_date || "",
        workMode: p.location || "",
        // Fetch experience from hrmss_employee_profiles
        totalExperience: expData.total_experience || p.total_experience || "",
        relevantExperience: expData.relevant_experience || p.relevant_experience || "",
      });
    } else {
      console.log("[Dashboard] No employee profile found for:", ADMIN_EMPLOYEE_ID);
    }

    // Fetch admin's own leave requests to calculate leave balance
    // Try fetching by employee_id and also by admin_id, and by name
    const adminLeavesRes = await supabase
      .from(ADMIN_LEAVES_TABLE)
      .select("id, leave_type, from_date, to_date, status, reason, applied_at, admin_id, admin_name")
      .order("applied_at", { ascending: false });

    if (adminLeavesRes.data) {
      // Filter to only show Hari Priya's leaves (match by ID or name)
      const hariPriyaLeaves = (adminLeavesRes.data || []).filter((row) => {
        const adminId = String(row.admin_id || "").toLowerCase();
        const adminName = String(row.admin_name || "").toLowerCase();
        // Match by EMP-029 or by name containing "hari" or "priya"
        return (
          adminId === "emp-029" ||
          adminId === "adm-029" ||
          adminName.includes("hari") ||
          adminName.includes("priya")
        );
      });

      const mapped = hariPriyaLeaves.map((row) => {
        const from = row.from_date ? String(row.from_date) : "";
        const to = row.to_date ? String(row.to_date) : from;
        return {
          id: row.id,
          type: row.leave_type || "-",
          from,
          to,
          days: diffDaysInclusive(from, to),
          status: row.status || "Pending",
          reason: row.reason || "-",
        };
      });
      setAdminLeaveRequests(mapped);
    }

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
        from,
        to,
        status: statusLabel,
        reason: pick(r, ["reason"], "-"),
      };
    };

    const listLeaves1 = (l1.data || []).map((r) => mapLeaveToStatRow(r, "hrmss"));
    const listLeaves2 = (l2.data || []).map((r) => mapLeaveToStatRow(r, "admin"));

    const mergedStatLeaves = [...listLeaves1, ...listLeaves2];
    setLeaveRequestsList(mergedStatLeaves);
    setPendingLeaveRequests(mergedStatLeaves.length);

    const approval1 = (l1.data || []).map((r) => mapLeaveToPendingApprovalRow(r, "hrmss"));
    const approval2 = (l2.data || []).map((r) => mapLeaveToPendingApprovalRow(r, "admin"));

    const mergedApprovals = [...approval1, ...approval2]
      .sort((a, b) => safeStr(b.reqId).localeCompare(safeStr(a.reqId)));

    setPendingLeaves(mergedApprovals);
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKeys]);

  const recentLeaves = useMemo(
    () => (pendingLeaves || []).slice(0, 4),
    [pendingLeaves]
  );

  const [selectedLeave, setSelectedLeave] = useState(null);
  const [viewAllLeaves, setViewAllLeaves] = useState(false);

  const openApproveLeaves = () => {
    navigate("/dashboard/leave");
  };

  // Calculate leave balance for admin
  const absenceGroups = useMemo(() => {
    const usageByType = {};

    adminLeaveRequests.forEach((req) => {
      const status = String(req.status || "").toLowerCase();
      if (status === "cancelled" || status === "rejected") return;

      const normalized = normalizeLeaveType(req.type || "");
      const key = normalized.toLowerCase();
      if (!key) return;

      const groupedKey = GROUPED_LEAVE_TYPES[key] || key;
      const unit = HALF_DAY_TYPES.has(key) ? 0.5 : 1;
      const days = Number(req.days || 0);
      if (!Number.isFinite(days)) return;

      usageByType[groupedKey] = (usageByType[groupedKey] || 0) + days * unit;
    });

    return baseAbsenceGroups.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const key = item.type.toLowerCase();
        const used = usageByType[key] || 0;
        const remaining = Math.max(0, item.total - used);
        return {
          ...item,
          remaining,
        };
      }),
    }));
  }, [adminLeaveRequests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {adminProfile.name ? `${adminProfile.name}'s Dashboard` : "Admin Dashboard"}
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {adminProfile.name || "-"} • {adminProfile.id || "-"} •{" "}
            {adminProfile.role || "-"} • {adminProfile.dept || "-"}
          </p>

          {dataError ? (
            <p className="mt-1 text-xs text-amber-700">
              <AlertTriangle className="inline -mt-0.5 mr-1" size={14} />
              {dataError}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              <CheckCircle2 className="inline -mt-0.5 mr-1" size={14} />
              Welcome
            </p>
          )}

          {loading && (
            <p className="mt-2 text-xs text-slate-500">Loading dashboard data...</p>
          )}
        </div>


      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Leave Details */}
        <SectionCard
          title="Leave Details"
          subtitle="Absence types + remaining balance"
          action={<Badge tone="info">Leave</Badge>}
        >
          {/* Absence type cards */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {absenceGroups.map((group) => {
              // Assign different light colors based on group id
              const colorClasses = {
                casual: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
                sick: "bg-blue-50 border-blue-200 hover:bg-blue-100",
                other: "bg-amber-50 border-amber-200 hover:bg-amber-100",
              };
              const cardClass = colorClasses[group.id] || "bg-slate-50 border-slate-200 hover:bg-white";

              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedAbsenceGroup(group)}
                  className={`rounded-2xl border px-4 py-6 text-center transition hover:shadow-sm ${cardClass}`}
                >
                  <div className="text-base font-extrabold text-slate-900">
                    {group.title}
                  </div>
                  {group.items.length === 1 ? (
                    <div className="mt-2 text-3xl font-extrabold text-slate-900">
                      {formatLeaveTotal(group.items[0].remaining)}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Recent Requests - Admin's own leave requests */}
        <SectionCard
          title="Leave Details"
          subtitle="Your recent leave requests"
          action={<Badge tone="info">Leave</Badge>}
        >
          {/* Recent requests */}
          <div className="rounded-2xl border overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">
              Recent Requests
            </div>
            <div className="divide-y">
              {adminLeaveRequests.slice(0, 4).length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No leave requests yet.
                </div>
              ) : (
                adminLeaveRequests.slice(0, 4).map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">
                        {r.type}{" "}
                        <span className="text-slate-400 font-semibold">
                          ({r.days} day{r.days > 1 ? "s" : ""})
                        </span>
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {fmtDate(r.from)} → {fmtDate(r.to)} • {r.id}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {r.reason}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Badge tone={toneChip[r.status] || "neutral"}>
                        {r.status}
                      </Badge>

                      {r.status === "Pending" ? (
                        <button
                          className="text-xs font-bold text-rose-600 hover:underline"
                          onClick={async (event) => {
                            event.stopPropagation();
                            // Cancel leave request
                            const { error } = await supabase
                              .from(ADMIN_LEAVES_TABLE)
                              .update({ status: "Cancelled" })
                              .eq("id", r.id);
                            if (!error) {
                              fetchDashboardData();
                            }
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <PrimaryButton onClick={() => navigate("/dashboard/leave")}>
              <CalendarCheck size={16} className="mr-2" />
              Apply Leave
            </PrimaryButton>

            <GhostButton onClick={() => setViewAllLeaves(true)}>
              View all
            </GhostButton>
          </div>
        </SectionCard>

        {/* Job Information */}
        <SectionCard
          title="Job Information"
          subtitle="Your core employment details"
          action={<Badge tone="neutral">Profile</Badge>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Employee ID", value: adminProfile.id },
              { label: "Designation", value: adminProfile.role },
              { label: "Department", value: adminProfile.dept },
              { label: "Reporting Manager", value: adminProfile.reportingManager },
              { label: "Date of Joining", value: adminProfile.joiningDate ? fmtDate(adminProfile.joiningDate) : "-" },
              { label: "Work Mode", value: adminProfile.workMode },
              { label: "Total Experience", value: formatExperienceDuration(adminProfile.totalExperience) },
              { label: "Relevant Experience", value: formatExperienceDuration(adminProfile.relevantExperience) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border bg-slate-50 px-4 py-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {fmtOrDash(item.value)}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Absence Details Modal */}
      <Modal
        open={!!selectedAbsenceGroup}
        title={selectedAbsenceGroup?.title || "Absence Details"}
        onClose={() => setSelectedAbsenceGroup(null)}
      >
        <div className="rounded-2xl border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-600">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-600">
                  Total
                </th>
                <th className="px-4 py-2 text-left text-xs font-bold text-slate-600">
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(selectedAbsenceGroup?.items || []).map((item) => (
                <tr key={`${selectedAbsenceGroup?.id}-${item.type}`}>
                  <td className="px-4 py-2 text-slate-700">{item.type}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {item.total}
                  </td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {formatLeaveTotal(item.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Leave Details Modal */}
      <Modal
        open={!!selectedLeave}
        title="Leave Request Details"
        subtitle={selectedLeave?.reqId || ""}
        onClose={() => setSelectedLeave(null)}
      >
        {selectedLeave && (
          <div className="space-y-4">
            <div className="rounded-2xl border overflow-hidden">
              <table className="min-w-full text-sm">
                <tbody className="divide-y">
                  <tr>
                    <td className="px-4 py-2 text-slate-500 font-medium">Employee</td>
                    <td className="px-4 py-2 text-slate-900 font-bold">{selectedLeave.name}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-500 font-medium">Leave Type</td>
                    <td className="px-4 py-2 text-slate-900">{selectedLeave.type}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-500 font-medium">Duration</td>
                    <td className="px-4 py-2 text-slate-900">
                      {fmtDate(selectedLeave.from)} → {fmtDate(selectedLeave.to)} ({selectedLeave.days} day{selectedLeave.days > 1 ? "s" : ""})
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-500 font-medium">Reason</td>
                    <td className="px-4 py-2 text-slate-900">{selectedLeave.reason}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 text-slate-500 font-medium">Status</td>
                    <td className="px-4 py-2">
                      <Badge tone={toneChip[selectedLeave.status] || "warning"}>
                        {selectedLeave.status}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <GhostButton onClick={() => setSelectedLeave(null)}>Close</GhostButton>
              <PrimaryButton onClick={openApproveLeaves}>
                Go to Approvals
              </PrimaryButton>
            </div>
          </div>
        )}
      </Modal>

      {/* View All Leaves Modal */}
      <Modal
        open={viewAllLeaves}
        title="All Leave Requests"
        subtitle={`${adminLeaveRequests.length} request(s)`}
        onClose={() => setViewAllLeaves(false)}
      >
        <div className="space-y-3">
          <div className="rounded-2xl border overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">
              Leave History
            </div>
            <div className="divide-y max-h-[420px] overflow-auto">
              {adminLeaveRequests.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No leave requests yet.
                </div>
              ) : (
                adminLeaveRequests.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-slate-900">
                        {r.type}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {fmtDate(r.from)} → {fmtDate(r.to)} • {r.id} • {r.days} day(s)
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.reason}
                      </p>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <Badge tone={toneChip[r.status] || "neutral"}>
                        {r.status}
                      </Badge>

                      {r.status === "Pending" ? (
                        <button
                          className="text-xs font-bold text-rose-600 hover:underline"
                          onClick={async () => {
                            const { error } = await supabase
                              .from(ADMIN_LEAVES_TABLE)
                              .update({ status: "Cancelled" })
                              .eq("id", r.id);
                            if (!error) {
                              fetchDashboardData();
                            }
                          }}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <GhostButton onClick={() => setViewAllLeaves(false)}>Close</GhostButton>
            <PrimaryButton onClick={() => navigate("/dashboard/leave")}>
              Apply Leave
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApproverEmployeeDashboard;
