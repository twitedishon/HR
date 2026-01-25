import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CheckSquare,

  Home,
  LogOut,
  Menu,
  Shield,
} from "lucide-react";
import { getManagerSession } from "./managerApproverData";

const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";

const navItems = [
  { to: "/manager-approver-dashboard", end: true, label: "Dashboard", icon: Home },
  { to: "/manager-approver-dashboard/approvals", label: "Leave Approvals", icon: CheckSquare },

];

const NavItem = ({ to, icon: Icon, label, end, isCollapsed }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>

      `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
        isActive
          ? "bg-indigo-700 text-white shadow-lg shadow-indigo-200"
          : "text-slate-200 hover:bg-white/10 hover:text-white"
      }`
    }
  >

    <Icon size={18} className="shrink-0" />
    {!isCollapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

export default function ManagerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(getManagerSession());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const access = session.access || session.role;

  useEffect(() => {
    // Just hydrate from stored manager session; avoid redirects that break navigation.
    setSession(getManagerSession());
  }, [location.pathname]);

  const approver = access === "approver";
  const handleLogout = () => {
    try {
      sessionStorage.removeItem(DOCS_AUTH_KEY);
    } catch {}
    localStorage.removeItem(DOCS_AUTH_KEY);
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside

        className={`bg-gradient-to-b from-slate-900 to-indigo-900 text-white sticky top-0 h-screen transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "w-[280px]" : "w-[72px]"
        }`}
      >
        <div className="h-full flex flex-col overflow-hidden">
          <div className={`p-5 border-b border-white/10 flex items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <div>
                <div className="text-xl font-extrabold leading-none">Manager</div>
                <div className="text-[10px] text-indigo-100/90 mt-1 flex items-center gap-2 uppercase font-bold tracking-wider">
                  <Shield size={12} />
                  {approver ? "Approver Access" : "Viewer Access"}
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-black">M</div>
            )}
          </div>
          
          {isSidebarOpen && (
            <div className="p-4 bg-white/5 border-b border-white/10">
              <div className="rounded-xl bg-white/10 p-3 text-sm space-y-1">
                <p className="font-semibold text-white/90 truncate">{session.name}</p>
                <p className="text-indigo-200 text-[11px] truncate">{session.email || session.id}</p>
              </div>
            </div>
          )}

          <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden">
            {navItems.map((item) => (
              <NavItem key={item.to} {...item} isCollapsed={!isSidebarOpen} />
            ))}
          </nav>

          <div className="p-3 border-t border-white/10">
            <button
              onClick={handleLogout}
              className={`w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-all ${isSidebarOpen ? 'px-4 py-3' : 'h-10'}`}
              title="Logout"
            >
              <LogOut size={16} /> 
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1">
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="px-6 py-4 flex flex-col gap-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">Manager Portal</div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen((open) => !open)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                aria-label={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                <Menu size={18} />
              </button>

              
              <div className="flex items-center gap-2 ml-auto">
                <NavLink
                  to="/manager-approver-dashboard/notifications"
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "bg-indigo-700 text-white shadow"
                        : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                    }`
                  }
                >
                  <Bell size={16} />
                  Notifications
                </NavLink>

              </div>
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
