import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";

const DashboardLayout = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    if (localStorage.getItem("hrmss.signin.completed.admin") !== "true") {
      navigate("/sign-in", { state: { role: "admin" } });
    }
  }, [navigate]);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isSidebarOpen ? "w-64" : "w-0"
        }`}
      >
        <div
          className={`transition-opacity duration-200 ${
            isSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <Sidebar />
        </div>
      </div>
      <div className="flex flex-1 flex-col min-h-0">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
        />
        <main className="p-6 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
