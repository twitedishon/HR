
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckSquare,
  FileSpreadsheet,
  Home,
  Layers,
  Settings,
  ShieldCheck,
  Users,
  UserRound,

  Menu,
  LogOut,
} from "lucide-react";

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";
const COMPLETION_KEY = "hrmss.signin.completed.admin-head";

const SideItem = ({ to, icon: Icon, label, end, isCollapsed }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>

      `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
        isActive
          ? "bg-indigo-700 text-white shadow"
          : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
      }`
    }
  >

    <Icon size={18} className="shrink-0" />
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

const items = [

  { to: "/admin-head", end: true, icon: Home, label: "Dashboard" },
  { to: "/admin-head/leave", icon: Layers, label: "Leave management" },
  { to: "/admin-head/attendance", icon: Activity, label: "Attendance" },
  { to: "/admin-head/payroll", icon: FileSpreadsheet, label: "Payslip" },
  { to: "/admin-head/documents", icon: ShieldCheck, label: "Document" },
];

export default function AdminHeadLayout() {
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      // optional: signOut from supabase if session exists
      const { supabase } = await import("../../lib/supabaseClient");
      await supabase.auth.signOut();
    } catch {}

    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(COMPLETION_KEY);
    try {
      sessionStorage.removeItem(DOCS_AUTH_KEY);
    } catch {}
    localStorage.removeItem(DOCS_AUTH_KEY);


    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className={`bg-white border-r sticky top-0 h-screen transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-[280px]' : 'w-[72px]'}`}>
        <div className="h-full flex flex-col">
          <div className={`p-5 border-b min-h-[81px] flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen && (
              <div>
                <div className="text-xl font-extrabold text-slate-900 leading-none">Admin Head</div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Control Panel</div>
              </div>
            )}
            {!isSidebarOpen && (
              <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-black">A</div>
            )}
          </div>
          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            {items.map((item) => (
              <SideItem key={item.to} {...item} isCollapsed={!isSidebarOpen} />
            ))}
          </nav>
          <div className="p-3 border-t">
            <button
              onClick={handleLogout}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-black transition-all ${isSidebarOpen ? 'px-4 py-3' : 'h-10'}`}
              title="Logout"
            >
              <LogOut size={18} />
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>


      <main className="flex-1 min-w-0">
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                <Menu size={20} />
              </button>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Admin Head</div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  <p className="text-lg font-black text-slate-900 tracking-tight leading-none">Control Center</p>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <AlertTriangle size={12} /> Access: Full
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NavLink
                to="/admin-head/notifications"
                className={({ isActive }) =>
                  `p-2 rounded-xl border transition-all ${
                    isActive ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-500 hover:bg-slate-50"
                  }`
                }
                title="Notifications"
              >
                <Bell size={20} />
              </NavLink>

              <NavLink
                to="/admin-head/profile"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                    isActive ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-700 hover:bg-slate-50"
                  }`
                }
              >
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold border border-indigo-200 shadow-sm">
                  S
                </div>
                <span className="text-sm font-semibold hidden sm:inline">My Profile</span>
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
