import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, AlertTriangle, CheckCircle2 } from "lucide-react";

import { useEmployeeDashboard } from "./shared/employeeStore";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import {
  Badge,
  SectionCard,
  PrimaryButton,
  GhostButton,
  Modal,
} from "./shared/ui.jsx";
import { formatDDMMYYYY } from "../../lib/dateUtils";

const toneChip = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
  Cancelled: "neutral",
};

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const PROFILE_CACHE_PREFIX = "hrmss.profile.cache.employee.";
const EMPLOYEE_TABLE = "hrmss_employees";
const EMPLOYEE_PROFILE_TABLE = "hrmss_employee_profiles";
const LEAVES_TABLE = "hrmss_leave_requests";

const TYPE_ALIASES = {
  "Casual Leave (afternoon)": "Casual Leave (evening)",
  "Sick Leave1 (morning)": "Sick Leave (morning)",
  "Sick Leave2 (afternoon)": "Sick Leave (evening)",
  "Sick Leave (afternoon)": "Sick Leave (evening)",
};

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

const probationAbsenceGroups = [
  {
    id: "emergency",
    title: "Emergency Leave",
    items: [{ type: "Emergency Leave", total: 12 }],
  },
];

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readEmployeeIdFromAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  const session = safeJsonParse(raw);
  return String(
    session?.employee_id || session?.identifier || session?.id || ""
  ).trim();
}

function readCachedEmployeeProfile(empId) {
  if (!empId) return null;
  return safeJsonParse(localStorage.getItem(`${PROFILE_CACHE_PREFIX}${empId}`));
}

