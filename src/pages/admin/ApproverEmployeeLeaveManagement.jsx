import { useEffect, useMemo, useState } from "react";

import { AlertCircle } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY, formatTimeHHMM } from "../../lib/dateUtils";

/* ---------------- STORAGE HELPERS ---------------- */
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
    obj.admin_id ||
    obj.adminId ||
    obj.user_id ||
    obj.userId ||
    obj.identifier ||
    obj.id ||
    "";

  const name =
    obj.employee_name ||
    obj.employeeName ||
    obj.admin_name ||
    obj.adminName ||
    obj.full_name ||
    obj.fullName ||
    obj.name ||
    obj.username ||
    obj.user_name ||
    "";

  const normId = String(id || "").trim();
  const normName = String(name || "").trim();

  if (!normId) return null;
  return { id: normId, name: normName || normId };
};

const getUserFromStorage = (wantedRole) => {
  if (typeof window === "undefined") return null;

  // ✅ include your common key too
  const likelyKeys = [
    "HRMSS_AUTH_SESSION",
    "hrmss.session",
    "hrmss.auth",
    "hrmss.user",
    "hrmss.employee",
    "hrmss.employee.session",
    "employee_session",
    "employeeSession",
    "EMPLOYEE_SESSION",
    "hrmss.admin",
    "hrmss.admin.session",
    "admin_session",
    "adminSession",
    "ADMIN_SESSION",
    "hrmss.employee.signin",
  ];

  const matchesRole = (o) => {
    const role = String(
      o?.role ||
        o?.loginRole ||
        o?.login_role ||
        o?.userRole ||
        o?.type ||
        o?.user_type ||
        o?.userType ||
        ""
    )
      .toLowerCase()
      .trim();

    if (!role) return null;
    if (wantedRole === "employee" && role.includes("employee")) return true;
    if (wantedRole === "admin" && role.includes("admin")) return true;
    return false;
  };

  // 1) try common keys
  for (const k of likelyKeys) {
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;
    const parsed = safeJson(raw);

    const candidates = [parsed, parsed?.user, parsed?.profile, parsed?.data];
    for (const c of candidates) {
      const mr = matchesRole(c);
      if (mr === true) return normalizeUser(c);
    }

    // if no explicit role, use ID prefix
    const u = normalizeUser(parsed?.user || parsed);
    if (u?.id) {
      const up = u.id.toUpperCase();
      if (wantedRole === "employee" && up.startsWith("EMP")) return u;
      if (wantedRole === "admin" && up.startsWith("ADM")) return u;
    }
  }

  // 2) scan all localStorage entries
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      const raw = window.localStorage.getItem(key);
      const parsed = safeJson(raw);
      if (!parsed || typeof parsed !== "object") continue;

      const candidates = [parsed, parsed?.user, parsed?.profile, parsed?.data];
      for (const c of candidates) {
        const mr = matchesRole(c);
        if (mr === true) return normalizeUser(c);
      }

      const u = normalizeUser(parsed?.user || parsed);
      if (u?.id) {
        const up = u.id.toUpperCase();
        if (wantedRole === "employee" && up.startsWith("EMP")) return u;
        if (wantedRole === "admin" && up.startsWith("ADM")) return u;
      }
    }
  } catch {
    // ignore
  }

  return null;
};

/* ---------------- TABLE NAMES ---------------- */
// NOTE: Employee view safest source = hrmss_leave_requests (owner_role/owner_id)
// Admin apply table = admin_leaves (your existing flow)
const ADM_TABLE = "admin_leaves";
const APPROVERS_TABLE = "hrmss_approvers";
const LEAVES_TABLE = "hrmss_leave_requests";

/* ---------------- HELPERS ---------------- */
const diffDaysInclusive = (from, to) => {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const ms = b - a;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
  return Number.isFinite(days) ? Math.max(days, 1) : 1;
};

const pill = (status) => {
  const base =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border";
  if (status === "Approved")
    return `${base} bg-emerald-50 text-emerald-700 border-emerald-200`;
  if (status === "Rejected")
    return `${base} bg-rose-50 text-rose-700 border-rose-200`;
  return `${base} bg-amber-50 text-amber-800 border-amber-200`;
};

const roleBadge = (role) => {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border";
  if (role === "employee")
    return `${base} bg-indigo-50 text-indigo-700 border-indigo-200`;
  return `${base} bg-slate-50 text-slate-700 border-slate-200`;
};

const fmtDMY = (v) => formatDDMMYYYY(v);

const fmtDT = (iso) => ({
  date: formatDDMMYYYY(iso),
  time: formatTimeHHMM(iso),
});

const initials = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
};

const computeHoursText = (tFrom, tTo) => {
  if (!tFrom || !tTo) return "";
  const [fh, fm] = tFrom.split(":").map(Number);
  const [th, tm] = tTo.split(":").map(Number);
  if (![fh, fm, th, tm].every((n) => Number.isFinite(n))) return "";
  const fromMin = fh * 60 + fm;
  const toMin = th * 60 + tm;
  const diff = toMin - fromMin;
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
};


