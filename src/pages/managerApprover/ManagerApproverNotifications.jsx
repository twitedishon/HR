
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Eye } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const TABLE = "hrmss_notifications";
const ALLOWED_SOURCES = [
  "Employees",
  "Attendance",
  "LeaveManagement",
  "Payroll",
  "Documents",
  "My Profile",
  "Birthday",
];
const AUDIENCE = ["approver", "manager", "all"];

const formatTimeLabel = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

export default function ManagerNotifications() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchNotifications = async () => {
    setLoading(true);
    setErrorMsg("");

    const { data, error } = await supabase
      .from(TABLE)
      .select("id,title,detail,type,source,created_at")
      .in("source", ALLOWED_SOURCES)
      .in("audience", AUDIENCE)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Notifications fetch error:", error);
      setAlerts([]);
      setErrorMsg(error.message || "Failed to load notifications");
    } else {
      const mapped = (data || []).map((n) => ({
        id: n.id,
        title: n.title || n.source || "Notification",
        detail: n.detail || "",
        timeLabel: formatTimeLabel(n.created_at),
        source: n.source || "-",
        type: n.type || "info",
      }));
      setAlerts(mapped);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotificationClick = (notification) => {
    // Navigate to Manager Leave page when clicking LeaveManagement notifications
    if (notification.source === "LeaveManagement") {
      navigate("/manager-approver-dashboard/approvals");
    }
  };

  // Calculate notification count
  const notificationCount = alerts.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-2">
        <div className="relative">
          <Bell className="text-indigo-600" size={18} />
          {notificationCount > 0 && (
            <span className="absolute -top-2 -right-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {notificationCount > 99 ? "99+" : notificationCount}
            </span>
          )}
        </div>
        <div>
          <p className="text-lg font-bold text-slate-900">
            Notifications
            {notificationCount > 0 && (
              <span className="ml-2 text-sm font-medium text-indigo-600">
                ({notificationCount})
              </span>
            )}
          </p>
          <p className="text-sm text-slate-600">View important updates for your team.</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
          <Eye size={14} /> View only
        </span>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600 shadow-sm">
            Loading notifications...
          </div>
        ) : errorMsg ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-rose-600 shadow-sm">
            {errorMsg}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-2xl border bg-white p-4 text-sm text-slate-600 shadow-sm">
            No notifications found.
          </div>
        ) : (
          alerts.map((a) => {
            const isClickable = a.source === "LeaveManagement";
            return (
              <div
                key={a.id}
                onClick={() => handleNotificationClick(a)}
                className={`rounded-2xl border bg-white p-4 shadow-sm flex items-start gap-3 ${isClickable ? "cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors" : ""
                  }`}
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                  <Bell size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900">{a.title}</p>
                    <span className={`text-[11px] rounded-full border px-2.5 py-0.5 ${isClickable ? "text-indigo-600 border-indigo-200 bg-indigo-50" : "text-slate-500"
                      }`}>
                      {a.source}
                    </span>
                    {isClickable && (
                      <span className="text-[10px] text-indigo-500 font-medium">
                        (Click to view)
                      </span>
                    )}
                  </div>
                  {a.detail ? <p className="text-sm text-slate-600">{a.detail}</p> : null}
                  <p className="text-xs text-slate-400 mt-1">{a.timeLabel}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