function calcLeaveDays(from, to, leaveType = "") {
  // Check if this is a half-day leave type
  const normalizedType = String(leaveType || "").toLowerCase().trim();
  if (HALF_DAY_TYPES.has(normalizedType)) {
    return 0.5;
  }

  // Also check if leave type contains "half day" or "permission"
  if (normalizedType.includes("half day") || normalizedType.includes("permission")) {
    return 0.5;
  }

  if (!from || !to) return 1;
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return 1;
  const diff = Math.round((t - f) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

function fmtDate(d) {
  return formatDDMMYYYY(d);
}

const isProbationComplete = (joinDate) => {
  if (!joinDate) return false;
  const joined = new Date(joinDate);
  if (Number.isNaN(joined.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - joined.getTime();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return diffMs >= ninetyDaysMs;
};

function getInternCasualLeaveQuota(employeeType) {
  if (!employeeType) return null;
  const text = String(employeeType).trim().toLowerCase();
  if (!text.startsWith("intern")) return null;

  const match = text.match(/(\d+)/);
  if (!match) return null;
  const months = Number(match[1]);
  if (months === 3) return 3;
  if (months === 6) return 6;
  return null;
}

function normalizeLeaveType(raw) {
  const value = String(raw || "").trim();
  return TYPE_ALIASES[value] || value;
}

function formatLeaveTotal(value) {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

const fmtOrDash = (value) => (value ? String(value) : "-");

const calculateExperience = (expStr) => {
  if (!expStr || typeof expStr !== "string") return "-";

  // If it doesn't contain a range separator, it might be an old duration string (e.g. "3 Years")
  if (!expStr.includes(" - ")) {
    return expStr || "-";
  }

  const [fromPart, toPart] = expStr.split(" - ");
  if (!fromPart) return "-";

  const start = new Date(fromPart);
  const end = (!toPart || toPart.toLowerCase().includes("present")) ? new Date() : new Date(toPart);

  // If the fromPart isn't a valid date, it might be a malformed string or an old format
  if (isNaN(start.getTime())) {
    return expStr || "-";
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  // Adjust for partial months
  if (days < 0) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const yPart = years > 0 ? `${years} Year${years > 1 ? "s" : ""}` : "0 Years";
  const mPart = `${months} Month${months !== 1 ? "s" : ""}`;

  return `${yPart} ${mPart}`;
};

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const { view, actions, activeAction } = useEmployeeDashboard();

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [employeeInfo, setEmployeeInfo] = useState({
    id: "",
    name: "",
    role: "",
    dept: "",
    manager: "",
    joiningDate: "",
    status: "",
    workMode: "",
    employeeType: "",
    totalExperience: "",
    relevantExperience: "",
  });
  const isProbation = useMemo(() => {
    const status = String(employeeInfo.status || "").toLowerCase();
    if (status !== "probation") return false;
    return !isProbationComplete(employeeInfo.joiningDate);
  }, [employeeInfo.status, employeeInfo.joiningDate]);

  const absenceGroups = useMemo(() => {
    const usageByType = {};

    leaveRequests.forEach((req) => {
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

    const internCasualValue = getInternCasualLeaveQuota(
      employeeInfo.employeeType
    );
    const casualQuota = internCasualValue ?? 12;
    const catalog = isProbation ? probationAbsenceGroups : baseAbsenceGroups;
    const filteredCatalog =
      internCasualValue !== null
        ? catalog.filter((group) => group.id === "casual")
        : catalog;

    return filteredCatalog.map((group) => ({
      ...group,
      items: group.items.map((item) => {
        const key = item.type.toLowerCase();
        const total =
          group.id === "casual" && item.type === "Casual Leave"
            ? casualQuota
            : item.total;
        const used = usageByType[key] || 0;
        const remaining = Math.max(0, total - used);
        return {
          ...item,
          total,
          remaining,
        };
      }),
    }));
  }, [leaveRequests, isProbation, employeeInfo.employeeType]);

  const recentLeaves = useMemo(
    () => (leaveRequests || []).slice(0, 4),
    [leaveRequests]
  );

  const [selectedAbsenceGroup, setSelectedAbsenceGroup] = useState(null);

  useEffect(() => {
    if (!selectedAbsenceGroup) return;
    const updated = absenceGroups.find(
      (group) => group.id === selectedAbsenceGroup.id
    );
    if (updated) setSelectedAbsenceGroup(updated);
  }, [absenceGroups, selectedAbsenceGroup?.id]);

  const openApplyLeave = () => {
    navigate("/employee-dashboard/leave");
  };

  const handleCancelLeave = async (leaveId) => {
    const empId = readEmployeeIdFromAuth();
    if (!leaveId || !empId || !isSupabaseConfigured) return;

    setLeaveError("");

    const { error: cancelErr } = await supabase
      .from(LEAVES_TABLE)
      .update({ status: "Cancelled" })
      .eq("id", leaveId)
      .eq("owner_role", "employee")
      .eq("owner_id", empId);

    if (cancelErr) {
      setLeaveError(cancelErr.message || "Failed to cancel leave");
      return;
    }

    setLeaveRequests((prev) =>
      (prev || []).map((req) =>
        req.id === leaveId ? { ...req, status: "Cancelled" } : req
      )
    );
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      const empId = readEmployeeIdFromAuth();
      const cached = readCachedEmployeeProfile(empId);

      if (!empId) {
        if (cached?.fullName || cached?.employeeId) {
          setEmployeeInfo((prev) => ({
            ...prev,
            name: cached.fullName || "",
            id: cached.employeeId || "",
            role: cached.designation || cached.role || prev.role || "",
            dept: cached.department || cached.location || prev.dept || "",
            manager:
              cached.manager || cached.reporting_manager || prev.manager || "",
            joiningDate:
              cached.joiningDate || cached.joinDate || prev.joiningDate || "",
            workMode:
              cached.workMode || cached.work_mode || prev.workMode || "",
            employeeType: cached.employeeType || prev.employeeType || "",
          }));
        }
        return;
      }

      if (!isSupabaseConfigured) {
        setEmployeeInfo((prev) => ({
          ...prev,
          name: cached?.fullName || prev.name || "",
          id: cached?.employeeId || empId,
          role: cached?.designation || cached?.role || prev.role || "",
          dept: cached?.department || cached?.location || prev.dept || "",
          manager:
            cached?.manager || cached?.reporting_manager || prev.manager || "",
          joiningDate:
            cached?.joiningDate || cached?.joinDate || prev.joiningDate || "",
          workMode:
            cached?.workMode || cached?.work_mode || prev.workMode || "",
          employeeType: cached?.employeeType || prev.employeeType || "",
        }));
        return;
      }

      try {
        const [empRes, profileRes] = await Promise.all([
          supabase
            .from(EMPLOYEE_TABLE)
            // Explicit columns to avoid accidental typos that break the REST query
            .select(
              "employee_id, full_name, department, role, reporting_manager, join_date, location, status, employee_type"
            )
            .eq("employee_id", empId)
            .maybeSingle(),
          supabase
            .from(EMPLOYEE_PROFILE_TABLE)
            .select("employee_id, full_name, location, total_experience, relevant_experience")
            .eq("employee_id", empId)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        const empRow = empRes?.data || null;
        const profileRow = profileRes?.data || null;

        setEmployeeInfo({
          name:
            empRow?.full_name ||
            profileRow?.full_name ||
            cached?.fullName ||
            "",
          id: empRow?.employee_id || profileRow?.employee_id || empId || "",
          role: empRow?.role || cached?.designation || cached?.role || "",
          dept:
            empRow?.department ||
            profileRow?.location ||
            cached?.department ||
            cached?.location ||
            "",
          manager:
            empRow?.reporting_manager ||
            cached?.manager ||
            cached?.reporting_manager ||
            "",
          joiningDate:
            empRow?.join_date || cached?.joiningDate || cached?.joinDate || "",
          status: empRow?.status || cached?.status || cached?.employee_status || "",
          workMode:
            empRow?.location ||
            cached?.workMode ||
            cached?.work_mode ||
            cached?.location ||
            "",
          employeeType: empRow?.employee_type || cached?.employeeType || "",
          totalExperience: profileRow?.total_experience ||
            (cached?.totalExpFrom ? `${cached.totalExpFrom} - ${cached.totalExpPresent ? "Present" : cached.totalExpTo || ""}` : "") ||
            cached?.totalExperience || "",
          relevantExperience: profileRow?.relevant_experience ||
            (cached?.relevantExpFrom ? `${cached.relevantExpFrom} - ${cached.relevantExpPresent ? "Present" : cached.relevantExpTo || ""}` : "") ||
            cached?.relevantExperience || "",
        });
      } catch {
        if (!mounted) return;
        setEmployeeInfo((prev) => ({
          ...prev,
          name: cached?.fullName || prev.name || "",
          id: cached?.employeeId || empId,
          role: cached?.designation || cached?.role || prev.role || "",
          dept: cached?.department || cached?.location || prev.dept || "",
          manager:
            cached?.manager || cached?.reporting_manager || prev.manager || "",
          joiningDate:
            cached?.joiningDate || cached?.joinDate || prev.joiningDate || "",
          status: cached?.status || cached?.employee_status || prev.status || "",
          workMode:
            cached?.workMode || cached?.work_mode || prev.workMode || "",
          totalExperience: (cached?.totalExpFrom ? `${cached.totalExpFrom} - ${cached.totalExpPresent ? "Present" : cached.totalExpTo || ""}` : "") ||
            cached?.totalExperience || prev.totalExperience || "",
          relevantExperience: (cached?.relevantExpFrom ? `${cached.relevantExpFrom} - ${cached.relevantExpPresent ? "Present" : cached.relevantExpTo || ""}` : "") ||
            cached?.relevantExperience || prev.relevantExperience || "",
        }));
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const empId = readEmployeeIdFromAuth();
      if (!empId || !isSupabaseConfigured) {
        if (mounted) setLeaveRequests([]);
        return;
      }

      try {
        setLeaveLoading(true);
        setLeaveError("");

        const { data: rows, error: fetchErr } = await supabase
          .from(LEAVES_TABLE)
          .select(
            "id, leave_type, from_date, to_date, status, reason, applied_at"
          )
          .eq("owner_role", "employee")
          .eq("owner_id", empId)
          .order("applied_at", { ascending: false });

        if (fetchErr) throw fetchErr;
        if (!mounted) return;

        const mapped = (rows || []).map((row) => {
          const from = row.from_date ? String(row.from_date) : "";
          const to = row.to_date ? String(row.to_date) : from;
          const leaveType = row.leave_type || "-";
          return {
            id: row.id,
            type: leaveType,
            from,
            to,
            days: calcLeaveDays(from, to, leaveType),
            status: row.status || "Pending",
            reason: row.reason || "-",
          };
        });

        setLeaveRequests(mapped);
      } catch (fetchError) {
        if (!mounted) return;
        setLeaveError(fetchError?.message || "Failed to load leave data");
        setLeaveRequests([]);
      } finally {
        if (mounted) setLeaveLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {employeeInfo.name ? `${employeeInfo.name}'s Dashboard` : "Employee Dashboard"}
            </h1>
            {/* <Badge tone="purple">Self Service</Badge> */}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {employeeInfo.name || "-"} • {employeeInfo.id || "-"} •{" "}
            {employeeInfo.role || "-"} • {employeeInfo.dept || "-"}
          </p>

          {view?.expiringCount ? (
            <p className="mt-1 text-xs text-amber-700">
              <AlertTriangle className="inline -mt-0.5 mr-1" size={14} />
              {view.expiringCount} document(s) expiring within 30 days
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              <CheckCircle2 className="inline -mt-0.5 mr-1" size={14} />
              Welcome
            </p>
          )}

          {leaveLoading ? (
            <p className="mt-2 text-xs text-slate-500">Loading leave data</p>
          ) : leaveError ? (
            <p className="mt-2 text-xs text-rose-600">{String(leaveError)}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2" />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SectionCard
          title="Leave Details"
          subtitle="Absence types + recent requests"
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
                emergency: "bg-rose-50 border-rose-200 hover:bg-rose-100",
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

          {/* Recent requests */}
          <div className="mt-4 rounded-2xl border overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">
              Recent Requests
            </div>
            <div className="divide-y">
              {recentLeaves.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  No leave requests yet.
                </div>
              ) : (
                recentLeaves.map((r) => (
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
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCancelLeave(r.id);
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
            <PrimaryButton onClick={openApplyLeave}>
              <CalendarCheck size={16} className="mr-2" />
              Apply Leave
            </PrimaryButton>

            <GhostButton
              onClick={() =>
                actions.openAction({
                  kind: "VIEW_ALL_LEAVES",
                  title: "All Leave Requests",
                  desc: "View your full leave history",
                })
              }
            >
              View all
            </GhostButton>
          </div>
        </SectionCard>

        <SectionCard
          title="Job Information"
          subtitle="Your core employment details"
          action={<Badge tone="neutral">Profile</Badge>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Employee ID", value: employeeInfo.id },
              { label: "Designation", value: employeeInfo.role },
              { label: "Department", value: employeeInfo.dept },
              { label: "Reporting Manager", value: employeeInfo.manager },
              { label: "Date of Joining", value: employeeInfo.joiningDate ? formatDDMMYYYY(employeeInfo.joiningDate) : "-" },
              { label: "Work Mode", value: employeeInfo.workMode },
              { label: "Total Experience", value: calculateExperience(employeeInfo.totalExperience) },
              { label: "Relevant Experience", value: calculateExperience(employeeInfo.relevantExperience) },
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

      {/* Absence details */}
      <Modal
        open={!!selectedAbsenceGroup}
        title={selectedAbsenceGroup?.title || "Absence Details"}
        // subtitle="Type / Total"
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {(selectedAbsenceGroup?.items || []).map((item) => (
                <tr key={`${selectedAbsenceGroup?.id}-${item.type}`}>
                  <td className="px-4 py-2 text-slate-700">{item.type}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">
                    {formatLeaveTotal(item.remaining)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* <div className="mt-3 text-xs font-semibold text-slate-500">
          Click to view details
        </div> */}
      </Modal>

      {/* Modal */}
      <Modal
        open={!!activeAction}
        title={activeAction?.title || "Action"}
        subtitle={activeAction?.desc || ""}
        onClose={actions.closeAction}
      >
        {/* VIEW ALL LEAVES */}
        {activeAction?.kind === "VIEW_ALL_LEAVES" ? (
          <div className="space-y-3">
            <div className="rounded-2xl border overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700">
                Leave History
              </div>
              <div className="divide-y max-h-[420px] overflow-auto">
                {leaveRequests.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    No leave requests yet.
                  </div>
                ) : (
                  leaveRequests.map((r) => (
                    <div
                      key={r.id}
                      className="px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-900">
                          {r.type}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {fmtDate(r.from)} → {fmtDate(r.to)} • {r.id} •{" "}
                          {r.days} day(s)
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
                            onClick={() => handleCancelLeave(r.id)}
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
              <GhostButton onClick={actions.closeAction}>Close</GhostButton>
              <PrimaryButton onClick={openApplyLeave}>
                Apply Leave
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        {/* Default */}
        {!activeAction?.kind ? (
          <div className="flex justify-end">
            <GhostButton onClick={actions.closeAction}>Close</GhostButton>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
