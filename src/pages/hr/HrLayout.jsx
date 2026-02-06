import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

import { LayoutDashboard, CalendarDays, ClipboardList, LogOut, UserRound, Bell, WalletCards, FileText, Menu, Users, ChevronDown, ChevronRight, Cake } from "lucide-react";

const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";

const TABLE = "hrmss_notifications";
const AUDIENCE = ["hr", "all"];
const ALLOWED_SOURCES = [
  "Employees",
  "Attendance",
  "LeaveManagement",
  "Payroll",
  "Documents",
  "My Profile",
  "Birthday",
];

const SideItem = ({ to, icon: Icon, label, end, isCollapsed }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>

      `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive
        ? "bg-purple-700 text-white shadow"
        : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
      }`
    }
  >

    <Icon size={18} className="shrink-0" />
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export default function HrLayout() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notifCount, setNotifCount] = useState(0);

  const [isCelebrationsOpen, setIsCelebrationsOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("hrmss.signin.completed.hr") !== "true") {
      navigate("/sign-in", { state: { role: "hr" } });
    }
  }, [navigate]);

  useEffect(() => {
    const fetchCount = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      const { count: globalCount } = await supabase
        .from(TABLE)
        .select("*", { count: "exact", head: true })
        .in("source", ALLOWED_SOURCES)
        .in("audience", AUDIENCE)
        .eq("unread", true);

      let personalCount = 0;
      if (userId) {
        const { count } = await supabase
          .from("employee_notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("unread", true);
        personalCount = count || 0;
      }

      setNotifCount((globalCount || 0) + personalCount);
    };

    fetchCount();

    const channel = supabase.channel('hr_layout_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, fetchCount)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_notifications' }, fetchCount)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // ✅ Listen for custom event when notification is viewed (immediate sync)
  useEffect(() => {
    const handleNotificationRead = () => {
      console.log("[HrLayout] hrNotificationRead event received - decrementing count");
      setNotifCount((prev) => Math.max(0, prev - 1));
    };

    window.addEventListener("hrNotificationRead", handleNotificationRead);
    return () => {
      window.removeEventListener("hrNotificationRead", handleNotificationRead);
    };
  }, []);

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(DOCS_AUTH_KEY);
    } catch { }
    localStorage.removeItem(DOCS_AUTH_KEY);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* SIDEBAR */}
      <aside

        className={`bg-white border-r sticky top-0 h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-[280px]" : "w-[72px]"
          }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Brand */}
          <div className={`p-5 border-b flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div>
                <div className="text-xl font-extrabold text-gray-900 leading-none">TWITE HRMS</div>
                <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wider">Human Resource</div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-purple-700 text-white flex items-center justify-center font-black shadow-sm shadow-purple-200 transition-all duration-300">H</div>
            )}
          </div>

          {/* Nav */}
          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            <SideItem to="/hr-dashboard" end icon={LayoutDashboard} label="Dashboard" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/employees" icon={Users} label="Employees" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/leave" icon={CalendarDays} label="Leave Management" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/calendar" icon={CalendarDays} label="Calendar" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/attendance" icon={ClipboardList} label="Attendance" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/payroll" icon={WalletCards} label="Payroll" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/payslips" icon={FileText} label="Payslips" isCollapsed={!isSidebarOpen} />
            <SideItem to="/hr-dashboard/documents" icon={FileText} label="Documents" isCollapsed={!isSidebarOpen} />

            {/* Employee Celebrations Dropdown */}
            <div>
              <button
                onClick={() => {
                  if (!isSidebarOpen) setIsSidebarOpen(true);
                  setIsCelebrationsOpen(!isCelebrationsOpen);
                }}
                className={`w-full flex items-center ${!isSidebarOpen ? 'justify-center' : 'justify-between'} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 text-gray-700 hover:bg-purple-50 hover:text-purple-700`}
              >
                <div className={`flex items-center ${!isSidebarOpen ? 'justify-center' : 'gap-3'}`}>
                  <Cake size={18} className="shrink-0" />
                  {isSidebarOpen && <span className="truncate">Employee Celebrations</span>}
                </div>
                {isSidebarOpen && (
                  isCelebrationsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>

              {/* Sub-menu */}
              {isSidebarOpen && isCelebrationsOpen && (
                <div className="pl-11 pr-2 space-y-1 mt-1">
                  <NavLink
                    to="/hr-dashboard/people"
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                        ? "bg-purple-100 text-purple-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`
                    }
                  >
                    Birthdays
                  </NavLink>
                  <NavLink
                    to="/hr-dashboard/work-anniversary"
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                        ? "bg-purple-100 text-purple-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`
                    }
                  >
                    Work Anniversary
                  </NavLink>
                </div>
              )}
            </div>
          </nav>

          {/* Logout */}
          <div className="p-3 border-t overflow-hidden">
            <button
              onClick={handleLogout}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 text-white text-sm font-semibold hover:bg-purple-800 transition-all ${isSidebarOpen ? 'px-4 py-3' : 'h-10'}`}
              title="Logout"
            >
              <LogOut size={18} />
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-w-0">
        {/* Optional: top bar in content area */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <Menu size={18} />
              </button>
              <div className="text-sm text-gray-500">HR Dashboard</div>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="/hr-dashboard/notifications"
                className={({ isActive }) =>
                  `relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "bg-purple-700 text-white shadow"
                    : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                  }`
                }
              >
                <Bell size={16} />
                Notifications
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-bold">
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                )}
              </NavLink>
              <NavLink
                to="/hr-dashboard/profile"
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "bg-purple-700 text-white shadow"
                    : "text-gray-700 hover:bg-purple-50 hover:text-purple-700"
                  }`
                }
              >
                <UserRound size={16} />
                My Profile
              </NavLink>
            </div>
          </div>
        </header>

        <div className="p-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
