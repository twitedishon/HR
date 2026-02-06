
import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, Menu, UserRound } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const COMPLETION_KEY = "hrmss.signin.completed.admin";
const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";

const NOTIF_TABLE = "hrmss_notifications";

const linkClasses = ({ isActive }) =>
  `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${isActive
    ? "bg-blue-600 text-white shadow"
    : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
  }`;

const Navbar = ({ isSidebarOpen = true, onToggleSidebar }) => {
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isActive = true;
    const READ_KEY = "hrmss.notifications.read.approver";

    const fetchUnread = async () => {
      // Get current user ID from auth session
      let currentUserId = null;
      try {
        const authSession = localStorage.getItem(AUTH_KEY);
        if (authSession) {
          const parsed = JSON.parse(authSession);
          currentUserId = parsed?.employee_id || parsed?.admin_id || parsed?.id || null;
        }
      } catch { }

      // Fetch global notifications for admin/approver employees
      const { data, error } = await supabase
        .from(NOTIF_TABLE)
        .select("id, title, detail")
        .eq("unread", true)
        .in("audience", ["admin", "all"]);

      // ✅ Also fetch personal approval notifications from employee_notifications
      let personalUnreadCount = 0;
      if (currentUserId) {
        const { count, error: personalError } = await supabase
          .from("employee_notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", currentUserId)
          .eq("unread", true);

        if (!personalError && count) {
          personalUnreadCount = count;
        }
      }

      if (isActive && !error && data) {
        // Get locally read IDs
        let readIds = [];
        try {
          const raw = localStorage.getItem(READ_KEY);
          readIds = raw ? JSON.parse(raw) : [];
        } catch { }

        // Filter out HR-related notifications (these should only show for HR users)
        const filteredCount = data.filter(n => {
          // Check if locally read
          if (readIds.includes(n.id)) return false;

          const title = String(n.title || "").toLowerCase();
          const detail = String(n.detail || "").toLowerCase();
          // Exclude HR leave request/approval notifications
          if (title.includes("hr") || detail.includes("hr sent") || detail.includes("hr admin")) {
            return false;
          }
          return true;
        }).length;

        // ✅ Combine global notifications count with personal notifications count
        setUnreadCount(filteredCount + personalUnreadCount);
      } else if (isActive) {
        // If global query fails, at least show personal notification count
        setUnreadCount(personalUnreadCount);
      }
    };

    fetchUnread();
    const intervalId = setInterval(fetchUnread, 60_000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // noop: fallback to local cleanup
    }

    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(COMPLETION_KEY);
    try {
      sessionStorage.removeItem(DOCS_AUTH_KEY);
    } catch { }
    localStorage.removeItem(DOCS_AUTH_KEY);
    navigate("/login", { replace: true });
  };

  return (
    <header className="h-14 bg-white border-b flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-gray-700 shadow-sm hover:bg-gray-50"
          aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
          title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          <Menu size={18} />
        </button>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <NavLink to="/dashboard/notifications" className={linkClasses}>

          <span className="relative inline-flex items-center gap-2">
            <Bell size={16} />
            Notifications
            {unreadCount > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </span>
        </NavLink>
        <NavLink to="/dashboard/profile" className={linkClasses}>
          <UserRound size={16} />
          My Profile
        </NavLink>
        <button
          onClick={handleLogout}
          className="px-3 py-1 text-xs rounded-md border border-gray-300 hover:bg-gray-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;
