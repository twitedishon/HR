
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
      .select("id,title,detail,type,source,created_at,unread")
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
        unread: n.unread,
      }));
      setAlerts(mapped);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (notification.unread) {
      // ✅ Optimistic update - immediately update local state
      setAlerts((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, unread: false } : n))
      );

      // ✅ Dispatch custom event to sync notification count in layout immediately
      window.dispatchEvent(new CustomEvent("notificationRead", { detail: { id: notification.id } }));

      const { error } = await supabase
        .from(TABLE)
        .update({ unread: false })
        .eq("id", notification.id);

      if (error) {
        console.warn("[ManagerNotifications] Failed to mark notification as read:", error);
        // Revert optimistic update on error
        setAlerts((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, unread: true } : n))
        );
      }
    }

    // Navigate to Manager Leave page when clicking LeaveManagement notifications
    if (notification.source === "LeaveManagement") {
      navigate("/manager-approver-dashboard/approvals");
    }
  };

  // Calculate notification count
  const notificationCount = alerts.filter((a) => a.unread).length;

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

            // Try to parse the detail for cleaner display
            // Format 1: "X submitted a Y request for Z."
            // Format 2: "HR sent a Y request for X (Z) for your approval."
            let primaryText = a.detail;
            let secondaryText = "";
            let tertiaryText = "";

            const submittedMatch = a.detail.match(/^(.+?) submitted a (.+?) request for (.+?)(\.|$)/i);
            const hrMatch = a.detail.match(/^HR sent a (.+?) request for (.+?) \((.+?)\) for your approval/i);

            if (submittedMatch) {
              primaryText = submittedMatch[1]; // Name
              secondaryText = submittedMatch[2]; // Type
              tertiaryText = submittedMatch[3]; // Dates
            } else if (hrMatch) {
              primaryText = hrMatch[2]; // Name
              secondaryText = hrMatch[1]; // Type
              tertiaryText = hrMatch[3]; // Dates
            }

            return (
              <div
                key={a.id}
                onClick={() => handleNotificationClick(a)}
                className={`rounded-2xl border p-4 shadow-sm flex items-start gap-3 transition-all duration-200 ${a.unread
                    ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100"
                    : "bg-white border-gray-200"
                  } ${isClickable ? "cursor-pointer hover:bg-slate-100" : ""}`}
              >
                <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${a.unread
                    ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                    : "bg-slate-50 border-slate-100 text-slate-500"
                  }`}>
                  <Bell size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  {secondaryText ? (
                    // Parsed View
                    <div className="flex flex-col gap-0.5">
                      <p className="font-bold text-slate-900 leading-tight">
                        {primaryText}
                      </p>
                      <p className="text-xs text-slate-600 font-medium">
                        {secondaryText}
                      </p>
                      <p className="text-xs text-slate-500">
                        {tertiaryText}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">
                        {a.timeLabel}
                      </p>
                    </div>
                  ) : (
                    // Default View (fallback)
                    <>
                      <p className="text-sm font-semibold text-slate-900 mb-1">{a.title}</p>
                      <p className="text-xs text-slate-600 mb-1">{a.detail}</p>
                      <p className="text-[10px] text-slate-400">{a.timeLabel}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
