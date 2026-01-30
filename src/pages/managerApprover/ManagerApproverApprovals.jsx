import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock4, Eye, Shield } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY, formatTimeHHMM } from "../../lib/dateUtils";

import { getManagerSession } from "./managerApproverData";
import {
  notifyEmployee,
  notifyHRAboutDecision,
} from "../../lib/notificationUtils";

/* ===================== CONFIG ===================== */
const APPROVERS_TABLE = "hrmss_approvers";
const LEAVES_TABLE = "hrmss_leave_requests";

const EMP_NOTIF_TABLE = "employee_notifications";

const statusTone = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

/* ===================== HELPERS ===================== */
const normMode = (m) =>
  String(m || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const needsTime = (m) => {
  const x = normMode(m);
  return x === "half day" || x === "permission";
};

const shortTime = (t) => {
  if (!t) return "";
  const s = String(t);
  // "09:00:00" / "09:00:00+00" => "09:00"
  return s.length >= 5 ? s.slice(0, 5) : s;
};

const isDmy = (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);
const formatDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (isDmy(raw)) return raw;
  const formatted = formatDDMMYYYY(raw);
  return formatted === "-" ? raw : formatted;
};

const fmtDT = (iso) => {
  if (!iso) return { date: "-", time: "-" };
  return {
    date: formatDDMMYYYY(iso),
    time: formatTimeHHMM(iso),
  };
};

const fmtRange = (from, to) => {
  if (!from && !to) return "-";
  if (!to || to === from) return formatDateValue(from);
  return `${formatDateValue(from)} → ${formatDateValue(to)}`;
};

