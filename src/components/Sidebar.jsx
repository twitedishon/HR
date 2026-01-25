import { NavLink } from "react-router-dom";

const linkClasses = ({ isActive }) =>
  `block px-3 py-2 rounded-md text-sm font-medium ${
    isActive
      ? "bg-blue-600 text-white"
      : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"
  }`;

const Sidebar = () => {
  return (
    <aside className="w-64 bg-white border-r shadow-sm flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b">
        <h1 className="text-xl font-bold text-blue-700">TWITE HRMS</h1>
      </div>
      <nav className="p-4 flex-1 space-y-1">
        <NavLink to="/dashboard" end className={linkClasses}>
          Dashboard
        </NavLink>

        <NavLink to="/dashboard/attendance" className={linkClasses}>
          Attendance
        </NavLink>
        <NavLink to="/dashboard/leave" className={linkClasses}>
         LeaveManagement
        </NavLink>
        <NavLink to="/dashboard/payslips" className={linkClasses}>
          Payslips
        </NavLink>
        <NavLink to="/dashboard/documents" className={linkClasses}>
          Documents
        </NavLink>
        <NavLink to="/dashboard/career-guidance" className={linkClasses}>
          Career Guidance
        </NavLink>

      </nav>
      <div className="p-4 border-t text-xs text-gray-400">
        © {new Date().getFullYear()} HRMS Lite
      </div>
    </aside>
  );
};

export default Sidebar;
