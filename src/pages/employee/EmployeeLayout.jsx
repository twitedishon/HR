import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,

  UserCircle2,
  FileText,
  Compass,
} from "lucide-react";

const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";


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

const tabs = [
  { to: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "attendance", icon: ClipboardCheck, label: "Attendance" },
  { to: "leave", icon: CalendarDays, label: "Leave" },
  { to: "documents", icon: FileText, label: "Documents" },
  { to: "payslips", icon: FileText, label: "Payslips" },
  { to: "career-guidance", icon: Compass, label: "Career Ladder" },

  // { to: "/employee-dashboard/people", icon: UserRound, label: "People Directory" },
];

export default function EmployeeLayout() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    if (localStorage.getItem("hrmss.signin.completed.employee") !== "true") {
      navigate("/sign-in", { state: { role: "employee" } });
    }
  }, [navigate]);

  useEffect(() => {
    const fetchCount = async () => {
      let authUserId = null;
      let employeeId = null;

      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id) authUserId = userData.user.id;

      try {
        const authSession = localStorage.getItem("HRMSS_AUTH_SESSION");
        if (authSession) {
          const parsed = JSON.parse(authSession);
          employeeId = parsed?.employee_id || parsed?.identifier || parsed?.empId;
        }
      } catch { }

      if (!employeeId) {
        try {
          const legacy = localStorage.getItem("hrmss.employee.signin");
          if (legacy) {
            const parsed = JSON.parse(legacy);
            employeeId = parsed?.employee_id || parsed?.identifier || parsed?.empId;
          }
        } catch { }
      }

      const userIds = [authUserId, employeeId].filter(Boolean);
      if (userIds.length === 0) return;

      const { count } = await supabase
        .from("employee_notifications")
        .select("*", { count: "exact", head: true })
        .in("user_id", userIds)
        .eq("unread", true);

      setNotifCount(count || 0);
    };

    fetchCount();

    const channel = supabase.channel('employee_layout_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_notifications' }, fetchCount)
      .subscribe();

    return () => supabase.removeChannel(channel);
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
      <aside

        className={`bg-white border-r sticky top-0 h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? "w-[280px]" : "w-[72px]"
          }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className={`p-5 border-b flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div className="text-xl font-extrabold text-gray-900 leading-none">TWITE HRMS</div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-black shadow-sm">T</div>
            )}
          </div>

          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            {tabs.map((item) => (
              <SideItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                end={item.to === "dashboard"}

                isCollapsed={!isSidebarOpen}
              />
            ))}
          </nav>


          <div className="p-3 border-t overflow-hidden">
            <button
              onClick={handleLogout}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-black transition-all ${isSidebarOpen ? 'px-4 py-3' : 'h-10'}`}
              title="Logout"
            >
              <LogOut size={18} />
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
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
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="notifications"
                className={({ isActive }) =>
                  `relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "bg-gray-900 text-white shadow"
                    : "text-gray-700 hover:bg-gray-100"
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
                to="profile"
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "bg-gray-900 text-white shadow"
                    : "text-gray-700 hover:bg-gray-100"
                  }`
                }
              >
                <UserCircle2 size={16} />
                My Profile
              </NavLink>
            </div>
          </div>
        </header>

        <div className="p-6 flex-1">
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