const fetchApproversByRole = async (role) => {
  const { data, error } = await supabase
    .from(APPROVERS_TABLE)
    .select("id,name,role,access,active")
    .eq("active", true)

    .eq("role", role)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data || [])
    .map((r) => ({
      id: String(r.id),
      name: String(r.name || ""),
      access: String(r.access || ""),
    }))
    .filter((m) => m.id && m.name);
};

/* ---------------- MAPPER: DB -> UI ---------------- */
// ✅ Employee view from hrmss_leave_requests
const mapRequestsDbToUi = (
  r,
  nameMap = new Map(),
  currentAdminId = "",
  allowRoleMatch = false
) => {
  const adminId = String(currentAdminId || "").toLowerCase();
  const recipients = Array.isArray(r.recipients) ? r.recipients : [];
  const roleText = String(r.request_to_role || "").toLowerCase();
  const roleMatchesAdmin =
    allowRoleMatch && (roleText.includes("admin-head") || roleText === "admin");
  const assignedToMe = adminId
    ? recipients.some(
        (rec) => String(rec.id || rec.request_to_id || "").toLowerCase() === adminId
      ) ||
      String(r.request_to_id || "").toLowerCase() === adminId ||
      roleMatchesAdmin
    : false;

  return {
    id: r.id,
    ownerRole: r.owner_role || "employee",
    ownerId: r.owner_id || "",
    ownerName: nameMap.get(String(r.owner_id || "")) || r.owner_name || "",
    leaveType: r.leave_type,
  leaveMode: r.mode || "Full Day",
  from: r.from_date,
  to: r.to_date || r.from_date,
  timeFrom: r.time_from || "",
  timeTo: r.time_to || "",
  hours: r.hours || "",
  reason: r.reason,
    status: r.status,
    appliedAt: r.applied_at,
    requestedTo: r.requested_to || [], // optional
    halfSession: r.half_session || "",
    recipients,
    requestToId: r.request_to_id || "",
    requestToName: r.request_to_name || "",
    requestToRole: r.request_to_role || "",
    assignedToMe,
    requestRowId: r.myRowId || r.id,
  };
};

const showTimeLine = (r) => {
  const mode = r.leaveMode;
  if (mode !== "Permission" && mode !== "Half Day") return null;
  if (!r.timeFrom && !r.timeTo && !r.hours) return null;
  return (
    <>
      {" "}
      • {r.timeFrom || "-"} → {r.timeTo || "-"}
      {r.hours ? <> • {r.hours}</> : null}
    </>
  );
};

const calcDaysDisplay = (r) => {
  if (r.leaveMode === "Half Day") return 0.5;
  if (r.leaveMode === "Permission") return 1;
  return diffDaysInclusive(r.from, r.to);
};

