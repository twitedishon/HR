import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock4, Eye, Shield } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY, formatTimeHHMM } from "../../lib/dateUtils";
import { getManagerSession } from "./managerData"; // viewer session helper (same file you used)

/* ===================== CONFIG ===================== */
const APPROVERS_TABLE = "hrmss_approvers";
const LEAVES_TABLE = "hrmss_leave_requests";

/**
 * ✅ Viewer should see the same requests that were sent to the APPROVER manager.
 * If your viewer session can provide viewForEmail, it will use that.
 * Otherwise it falls back to this:
 */
const DEFAULT_APPROVER_EMAIL_TO_VIEW = "manager1@hrms.com";

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

export default function ManagerApprovalsViewer() {
  // viewer session should contain: { name, role/access, email, id }
  // ✅ optionally add: viewForEmail: "manager1@hrms.com"
  const session =
    getManagerSession() || {
      name: "Manager",
      role: "viewer", // viewer
      access: "viewer",
      email: "",
      id: null,
      viewForEmail: DEFAULT_APPROVER_EMAIL_TO_VIEW, // fallback
    };

  // ✅ viewer cannot act
  const canAct = false;

  // ✅ target approver id to view (NOT viewer id)
  const [targetApproverId, setTargetApproverId] = useState(null);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /* ---------------- Resolve APPROVER manager id to view ---------------- */
  const resolveTargetApproverId = async () => {
    setErr("");

    // 1) if session already provides the target id
    if (session.viewForId) {
      setTargetApproverId(session.viewForId);
      return session.viewForId;
    }

    // 2) resolve by email (preferred)
    const email =
      (session.viewForEmail || DEFAULT_APPROVER_EMAIL_TO_VIEW || "").trim().toLowerCase();

    if (email) {
      const { data, error } = await supabase
        .from(APPROVERS_TABLE)
        .select("id,email,access,active,role")
        .eq("email", email)
        .eq("active", true)
        .maybeSingle();

      if (!error && data?.id) {
        setTargetApproverId(data.id);
        return data.id;
      }
    }

    // 3) fallback: pick first active manager approver (if email not matched)
    const { data: list, error: listErr } = await supabase
      .from(APPROVERS_TABLE)
      .select("id,name,role,access,active")
      .eq("active", true)
      .eq("access", "approver")
      .order("name", { ascending: true });

    if (listErr) {
      setErr(listErr.message);
      return null;
    }

    const first = (list || []).find((x) => String(x.role || "").toLowerCase() === "manager") || list?.[0];

    if (!first?.id) {
      setErr("Approver manager id not found. Add manager1@hrms.com in hrmss_approvers (active=true, access='approver').");
      return null;
    }

    setTargetApproverId(first.id);
    return first.id;
  };

  /* ---------------- Fetch requests for target approver only ---------------- */
  const fetchRequests = async (approverId) => {
    setLoading(true);
    setErr("");

    if (!approverId) {
      setRequests([]);
      setLoading(false);
      setErr("Approver id not resolved for viewer.");
      return;
    }


    const { data: allData, error } = await supabase
      .from(LEAVES_TABLE)
      .select("*")
      .order("applied_at", { ascending: false });

    if (error) {
      setRequests([]);
      setLoading(false);
      setErr(error.message);
      return;
    }


    // 1) Group by applied_at
    const groups = new Map();
    (allData || []).forEach((row) => {
      const key = `${row.applied_at}_${row.owner_id}_${(row.reason || "").slice(0, 20)}`;
      if (!groups.has(key)) {
        groups.set(key, { ...row, recipients: [] });
      }
      groups.get(key).recipients.push({
        id: row.request_to_id,
        name: row.request_to_name,
        role: row.request_to_role,
        status: row.status,
        dbId: row.id,
      });
    });

    // 2) Filter groups: Only include if THIS manager is one of the recipients
    const filteredGroups = Array.from(groups.values()).filter((g) =>
      g.recipients.some((rt) => String(rt.id) === String(approverId))
    );

    const mapped = filteredGroups.map((r) => {
      const mode = r.mode || "";
      const tf = shortTime(r.time_from);
      const tt = shortTime(r.time_to);

      return {
        id: r.id,
        employee: r.owner_name || "-",
        type: `${r.leave_type || "-"} • ${mode || "-"}`,
        dates: fmtRange(r.from_date, r.to_date),

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

        requestToName: r.request_to_name,

        recipients: r.recipients,
      };
    });

    setRequests(mapped);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const id = await resolveTargetApproverId();
      await fetchRequests(id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ optional realtime refresh (viewer also sees updates)
  useEffect(() => {
    if (!targetApproverId) return;

    const channel = supabase
      .channel("viewer_leave_requests_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: LEAVES_TABLE },
        () => fetchRequests(targetApproverId)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetApproverId]);

  const metrics = useMemo(() => {
    const pending = requests.filter((r) => r.status === "Pending").length;
    const approved = requests.filter((r) => r.status === "Approved").length;
    return { pending, approved };
  }, [requests]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-indigo-50 p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-indigo-900 font-semibold text-lg">
          <Shield size={18} /> Leave Approvals (Viewer)
        </div>

        <p className="text-sm text-indigo-800/80">
          Viewer manager has read-only visibility. Approver manager actions will reflect here automatically.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full text-indigo-800 font-semibold border border-indigo-200">
            <Clock4 size={14} /> Pending: {metrics.pending}
          </span>

          <span className="inline-flex items-center gap-1 bg-emerald-100 px-3 py-1 rounded-full text-emerald-700 font-semibold border border-emerald-200">
            <Check size={14} /> Approved: {metrics.approved}
          </span>

          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full font-semibold bg-slate-100 text-slate-600">
            Role: View only
          </span>

          {targetApproverId ? (
            <span className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full text-slate-700 font-semibold border border-slate-200">
              Viewing Approver ID: {String(targetApproverId).slice(0, 8)}…
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
          <div className="rounded-2xl border p-4 bg-white text-sm text-slate-600">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border p-4 bg-white text-sm text-slate-600">
            No requests found for this approver.
          </div>
        ) : (
          requests.map((req) => {
            const showTime = needsTime(req.mode);

            return (
              <div key={req.id} className="rounded-2xl border p-4 bg-white shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{req.employee}</p>
                    <p className="text-xs text-slate-500 truncate">{req.type}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Applied: {fmtDT(req.appliedAt).date} {fmtDT(req.appliedAt).time}
                    </p>
                  </div>

                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${statusTone[req.status]}`}>
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
                      <span className="font-semibold">{req.timeFrom || "--:--"}</span> →{" "}
                      <span className="font-semibold">{req.timeTo || "--:--"}</span>
                      {req.hours ? <span className="text-slate-500"> • {req.hours}</span> : null}
                    </p>
                  ) : null}

                  <p className="mt-1">
                    <span className="font-semibold">Reason:</span> {req.reason}
                  </p>

                  <p className="text-xs text-slate-500 mt-1">
                    From: {req.ownerRole} • {req.ownerId}
                  </p>


                  <div className="text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700 underline">Sent To:</span>{" "}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {req.recipients?.map((rt, idx) => (
                        <span key={idx} className="bg-slate-50 border px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-700">
                          {rt.role?.toUpperCase() || "MANAGER"}: {rt.name || "-"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {req.decidedBy ? (
                  <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Check size={14} /> Updated by {req.decidedBy} {req.decidedAt ? `at ${req.decidedAt}` : ""}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <button
                    disabled
                    className="rounded-xl px-3 py-2 text-xs font-semibold border bg-slate-100 text-slate-500 cursor-not-allowed"
                  >
                    Approve
                  </button>

                  <button
                    disabled
                    className="rounded-xl px-3 py-2 text-xs font-semibold border bg-slate-100 text-slate-500 cursor-not-allowed"
                  >
                    Reject
                  </button>

                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Eye size={14} /> View only (no actions)
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-2xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600 flex gap-2 items-start">
        <AlertCircle size={16} className="text-amber-600 mt-0.5" />
        <div>
          Viewer account shows real DB data for the approver manager. If nothing appears, check:
          <ul className="list-disc ml-5 mt-2 text-xs">
            <li>`hrmss_approvers` has manager1@hrms.com with active=true & access='approver'</li>
            <li>RLS SELECT policy allows viewer to SELECT approvers and leave requests</li>
            <li>Leave rows have `request_to_id` set correctly</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
