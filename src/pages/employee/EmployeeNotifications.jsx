import { useEffect, useMemo, useState } from "react";
import { Bell, Info, Clock3, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const TABLE = "employee_notifications";

const tone = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-100",
  warning: "bg-amber-50 text-amber-800 border-amber-100",
  info: "bg-blue-50 text-blue-800 border-blue-100",
};

export default function EmployeeNotifications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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
            const toneCls = tone[n.type] || tone.info;
            return (
              <div
                key={n.id}
                className={`rounded-2xl border p-4 bg-white shadow-sm ${n.unread ? "ring-1 ring-blue-100" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${toneCls}`}>
                        {String(n.type || "info").toUpperCase()}
                      </span>
                      {n.category ? <span className="text-slate-400">· {n.category}</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">{n.title || "Notification"}</p>
                    {n.message ? <p className="text-sm text-slate-600 mt-1">{n.message}</p> : null}
                    <div className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <Clock3 size={12} /> {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                  {n.route ? (
                    <a
                      href={n.route}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
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