/* ---------------- PAGE ---------------- */
const LeaveManagement = () => {
  const [mode, setMode] = useState("employee"); // "employee" | "admin"

  // ✅ TRUE users only
  const currentEmployee = useMemo(() => getUserFromStorage("employee"), []);
  const currentAdmin = useMemo(() => getUserFromStorage("admin"), []);

  // ✅ data from Supabase
  const [requests, setRequests] = useState([]);

  // Apply modal open/close
  const [showApply, setShowApply] = useState(false);

  // Apply form fields (Admin)
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [leaveMode, setLeaveMode] = useState("Full Day");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");

  // Request To (HR/Manager)

  const APPROVER_OPTIONS = ["Manager"];
  const [requestedTo, setRequestedTo] = useState(["Manager"]);

  const [halfSession, setHalfSession] = useState("First Half");

  // Filters
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");

  // View modal
  const [viewing, setViewing] = useState(null);
  const [actionLoading, setActionLoading] = useState("");

  // Summary details modal
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryStatus, setSummaryStatus] = useState("All");

  const resetApplyForm = () => {
    setLeaveType("Casual Leave");
    setLeaveMode("Full Day");
    setFrom("");
    setTo("");
    setTimeFrom("");
    setTimeTo("");
    setHours("");
    setReason("");
    setRequestedTo(["HR", "Manager"]);
    setHalfSession("First Half");
  };

  // close apply fields when switching mode
  useEffect(() => {
    if (mode === "employee") {
      setShowApply(false);
      resetApplyForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (leaveMode === "Full Day") {
      setTimeFrom("");
      setTimeTo("");
      setHours("");
    }
    if (leaveMode === "Half Day") {
      setTo("");
      setHalfSession("First Half");
      setTimeFrom("09:00");
      setTimeTo("13:30");
    }
    if (leaveMode === "Permission") {
      setTo("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveMode]);

  useEffect(() => {
    if (leaveMode !== "Half Day") return;
    if (halfSession === "First Half") {
      setTimeFrom("09:00");
      setTimeTo("13:30");
      return;
    }
    setTimeFrom("14:00");
    setTimeTo("17:30");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [halfSession, leaveMode]);

  useEffect(() => {
    if (leaveMode !== "Permission" && leaveMode !== "Half Day") return;
    const h = computeHoursText(timeFrom, timeTo);
    if (h) setHours(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFrom, timeTo, leaveMode]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setViewing(null);
        setShowApply(false);
      }
    };
    if (viewing || showApply) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing, showApply]);

  /* ---------------- FETCH FROM SUPABASE ---------------- */
  const fetchRequests = async (activeMode = mode) => {
    try {

      const nameMap = new Map();
      const adminId = String(currentAdmin?.id || "").toLowerCase();
      
      // ✅ employee: fetch from hrmss_leave_requests using owner_role/owner_id
      if (activeMode === "employee") {
        if (!currentEmployee?.id && !currentAdmin?.id) {
          setRequests([]);
          return;
        }

        let query = supabase
          .from(LEAVES_TABLE)
          .select("*")
          .eq("owner_role", "employee");

        if (currentEmployee?.id && !currentAdmin?.id) {
          query = query.eq("owner_id", currentEmployee.id);
        }

        const { data, error } = await query.order("applied_at", {
          ascending: false,
        });

        if (error) throw error;

        // 2) Group by applied_at
        const groups = new Map();
        (data || []).forEach((r) => {
          const key = `${r.applied_at || ""}_${r.owner_id || ""}_${(r.reason || "").slice(0, 20)}`;
          if (!groups.has(key)) {
            groups.set(key, { ...r, recipients: [], myRowId: null });
          }
          const recipient = {
            id: r.request_to_id,
            name: r.request_to_name,
            role: r.request_to_role,
            status: r.status,
            rowId: r.id,
          };
          const target = groups.get(key);
          target.recipients.push(recipient);
          if (
            adminId &&
            String(r.request_to_id || "").toLowerCase() === adminId
          ) {
            target.myRowId = r.id;
          }
        });

        setRequests(
          Array.from(groups.values()).map((row) =>
            mapRequestsDbToUi(row, nameMap, currentAdmin?.id, !!currentAdmin?.id)
          )
        );
        return;
      }

      // ✅ admin: show admin leaves from hrmss_leave_requests too (owner_role admin)
      // (optional) if you want admin to see only their own request routing entries
      if (!currentAdmin?.id) {
        setRequests([]);
        return;
      }

      const { data: ownRows, error: ownErr } = await supabase
        .from(LEAVES_TABLE)
        .select("*")
        .eq("owner_role", "admin")
        .eq("owner_id", currentAdmin.id)
        .order("applied_at", { ascending: false });
      if (ownErr) throw ownErr;

      const { data: assignedRows, error: assignedErr } = await supabase
        .from(LEAVES_TABLE)
        .select("*")
        .eq("request_to_id", currentAdmin.id)
        .order("applied_at", { ascending: false });
      if (assignedErr) throw assignedErr;

      const { data: assignedRoleRows, error: assignedRoleErr } = await supabase
        .from(LEAVES_TABLE)
        .select("*")
        .in("request_to_role", ["admin", "admin-head"])
        .order("applied_at", { ascending: false });
      if (assignedRoleErr) throw assignedRoleErr;

      const rowsMap = new Map();
      [...(ownRows || []), ...(assignedRows || []), ...(assignedRoleRows || [])].forEach((r) => {
        if (r?.id) rowsMap.set(r.id, r);
      });
      const rows = Array.from(rowsMap.values());

      const ids = [
        ...new Set(rows.map((r) => String(r.owner_id || "")).filter((id) => id)),
      ];

      if (ids.length) {
        const profileRes = await supabase
          .from("hrmss_profiles")
          .select("employee_id, full_name")
          .in("employee_id", ids);

        if (!profileRes.error) {
          (profileRes.data || []).forEach((row) => {
            if (row?.employee_id) {
              nameMap.set(String(row.employee_id), row.full_name || "");
            }
          });
        }
      }


      // 2) Group by applied_at
      const groups = new Map();
      rows.forEach((r) => {
        const key = `${r.applied_at || ""}_${r.owner_id || ""}_${(r.reason || "").slice(0, 20)}`;
        if (!groups.has(key)) {
          groups.set(key, { ...r, recipients: [], myRowId: null });
        }
        const recipient = {
          id: r.request_to_id,
          name: r.request_to_name,
          role: r.request_to_role,
          status: r.status,
          rowId: r.id,
        };
        const target = groups.get(key);
        target.recipients.push(recipient);
        if (
          adminId &&
          String(r.request_to_id || "").toLowerCase() === adminId
        ) {
          target.myRowId = r.id;
          target.status = r.status;
          target.request_to_id = r.request_to_id;
          target.request_to_name = r.request_to_name;
          target.request_to_role = r.request_to_role;
        }
      });

      setRequests(
        Array.from(groups.values()).map((row) =>
          mapRequestsDbToUi(row, nameMap, currentAdmin?.id, true)
        )
      );

    } catch (err) {
      alert(err?.message || "Failed to load leaves");
    }
  };

  useEffect(() => {
    fetchRequests(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentEmployee?.id, currentAdmin?.id]);

  /* ---------------- REALTIME: auto refresh ---------------- */
  useEffect(() => {
    const channel = supabase
      .channel(`leaves_requests_changes_${mode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAVES_TABLE },
        () => fetchRequests(mode)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentEmployee?.id, currentAdmin?.id]);

  /* ---------------- ROLE DATASET ---------------- */
  const dataset = useMemo(() => {
    if (mode === "employee") {
      if (currentAdmin?.id) {
        return requests.filter((r) => r.ownerRole === "employee");
      }
      if (currentEmployee?.id) {
        return requests.filter(
          (r) => r.ownerRole === "employee" && r.ownerId === currentEmployee.id
        );
      }
      return [];
    }
    if (!currentAdmin?.id) return [];
    return requests.filter(
      (r) => r.ownerRole === "admin"
    );
  }, [mode, requests, currentEmployee?.id, currentAdmin?.id]);

  const filtered = useMemo(() => {
    let list = [...dataset];

    if (statusFilter !== "All") list = list.filter((r) => r.status === statusFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          (String(r.id || "")).toLowerCase().includes(q) ||
          (r.leaveType || "").toLowerCase().includes(q) ||
          (r.leaveMode || "").toLowerCase().includes(q) ||
          (r.reason || "").toLowerCase().includes(q) ||
          (r.ownerName || "").toLowerCase().includes(q) ||
          (r.ownerId || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    return list;
  }, [dataset, statusFilter, search]);

  const counts = useMemo(() => {
    const total = dataset.length;
    const pending = dataset.filter((r) => r.status === "Pending").length;
    const approved = dataset.filter((r) => r.status === "Approved").length;
    const rejected = dataset.filter((r) => r.status === "Rejected").length;
    return { total, pending, approved, rejected };
  }, [dataset]);

  const summaryList = useMemo(() => {
    let list = [...dataset];
    if (summaryStatus !== "All") list = list.filter((r) => r.status === summaryStatus);
    list.sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));
    return list;
  }, [dataset, summaryStatus]);

  const openSummary = (st) => {
    setSummaryStatus(st);
    setSummaryOpen(true);
  };

  const actOnRequest = async (nextStatus) => {
    if (!viewing || viewing.status !== "Pending" || !viewing.assignedToMe) return;
    const targetId = viewing.requestRowId || viewing.id;
    if (!targetId) return;

    try {
      setActionLoading(nextStatus);
      const { error } = await supabase
        .from(LEAVES_TABLE)
        .update({ status: nextStatus })
        .eq("id", targetId);

      if (error) throw error;
      setViewing((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      fetchRequests(mode);
    } catch (err) {
      alert(err?.message || `Failed to mark as ${nextStatus}`);
    } finally {
      setActionLoading("");
    }
  };

  const toggleRequestedTo = (role) => {
    setRequestedTo((prev) => {
      const has = prev.includes(role);
      if (has) return prev.filter((x) => x !== role);

      if (prev.length >= 3) return prev;
      return [...prev, role];
    });
  };

  /* ---------------- APPLY (ADMIN ONLY) ---------------- */
  const submitLeave = async () => {
    if (mode !== "admin") return;

    if (!currentAdmin?.id) {
      alert("Admin session not found. Please login again.");
      return;
    }

    if (!requestedTo || requestedTo.length === 0) {
      alert("Please choose Request To (HR / Manager).");
      return;
    }

    if (!reason.trim()) {
      alert("Please fill Reason.");
      return;
    }

    if (!from) {
      alert("Please select Date.");
      return;
    }

    if (leaveMode === "Full Day") {
      if (!to) {
        alert("Please select To date.");
        return;
      }
      if (new Date(to) < new Date(from)) {
        alert("To date cannot be earlier than From date.");
        return;
      }
    }

    if (leaveMode === "Permission" || leaveMode === "Half Day") {
      if (!timeFrom || !timeTo) {
        alert("Please select Time From and Time To.");
        return;
      }
      const hText = computeHoursText(timeFrom, timeTo);
      if (!hText) {
        alert("Time To must be later than Time From.");
        return;
      }
    }

    const isTimed = leaveMode === "Permission" || leaveMode === "Half Day";
    const toDateForDb = leaveMode === "Full Day" ? to : from;

    const commonFields = {
      leave_type: leaveType,
      mode: leaveMode,
      from_date: from,
      to_date: toDateForDb,
      time_from: isTimed ? timeFrom : null,
      time_to: isTimed ? timeTo : null,
      hours: isTimed ? (hours || computeHoursText(timeFrom, timeTo)) : null,
      reason: reason.trim(),
      status: "Pending",
      applied_at: new Date().toISOString(),
    };

    // 1) ✅ Save admin's own leave in admin_leaves (your table)
    const payloadAdminLeaves = {
      admin_id: currentAdmin.id,
      admin_name: currentAdmin.name,
      ...commonFields,
      requested_to: requestedTo, // recommended: text[] or jsonb
      half_session: leaveMode === "Half Day" ? halfSession : null,
    };

    const { error: saveAdminErr } = await supabase.from(ADM_TABLE).insert(payloadAdminLeaves);
    if (saveAdminErr) {
      alert(saveAdminErr.message);
      return;
    }

    // 2) ✅ Also create routing rows in hrmss_leave_requests (so it appears in manager/hr approvals)
    // If you only want manager routing, keep your logic. Here I keep manager routing same as yours.
    const requestedTargets = requestedTo
      .map((r) => String(r || "").trim().toLowerCase())
      .filter(Boolean);

    let managerSendError = "";
    if (requestedTargets.includes("manager")) {
      try {

        const managers = await fetchApproversByRole("manager");
        if (!managers.length) {
          managerSendError = "No managers found in approver list.";
        } else {
          const approverMgr = managers.find((m) => m.access === "approver");
          const viewerMgrs = managers.filter((m) => m.access === "viewer");

          if (!approverMgr) {
            managerSendError = "No approver manager found.";
          } else {
            const commonRequest = {
              owner_role: "admin",
              owner_id: currentAdmin.id,
              owner_name: currentAdmin.name,
              request_to_role: "manager",
              ...commonFields,
            };

            const rowsToInsert = [
              {
                ...commonRequest,
                request_to_id: approverMgr.id,
                request_to_name: approverMgr.name,
              },
              ...viewerMgrs.map((v) => ({
                ...commonRequest,
                request_to_id: v.id,
                request_to_name: v.name,
              })),
            ];

            const { error: mgrError } = await supabase
              .from(LEAVES_TABLE)
              .insert(rowsToInsert);

            if (mgrError) managerSendError = mgrError.message;
          }
        }
      } catch (mgrError) {
        managerSendError = mgrError?.message || "Failed to send to manager.";
      }
    }


    let adminHeadSendError = "";
    if (requestedTargets.includes("admin head")) {
      try {
        const adminHeads = await fetchApproversByRole("admin-head");
        if (!adminHeads.length) {
          adminHeadSendError = "No admin head found in approver list.";
        } else {
          const approver = adminHeads.find((m) => m.access === "approver") || adminHeads[0];
          const viewers = adminHeads.filter((m) => m.id !== approver.id);

          const commonRequest = {
            owner_role: "admin",
            owner_id: currentAdmin.id,
            owner_name: currentAdmin.name,
            request_to_role: "admin-head",
            ...commonFields,
          };

          const rowsToInsert = [
            {
              ...commonRequest,
              request_to_id: approver.id,
              request_to_name: approver.name,
            },
            ...viewers.map((v) => ({
              ...commonRequest,
              request_to_id: v.id,
              request_to_name: v.name,
            })),
          ];

          const { error: ahErr } = await supabase.from(LEAVES_TABLE).insert(rowsToInsert);
          if (ahErr) adminHeadSendError = ahErr.message;
        }
      } catch (ahError) {
        adminHeadSendError = ahError?.message || "Failed to send to Admin Head.";
      }
    }

    resetApplyForm();
    setShowApply(false);
    fetchRequests(mode);


    if (managerSendError || adminHeadSendError) {
      const msgs = [managerSendError, adminHeadSendError].filter(Boolean).join(" | ");
      alert(`Leave saved, but routing failed: ${msgs}`);
      return;
    }

    alert("Leave request submitted!");
  };

  /* ---------------- GUARD UI (NO FAKE DATA) ---------------- */
  const canViewEmployeeMode = Boolean(currentEmployee?.id || currentAdmin?.id);
  const needsLogin =
    (mode === "employee" && !canViewEmployeeMode) ||
    (mode === "admin" && !currentAdmin?.id);

  if (needsLogin) {
    return (
      <section className="space-y-4">
        <div className="bg-white border rounded-2xl p-6">
          <h1 className="text-2xl font-semibold">Leave Letters</h1>
          <p className="text-sm text-gray-600 mt-2">
            {mode === "employee"
              ? "Employee session not found. Please login as Employee."
              : "Admin session not found. Please login as Admin."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
            <button
              type="button"
              onClick={() => {
                setMode("employee");
                setShowApply(false);
                setSearch("");
                setStatusFilter("All");
                setSummaryOpen(false);
                setViewing(null);
              }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                mode === "employee" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Employee
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("admin");
                setSearch("");
                setStatusFilter("All");
                setSummaryOpen(false);
                setViewing(null);
              }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                mode === "admin" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Admin
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ---------------- UI (unchanged mostly) ---------------- */
  return (
    <section className="space-y-4">
      {/* Header + Toggle + Apply button */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leave Letters</h1>
          <p className="text-sm text-gray-600">
            {mode === "employee"
              ? currentAdmin?.id
                ? "Admin can view all employee leave letters."
                : "Employee can view only their own leave letters."
            : "Admin can apply leave and act on requests assigned to them."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle */}
          <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
            <button
              type="button"
              onClick={() => {
                setMode("employee");
                setShowApply(false);
                setSearch("");
                setStatusFilter("All");
                setSummaryOpen(false);
                setViewing(null);
              }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                mode === "employee" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Employee
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("admin");
                setSearch("");
                setStatusFilter("All");
                setSummaryOpen(false);
                setViewing(null);
              }}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                mode === "admin" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              Admin
            </button>
          </div>

          {/* Apply Button ONLY for Admin */}
          {mode === "admin" && (
            <button
              type="button"
              onClick={() => setShowApply(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
            >
              Apply Leave
            </button>
          )}
        </div>
      </div>

      {/* ADMIN APPLY LEAVE MODAL (SMALL) */}
      {mode === "admin" && showApply && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowApply(false);
          }}
        >
          <div className="w-full max-w-[620px] bg-white rounded-2xl shadow-2xl border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">Apply Leave</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {currentAdmin.name} • {currentAdmin.id}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowApply(false)}
                className="w-9 h-9 rounded-xl border bg-white hover:bg-gray-50 text-xl leading-none flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-3">
                <div className="border border-gray-200 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-2">Request To (Manager only)</div>
                  <div className="flex flex-wrap gap-2">
                    {APPROVER_OPTIONS.map((opt) => {
                      const active = requestedTo.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleRequestedTo(opt)}
                          className={`px-3 py-2 rounded-xl text-sm border transition ${
                            active
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                Selected:{" "}
                <span className="font-semibold">
                  {requestedTo.length ? requestedTo.join(", ") : "None"}
                </span>{" "}
                    (manager only)
                  </div>
                </div>

                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option>Casual Leave</option>
                  <option>Sick Leave</option>
                  <option>Annual Leave</option>
                  <option>Paid Leave</option>
                </select>

                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  value={leaveMode}
                  onChange={(e) => setLeaveMode(e.target.value)}
                >
                  <option>Full Day</option>
                  <option>Half Day</option>
                  <option>Permission</option>
                </select>

                {leaveMode === "Full Day" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To</label>
                      <input
                        type="date"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {leaveMode === "Half Day" && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input
                        type="date"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setHalfSession("First Half")}
                        className={`text-left border rounded-xl p-3 transition ${
                          halfSession === "First Half"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white hover:bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="text-sm font-semibold">First Half</div>
                        <div className={`text-xs mt-1 ${halfSession === "First Half" ? "text-white/80" : "text-gray-500"}`}>
                          09:00 → 13:30
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHalfSession("Second Half")}
                        className={`text-left border rounded-xl p-3 transition ${
                          halfSession === "Second Half"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white hover:bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="text-sm font-semibold">Second Half</div>
                        <div className={`text-xs mt-1 ${halfSession === "Second Half" ? "text-white/80" : "text-gray-500"}`}>
                          14:00 → 17:30
                        </div>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Time From</label>
                        <input
                          type="time"
                          readOnly
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none bg-gray-50"
                          value={timeFrom}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Time To</label>
                        <input
                          type="time"
                          readOnly
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none bg-gray-50"
                          value={timeTo}
                        />
                      </div>
                    </div>
                  </>
                )}

                {leaveMode === "Permission" && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input
                        type="date"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Time From</label>
                        <input
                          type="time"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                          value={timeFrom}
                          onChange={(e) => setTimeFrom(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Time To</label>
                        <input
                          type="time"
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                          value={timeTo}
                          onChange={(e) => setTimeTo(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Hours (optional)</label>
                      <input
                        type="text"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="Eg: 2 hr / 1 hr 30 min"
                      />
                    </div>
                  </>
                )}

                <textarea
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  resetApplyForm();
                  setShowApply(false);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitLeave}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary (CLICKABLE) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onClick={() => openSummary("All")} className="text-left bg-white border rounded-xl p-3 hover:shadow-sm transition">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl font-semibold">{counts.total}</div>
          <div className="text-[11px] text-gray-400 mt-1">Click to view list</div>
        </button>
        <button onClick={() => openSummary("Pending")} className="text-left bg-white border rounded-xl p-3 hover:shadow-sm transition">
          <div className="text-xs text-gray-500">Pending</div>
          <div className="text-xl font-semibold">{counts.pending}</div>
          <div className="text-[11px] text-gray-400 mt-1">Click to view list</div>
        </button>
        <button onClick={() => openSummary("Approved")} className="text-left bg-white border rounded-xl p-3 hover:shadow-sm transition">
          <div className="text-xs text-gray-500">Approved</div>
          <div className="text-xl font-semibold">{counts.approved}</div>
          <div className="text-[11px] text-gray-400 mt-1">Click to view list</div>
        </button>
        <button onClick={() => openSummary("Rejected")} className="text-left bg-white border rounded-xl p-3 hover:shadow-sm transition">
          <div className="text-xs text-gray-500">Rejected</div>
          <div className="text-xl font-semibold">{counts.rejected}</div>
          <div className="text-[11px] text-gray-400 mt-1">Click to view list</div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Status</label>
            <select
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by request id / name / id / type / reason..."
            className="w-full md:w-96 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Request</th>
              <th className="text-left px-4 py-3 font-medium">Dates</th>
              <th className="text-left px-4 py-3 font-medium">Days</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">View</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={5}>
                  No leave letters found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const { date, time } = fmtDT(r.appliedAt);
                const days = calcDaysDisplay(r);

                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                          {initials(r.ownerName)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold">{r.leaveType}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Mode: <span className="font-semibold">{r.leaveMode}</span>
                            {r.leaveMode === "Half Day" && r.halfSession ? (
                              <>
                                {" "}
                                • <span className="font-semibold">{r.halfSession}</span>
                              </>
                            ) : null}
                            {showTimeLine(r)}
                          </div>

                          {/* routing info */}

                          {(r.requestToName || r.requestToRole || r.recipients?.length > 0) && (
                            <div className="text-xs text-gray-500 mt-2">
                              <span className="font-semibold text-gray-700 underline">Sent To:</span>{" "}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.recipients?.map((rt, idx) => (
                                  <span key={idx} className="bg-gray-100 border px-1.5 py-0.5 rounded text-[10px] font-bold text-gray-700">
                                    {rt.role?.toUpperCase() || "OWNER"}: {rt.name || "-"}
                                  </span>
                                ))}
                                {!r.recipients?.length && (
                                  <span className="text-gray-400 italic">
                                    {r.requestToRole || "manager"} • {r.requestToName || "-"}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {r.assignedToMe ? (
                            <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg inline-flex items-center gap-1 mt-2">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                              Assigned to you
                            </div>
                          ) : null}

                          <div className="text-xs text-gray-500">
                            Applied: {date} {time}
                          </div>
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {r.reason}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-gray-700">
                        {fmtDMY(r.from)} → {fmtDMY(r.to)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {r.ownerName} • {r.ownerId}
                      </div>
                      <div className="mt-1">
                        <span className={roleBadge(r.ownerRole)}>
                          Employment: {r.ownerRole === "employee" ? "Employee" : "Admin"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3">{days}</td>

                    <td className="px-4 py-3">
                      <span className={pill(r.status)}>{r.status}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setViewing(r)}
                          className="px-3 py-1.5 rounded-lg text-xs border bg-white hover:bg-gray-50"
                        >
                          View Letter
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Details Modal */}
      {summaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg border overflow-hidden">
            <div className="p-5 border-b flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">
                  {summaryStatus === "All" ? "All Leave Letters" : `${summaryStatus} Leave Letters`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Showing: <span className="font-semibold">{summaryList.length}</span> requests • Mode:{" "}
                  <span className="font-semibold">{mode.toUpperCase()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs border bg-white hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              {summaryList.length === 0 ? (
                <div className="text-sm text-gray-500 py-10 text-center">No records found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Owner</th>
                        <th className="text-left px-4 py-3 font-medium">Leave</th>
                        <th className="text-left px-4 py-3 font-medium">Dates</th>
                        <th className="text-left px-4 py-3 font-medium">Status</th>
                        <th className="text-right px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {summaryList.map((r) => {
                        const { date, time } = fmtDT(r.appliedAt);
                        const days = calcDaysDisplay(r);
                        return (
                          <tr key={`sum-${r.id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold">{r.ownerName}</div>
                              <div className="text-xs text-gray-500">{r.ownerId}</div>
                              <div className="mt-1">
                                <span className={roleBadge(r.ownerRole)}>
                                  {r.ownerRole === "employee" ? "Employee" : "Admin"}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="font-semibold">{r.leaveType}</div>
                              <div className="text-xs text-gray-500">
                                Mode: <span className="font-semibold">{r.leaveMode}</span>
                                {r.leaveMode === "Half Day" && r.halfSession ? (
                                  <>
                                    {" "}
                                    • <span className="font-semibold">{r.halfSession}</span>
                                  </>
                                ) : null}
                                {showTimeLine(r)}
                              </div>
                              <div className="text-xs text-gray-500">
                                Applied: {date} {time}
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <div className="text-gray-700">
                                {fmtDMY(r.from)} → {fmtDMY(r.to)}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Days: <span className="font-semibold">{days}</span>
                              </div>
                            </td>

                            <td className="px-4 py-3">
                              <span className={pill(r.status)}>{r.status}</span>
                            </td>

                            <td className="px-4 py-3">
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setViewing(r)}
                                  className="px-3 py-1.5 rounded-lg text-xs border bg-white hover:bg-gray-50"
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-5 border-t flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSummaryOpen(false)}
                className="px-4 py-2 rounded-xl text-sm border bg-white hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* View Letter Modal (RE-DESIGNED) */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewing(null);
          }}
        >

          <div className="w-full max-w-lg rounded-[24px] bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header with Gradient */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-500 text-white px-6 py-4 flex items-center justify-between shadow-lg">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-bold mb-0.5">
                  Leave request detail
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold">#{String(viewing.id || "REQ").slice(0, 8)}</span>
                  <span className={pill(viewing.status)}>{viewing.status}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewing(null)}
                className="w-10 h-10 rounded-full border border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all hover:rotate-90 duration-300"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {/* Profile Section */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 border border-indigo-200 flex items-center justify-center text-sm font-bold shadow-inner">
                  {initials(viewing.ownerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-800 text-base leading-tight">{viewing.ownerName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 bg-white/50 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-wider">{viewing.ownerId}</span>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white border border-slate-100 p-3 shadow-sm hover:border-indigo-200 transition-colors">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Leave Type</p>
                  <p className="mt-1 font-bold text-slate-900 text-sm leading-tight">
                    {viewing.leaveType}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{viewing.leaveMode}</p>
                </div>

                <div className="rounded-2xl bg-white border border-slate-100 p-3 shadow-sm flex flex-col justify-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Duration</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900">{calcDaysDisplay(viewing)}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white border border-slate-100 p-3 shadow-sm">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Applied On</p>
                  <p className="mt-1 font-bold text-slate-900 text-sm leading-tight">{fmtDT(viewing.appliedAt).date}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{fmtDT(viewing.appliedAt).time}</p>
                </div>

                <div className="rounded-2xl bg-white border border-slate-100 p-3 shadow-sm">
                   <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recipient(s)</p>
                   <div className="mt-1 flex flex-wrap gap-1">
                      {viewing.recipients && viewing.recipients.length > 0 ? (
                        viewing.recipients.map((rec, i) => (
                          <span key={i} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full uppercase truncate max-w-[80px]">
                            {rec.role}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">NONE</span>
                      )}
                   </div>
                </div>
              </div>

              {/* Dates Flow */}
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                 <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Schedule</p>
                 <div className="flex items-center justify-between text-sm">
                    <div className="text-center flex-1">
                      <p className="text-xs font-bold text-slate-400 uppercase">From</p>
                      <p className="mt-1 font-extrabold text-slate-800">{fmtDMY(viewing.from)}</p>
                    </div>
                    <div className="px-4 text-slate-200">
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-xs font-bold text-slate-400 uppercase">To</p>
                      <p className="mt-1 font-extrabold text-slate-800">{fmtDMY(viewing.to)}</p>
                    </div>
                 </div>
                 
                 {(viewing.leaveMode === "Permission" || viewing.leaveMode === "Half Day") && (
                   <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-center gap-4 text-xs font-bold text-indigo-600 bg-white/60 py-1.5 rounded-lg border border-slate-100">
                      <span className="inline-flex items-center justify-center h-4 w-4 text-indigo-600" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </span>
                      <span>{viewing.timeFrom || "--:--"}  {viewing.timeTo || "--:--"}</span>
                      {viewing.hours && <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[10px]">{viewing.hours}</span>}
                   </div>
                 )}
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider ml-1">Reason for Leave</p>
                <div className="rounded-2xl bg-white border border-slate-100 p-4 text-slate-700 text-sm leading-relaxed italic shadow-inner min-h-[60px]">
                  "{viewing.reason || "-"}"
                </div>
              </div>

              {/* Status synchronization info for admin */}
              {mode === "employee" && currentAdmin?.id && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-[11px] text-amber-700 flex items-start gap-2 italic">
                   <AlertCircle size={14} className="shrink-0 mt-0.5" />
                   <span>Admin View: You are viewing an employee's request. Decisions are made by HR/Managers.</span>
                </div>
              )}
            </div>

            {/* Sticky Actions */}
            <div className="px-6 py-4 border-t bg-slate-50/80 backdrop-blur-md flex flex-col sm:flex-row items-center gap-3">
              {viewing.assignedToMe && viewing.status === "Pending" ? (
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => actOnRequest("Rejected")}
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-bold border ${
                      actionLoading === "Rejected"
                        ? "bg-rose-100 text-rose-700 border-rose-200 opacity-80"
                        : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    {actionLoading === "Rejected" ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => actOnRequest("Approved")}
                    className={`w-full px-4 py-3 rounded-2xl text-sm font-bold border ${
                      actionLoading === "Approved"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 opacity-80"
                        : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {actionLoading === "Approved" ? "Approving..." : "Approve"}
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="w-full px-4 py-3 rounded-2xl text-sm font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LeaveManagement;
