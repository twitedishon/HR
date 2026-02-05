import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Compass,
} from "lucide-react";

const Sidebar = ({ isOpen = true }) => {
  return (
    <aside
      className={`bg-white border-r shadow-sm flex flex-col h-screen sticky top-0 transition-all duration-300 ${isOpen ? "w-64" : "w-20"
        }`}
    >
      <div
        className={`p-5 border-b flex items-center h-[70px] ${isOpen ? "justify-start" : "justify-center"
          }`}
      >
        {isOpen ? (
          <h1 className="text-xl font-bold text-blue-700">TWITE HRMS</h1>
        ) : (
          <h1 className="text-xl font-bold text-blue-700">T</h1>
        )}
      </div>
      <nav className="p-4 flex-1 space-y-1">
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <LayoutDashboard size={18} />
          {isOpen && <span>Dashboard</span>}
        </NavLink>

        <NavLink
          to="/dashboard/attendance"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <ClipboardCheck size={18} />
          {isOpen && <span>Attendance</span>}
        </NavLink>

        <NavLink
          to="/dashboard/leave"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <CalendarDays size={18} />
          {isOpen && <span>Leave Management</span>}
        </NavLink>

        <NavLink
          to="/dashboard/calendar"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <CalendarDays size={18} />
          {isOpen && <span>Calendar</span>}
        </NavLink>

        <NavLink
          to="/dashboard/payslips"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <FileText size={18} />
          {isOpen && <span>Payslips</span>}
        </NavLink>

        <NavLink
          to="/dashboard/documents"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <FileText size={18} />
          {isOpen && <span>Documents</span>}
        </NavLink>

        <NavLink
          to="/dashboard/career-guidance"
          className={({ isActive }) =>
            `flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-0"
            } py-2 rounded-md text-sm font-medium transition ${isActive
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            }`
          }
        >
          <Compass size={18} />
          {isOpen && <span>Career Ladder</span>}
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
