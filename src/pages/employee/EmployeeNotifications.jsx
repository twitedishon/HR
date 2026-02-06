import { useEffect, useMemo, useState } from "react";
import { Bell, Info, Clock3, RefreshCw, Eye, X } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const TABLE = "employee_notifications";

const tone = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-100",
  approve: "bg-emerald-50 text-emerald-800 border-emerald-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  error: "bg-rose-50 text-rose-800 border-rose-100",
  reject: "bg-rose-50 text-rose-800 border-rose-100",
  info: "bg-blue-50 text-blue-800 border-blue-100",
};

export default function EmployeeNotifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [viewingNotif, setViewingNotif] = useState(null); // ✅ Modal state

  const fetchNotifications = async () => {
    try {
      setErr("");
      setLoading(true);

      let authUserId = null;
      let employeeId = null;

      // Strategy 1: Try Supabase Auth (for HR, Admin, Manager roles)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (!userErr && userData?.user?.id) {
        authUserId = userData.user.id;
      }

      // Strategy 2: Try localStorage for employee_id (for Employee role)
      try {
        const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
        if (authSession) {
          const parsed = JSON.parse(authSession);
          employeeId = parsed?.employee_id || parsed?.identifier || parsed?.empId || null;
        }
      } catch { }

      // Strategy 3: Try legacy employee signin key
      if (!employeeId) {
        try {
          const legacySession = localStorage.getItem("hrmss.employee.signin");
          if (legacySession) {
            const parsed = JSON.parse(legacySession);
            employeeId = parsed?.employee_id || parsed?.identifier || parsed?.empId || null;
          }
        } catch { }
      }

      // Collect all possible user IDs to query
      const userIds = [authUserId, employeeId].filter(Boolean);

      if (userIds.length === 0) {
        setErr("Please sign in to view notifications.");
        setRows([]);
        setLoading(false);
        return;
      }

      console.log("EmployeeNotifications: Fetching notifications for user_ids:", userIds);

      // Query with .in() to match notifications by EITHER auth UUID OR employee_id
      const response = await supabase
        .from(TABLE)
        .select("id,title,message,category,type,priority,route,unread,created_at")
        .in("user_id", userIds)
        .order("created_at", { ascending: false });

      console.log("EmployeeNotifications: Raw Supabase response:", response);

      if (response.error) {
        console.error("EmployeeNotifications: Supabase error:", response.error);
        throw response.error;
      }

      const data = response.data;
      console.log("EmployeeNotifications: Found", data?.length || 0, "notifications, data:", data);
      setRows(data || []);
    } catch (e) {
      setErr(e?.message || "Failed to load notifications");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Mark as read with optimistic update and custom event dispatch
  const markRead = async (id) => {
    if (!id) return;

    // Check if this notification is currently unread
    const notification = rows.find(n => n.id === id);
    if (!notification?.unread) return;

    // ✅ Optimistic update
    setRows((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));

    // ✅ Dispatch custom event for immediate count sync in layout
    window.dispatchEvent(new CustomEvent("employeeNotificationRead"));

    const { error } = await supabase
      .from(TABLE)
      .update({ unread: false })
      .eq("id", id);

    if (error) {
      console.warn("[EmployeeNotifications] Error marking as read:", error);
      // Revert optimistic update on error
      setRows((prev) => prev.map((n) => (n.id === id ? { ...n, unread: true } : n)));
    }
  };

  // ✅ View notification - opens modal and marks as read
  const viewNotification = async (n) => {
    setViewingNotif(n);
    if (n.unread) {
      await markRead(n.id);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const unread = rows.filter((n) => n.unread).length;
    return { total, unread, read: total - unread };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-blue-50 p-3">
            <Bell className="text-blue-700" size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
            <p className="text-sm text-slate-500 mt-1">
              Stay updated with your latest alerts and announcements.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchNotifications}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Stat label="Total" value={stats.total} />
          <Stat label="Unread" value={stats.unread} />
          <Stat label="Read" value={stats.read} />
        </div>
      </div>

      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{err}</div>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">Loading notifications...</div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map((n) => {
            // ✅ Convert type to display label
            let typeLabel = n.type || "info";
            let displayLabel = typeLabel;
            if (typeLabel === "success" || typeLabel === "approve") displayLabel = "Approved";
            if (typeLabel === "error" || typeLabel === "reject") displayLabel = "Rejected";
            if (typeLabel === "warning") displayLabel = "Pending";
            if (typeLabel === "info") displayLabel = "Info";

            const toneCls = tone[typeLabel] || tone.info;

            return (
              <div
                key={n.id}
                className={`rounded-2xl border p-4 shadow-sm ${toneCls} ${n.unread ? "ring-1 ring-blue-100" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-white/60 backdrop-blur-sm shadow-sm`}>
                        {displayLabel.toUpperCase()}
                      </span>
                      {n.category ? <span className="text-slate-500">· {n.category}</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">{n.title || "Notification"}</p>
                    {n.message ? <p className="text-sm text-slate-700 mt-1">{n.message}</p> : null}
                    <div className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <Clock3 size={12} /> {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        viewNotification(n);
                      }}
                      className={`text-xs font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-lg border transition ${n.unread
                        ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      <Eye size={12} />
                      View
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ VIEW NOTIFICATION MODAL */}
      {viewingNotif && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setViewingNotif(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 grid place-items-center">
                  <Bell size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-white/70">{viewingNotif.category || "Notification"}</p>
                  <p className="text-sm font-bold text-white">
                    {(() => {
                      const t = (viewingNotif.type || "info").toLowerCase();
                      if (t === "success" || t === "approve") return "APPROVED";
                      if (t === "error" || t === "reject") return "REJECTED";
                      if (t === "warning") return "PENDING";
                      return "INFO";
                    })()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingNotif(null)}
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 grid place-items-center transition"
              >
                <X size={16} className="text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{viewingNotif.title || "Notification"}</h3>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{viewingNotif.message || "-"}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock3 size={14} />
                <span>{viewingNotif.created_at ? new Date(viewingNotif.created_at).toLocaleString() : "-"}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex items-center justify-between gap-3">
              <button
                onClick={() => setViewingNotif(null)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Close
              </button>
              {viewingNotif.route && (
                <a
                  href={viewingNotif.route}
                  onClick={() => setViewingNotif(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Go to Details
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-white p-8 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
        <Info size={24} />
      </div>
      <p className="font-semibold text-slate-900">All caught up!</p>
      <p className="text-sm text-slate-500 max-w-xs mx-auto">
        You don't have any new notifications at the moment. We'll let you know when something comes up.
      </p>
    </div>
  );
}