export default function ManagerApprovals() {
  // session should contain at least: { name, role/access, email, id }
  const rawSession = getManagerSession() || {
    name: "Manager",

    role: "manager",
    access: "approver",
    email: "",
    id: null,
  };

  const session = rawSession;

  const access = session.access || session.role;

  // canAct only if approver
  const canAct = access === "approver";

  const [managerId, setManagerId] = useState(session.id || null);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* ---------------- Resolve manager id (if missing) ---------------- */
  const resolveManagerIdIfNeeded = async () => {
    if (managerId) return managerId;

    const email = (session.email || "").trim().toLowerCase();
    if (!email) return null;

    const { data, error } = await supabase
      .from(APPROVERS_TABLE)
      .select("id")
      .eq("email", email)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.warn(error.message);
      return null;
    }

    const id = data?.id || null;
    if (id) setManagerId(id);
    return id;
  };

  /* ---------------- Fetch requests for this manager only ---------------- */
  const fetchRequests = async (mgrId) => {
    setErr("");
    setLoading(true);

    if (!mgrId) {
      setRequests([]);
      setLoading(false);
      setErr("Manager id not found. (session.id or session.email needed)");
      return;
    }

    const { data, error } = await supabase
      .from(LEAVES_TABLE)
      .select(
        `
        id,
        owner_role,
        owner_id,
        owner_name,
        request_to_id,
        request_to_name,
        request_to_role,
        leave_type,
        mode,
        from_date,
        to_date,
        time_from,
        time_to,
        hours,
        reason,
        status,
        applied_at,
        decided_at,
        decided_by_name,
        decision_note
      `
      )
      .eq("request_to_id", mgrId) // ✅ IMPORTANT FILTER
      .order("applied_at", { ascending: false });

    if (error) {
      setRequests([]);
      setLoading(false);
      setErr(error.message);
      return;
    }

    const mapped = (data || []).map((r) => {
      const mode = r.mode || "";
      const tf = shortTime(r.time_from);
      const tt = shortTime(r.time_to);

      return {
        id: r.id,

        // UI
        employee: r.owner_name || "-",
        type: `${r.leave_type || "-"} • ${mode || "-"}`,
        dates: fmtRange(r.from_date, r.to_date),

        // Extra
        mode,
        timeFrom: tf,
        timeTo: tt,
        hours: r.hours || "",
        reason: r.reason || "-",
        status: r.status || "Pending",

        appliedAt: r.applied_at,
        decidedAt: r.decided_at,
        decidedBy: r.decided_by_name,
        decisionNote: r.decision_note,

        ownerRole: r.owner_role,
        ownerId: r.owner_id,

        ownerName: r.owner_name,
        leaveType: r.leave_type,
        fromDate: r.from_date,
        toDate: r.to_date,

        requestToName: r.request_to_name,
      };
    });

    // Deduplicate by grouping similar requests (same applied_at, ownerId, and reason prefix)
    const deduped = [];
    const seenKeys = new Set();
    for (const r of mapped) {
      const key = `${r.appliedAt || ""}_${r.ownerId || ""}_${(r.reason || "").slice(0, 20)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduped.push(r);
      }
    }

    setRequests(deduped);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const id = await resolveManagerIdIfNeeded();
      await fetchRequests(id || managerId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo(() => {
    const pending = requests.filter((r) => r.status === "Pending").length;
    const approved = requests.filter((r) => r.status === "Approved").length;
    return { pending, approved };
  }, [requests]);

  /* ---------------- Approve / Reject ---------------- */
  const handleAction = async (rowId, nextStatus) => {
    if (!canAct) return;


    const requestRecord = requests.find((r) => r.id === rowId);
    if (!requestRecord) return;

    const payload = {
      status: nextStatus,
      decided_at: new Date().toISOString().slice(0, 10),
      decided_by_id: managerId ? String(managerId) : String(session.id || ""),
      decided_by_name: session.name || "Manager",

    };

    const { error } = await supabase
      .from(LEAVES_TABLE)
      .update(payload)
      .eq("id", rowId);
    if (error) return alert(error.message);

    // ✅ Also update admin_leaves table if this is an admin's leave request
    // This ensures the approver employee's leave management page shows the correct status
    const ownerRoleForUpdate = String(requestRecord.ownerRole || "").toLowerCase();
    if (ownerRoleForUpdate === "admin" && requestRecord.ownerId) {
      try {
        const { error: adminLeaveErr } = await supabase
          .from("admin_leaves")
          .update({
            status: nextStatus,
            decided_at: new Date().toISOString().slice(0, 10),
            decided_by_name: session.name || "Manager",
          })
          .eq("admin_id", requestRecord.ownerId)
          .eq("from_date", requestRecord.fromDate)
          .eq("status", "Pending");

        if (adminLeaveErr) {
          console.warn("admin_leaves update error:", adminLeaveErr);
        } else {
          console.log("admin_leaves status updated for:", requestRecord.ownerId);
        }
      } catch (e) {
        console.warn("admin_leaves update failed:", e);
      }
    }

    try {
      // ✅ Notify based on owner role
      const ownerRole = String(requestRecord.ownerRole || "").toLowerCase();

      if (ownerRole === "employee") {
        // Notify the employee about the decision
        await notifyEmployee({
          ownerId: requestRecord.ownerId,
          status: nextStatus,
          leaveType: requestRecord.leaveType || "Leave Request",
        });
      } else if (ownerRole === "admin") {
        // ✅ Notify the approver employee (admin) about the decision
        // Insert to hrmss_notifications table (which ApproverEmployeeNotifications reads from)
        const detail =
          nextStatus === "Approved"
            ? `Your ${requestRecord.leaveType || "Leave"} request was approved.`
            : nextStatus === "Rejected"
              ? `Your ${requestRecord.leaveType || "Leave"} request was rejected.`
              : `Your ${requestRecord.leaveType || "Leave"} request was updated.`;

        const notificationData = {
          title: `Leave Request ${nextStatus}`,
          detail: `[ADMIN-SELF] ${detail}`, // Marker to identify admin's own leave notification
          type:
            nextStatus === "Approved"
              ? "success"
              : nextStatus === "Rejected"
                ? "warning"
                : "info",
          source: "LeaveManagement",
          route: "/dashboard/leave",
          audience: "admin",
          unread: true,
        };

        console.log("[ManagerApproverApprovals] Inserting admin notification:", notificationData);

        const { error: notifErr, data: insertedData } = await supabase
          .from("hrmss_notifications")
          .insert(notificationData)
          .select();

        if (notifErr) {
          console.warn("[ManagerApproverApprovals] Admin notification insert error:", notifErr);
        } else {
          console.log("[ManagerApproverApprovals] Admin notification inserted successfully:", insertedData);
        }
      } else if (ownerRole === "hr") {
        // ✅ Look up HR's email from hrmss_hr_sessions or fallback to ID
        let hrEmail = "";
        try {
          const { data: hrData } = await supabase
            .from("hrmss_hr_sessions")
            .select("email")
            .eq("employee_id", requestRecord.ownerId)
            .maybeSingle();
          hrEmail = hrData?.email || "";
        } catch {
          // Ignore lookup errors
        }

        // Notify the HR who submitted the request
        await notifyHRAboutDecision({
          managerName: session.name || "Manager",
          employeeName: requestRecord.ownerName || "HR",
          leaveType: requestRecord.leaveType || "Leave",
          status: nextStatus,
          fromDate: requestRecord.fromDate || "",
          toDate: requestRecord.toDate || "",
          decisionNote: requestRecord.decisionNote || "",
          requesterEmail: hrEmail, // ✅ Target only the specific HR
        });
      }
    } catch (e) {
      console.warn("Notification failed", e);
    }

    // refresh
    await fetchRequests(managerId);
  };


  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-indigo-50 p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-indigo-900 font-semibold text-lg">
          <Shield size={18} /> Leave Approvals
        </div>

        <p className="text-sm text-indigo-800/80">

          Two managers sign in with separate IDs. Only the approver can approve
          or reject; the second manager has read-only visibility.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full text-indigo-800 font-semibold border border-indigo-200">
            <Clock4 size={14} /> Pending: {metrics.pending}
          </span>

          <span className="inline-flex items-center gap-1 bg-emerald-100 px-3 py-1 rounded-full text-emerald-700 font-semibold border border-emerald-200">
            <Check size={14} /> Approved: {metrics.approved}
          </span>

          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold ${canAct
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-slate-100 text-slate-600"
              }`}
          >
            Role: {canAct ? "Approver" : "View only"}
          </span>

          {managerId ? (
            <span className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full text-slate-700 font-semibold border border-slate-200">
              Manager ID: {String(managerId).slice(0, 8)}…
            </span>
          ) : null}
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex gap-2 items-start">
          <AlertCircle size={16} className="mt-0.5" />
          <div>{err}</div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (

          <div className="rounded-2xl border p-4 bg-white text-sm text-slate-600">
            Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border p-4 bg-white text-sm text-slate-600">
            No requests found for this manager.
          </div>
        ) : (
          requests.map((req) => {
            const showTime = needsTime(req.mode);

            return (

              <div
                key={req.id}
                className="rounded-2xl border p-4 bg-white shadow-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {req.employee}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {req.type}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Applied: {fmtDT(req.appliedAt).date}{" "}
                      {fmtDT(req.appliedAt).time}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${statusTone[req.status]
                      }`}
                  >
                    {req.status}
                  </span>
                </div>

                <div className="text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Dates:</span> {req.dates}
                  </p>

                  {showTime ? (
                    <p className="mt-1 text-xs text-slate-700">
                      <span className="font-semibold">Time:</span>{" "}

                      <span className="font-semibold">
                        {req.timeFrom || "--:--"}
                      </span>{" "}
                      →{" "}
                      <span className="font-semibold">
                        {req.timeTo || "--:--"}
                      </span>
                      {req.hours ? (
                        <span className="text-slate-500"> • {req.hours}</span>
                      ) : null}
                    </p>
                  ) : null}

                  <p className="mt-1">
                    <span className="font-semibold">Reason:</span> {req.reason}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    From: {req.ownerRole} • {req.ownerId}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    Request To: Manager • {req.requestToName || "-"}
                  </p>
                </div>

                {req.decidedBy ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">

                    <Check size={14} /> Updated by {req.decidedBy}{" "}
                    {req.decidedAt ? `at ${req.decidedAt}` : ""}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    disabled={!canAct || req.status !== "Pending"}
                    onClick={() => handleAction(req.id, "Approved")}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold border ${!canAct || req.status !== "Pending"
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                  >
                    Approve
                  </button>

                  <button
                    disabled={!canAct || req.status !== "Pending"}
                    onClick={() => handleAction(req.id, "Rejected")}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold border ${!canAct || req.status !== "Pending"
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                      : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      }`}
                  >
                    Reject
                  </button>

                  {!canAct && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Eye size={14} /> View only (no actions)
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!canAct && (
        <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600 flex gap-2 items-start">
          <AlertCircle size={16} className="text-amber-600 mt-0.5" />
          <div>

            You are logged in as the view-only manager. To approve or reject,
            sign in with the approver manager ID.
          </div>
        </div>
      )}
    </div>
  );
}
