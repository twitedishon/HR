import { Routes, Route, Navigate } from "react-router-dom";
import RequireProfileSetup from "./routes/RequireProfileSetup";
import GlobalLoader from "./components/GlobalLoader";

// Layouts
import DashboardLayout from "./layouts/DashboardLayout";
import EmployeeLayout from "./pages/employee/EmployeeLayout";
import HrLayout from "./pages/hr/HrLayout";
import ManagerLayout from "./pages/manager/ManagerLayout";
import ManagerApproverLayout from "./pages/managerApprover/ManagerApproverLayout";
import AdminHeadLayout from "./pages/adminHead/AdminHeadLayout";

// Auth
import Login from "./pages/auth/Login";
import EmployeeSignIn from "./pages/employee/EmployeeSignIn";

// Pages
import ApproverEmployeeDashboard from "./pages/admin/ApproverEmployeeDashboard";
import ApproverEmployeeAttendance from "./pages/admin/ApproverEmployeeAttendance";
import ApproverEmployeeLeaveManagement from "./pages/admin/ApproverEmployeeLeaveManagement";
import ApproverEmployeePayslipView from "./pages/admin/ApproverEmployeePayslipView";
import ApproverEmployeeDocuments from "./pages/admin/ApproverEmployeeDocuments";
import ApproverEmployeeNotifications from "./pages/admin/ApproverEmployeeNotifications";
import ApproverEmployeeProfile from "./pages/admin/ApproverEmployeeProfile";
import ApproverCareerGuidance from "./pages/admin/ApproverCareerGuidance";

import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import MyProfile from "./pages/employee/profile/MyProfile";
import EmployeeAttendance from "./pages/employee/EmployeeAttendance";
import EmployeeLeaveManagement from "./pages/employee/EmployeeLeaveManagement";
import EmployeeDocuments from "./pages/employee/EmployeeDocuments";
import EmployeePayslips from "./pages/employee/EmployeePayslips";
import EmployeeNotifications from "./pages/employee/EmployeeNotifications";
import { SupportPage } from "./pages/employee/EmployeeMenuPages.jsx";
import CareerGuidance from "./pages/employee/CareerGuidance";

import HrHome from "./pages/hr/HrHome";
import Employees from "./pages/hr/Employees";
import Payroll from "./pages/hr/Payroll";
import PayslipManagement from "./pages/hr/PayslipManagement";
import LeaveManagement from "./pages/hr/LeaveManagement";
import Attendance from "./pages/hr/Attendance";
import HrDocuments from "./pages/hr/HrDocuments";
import HrNotifications from "./pages/hr/HrNotifications";
import HrProfile from "./pages/hr/HrProfile";
import WorkAnniversary from "./pages/hr/WorkAnniversary";

import ManagerDashboard from "./pages/manager/ManagerDashboard";

import ManagerApproverDashboard from "./pages/managerApprover/ManagerApproverDashboard";
import ManagerApproverApprovals from "./pages/managerApprover/ManagerApproverApprovals";
import ManagerApproverNotifications from "./pages/managerApprover/ManagerApproverNotifications";

import AdminHeadDashboard from "./pages/adminHead/AdminHeadDashboard";
import AdminHeadApprovals from "./pages/adminHead/AdminHeadApprovals";
import AdminHeadAttendanceControl from "./pages/adminHead/AdminHeadAttendanceControl";
import AdminHeadLeaveControl from "./pages/adminHead/AdminHeadLeaveControl";
import AdminHeadDocumentControl from "./pages/adminHead/AdminHeadDocumentControl";
import AdminHeadPayslips from "./pages/adminHead/AdminHeadPayslips";
import AdminHeadSystemSettings from "./pages/adminHead/AdminHeadSystemSettings";
import AdminHeadReports from "./pages/adminHead/AdminHeadReports";
import AdminHeadNotifications from "./pages/adminHead/AdminHeadNotifications";

import PeopleDirectory from "./pages/hr/PeopleDirectory";

export default function App() {
  return (
    <>
      <GlobalLoader />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />

        {/* ✅ Sign In route */}
        <Route path="/sign-in" element={<EmployeeSignIn />} />
        <Route path="/employee-signin" element={<EmployeeSignIn />} />

        {/* ================= HR ================= */}
        <Route
          path="/hr-dashboard"
          element={
            <RequireProfileSetup>
              <HrLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<HrHome />} />
          <Route path="employees" element={<Employees />} />
          <Route path="payroll" element={<Payroll basePath="/hr-dashboard" />} />
          <Route path="payslips" element={<PayslipManagement basePath="/hr-dashboard" />} />
          <Route path="leave" element={<LeaveManagement />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="documents" element={<HrDocuments />} />
          <Route path="notifications" element={<HrNotifications />} />
          <Route path="profile" element={<HrProfile />} />
          <Route path="profile/edit" element={<EmployeeSignIn />} />
          <Route path="people" element={<PeopleDirectory />} />
          <Route path="work-anniversary" element={<WorkAnniversary />} />
        </Route>

        {/* ================= ADMIN ================= */}
        <Route
          path="/dashboard"
          element={
            <RequireProfileSetup>
              <DashboardLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<ApproverEmployeeDashboard />} />
          <Route path="attendance" element={<ApproverEmployeeAttendance />} />
          <Route path="leave" element={<ApproverEmployeeLeaveManagement />} />
          <Route path="payslips" element={<ApproverEmployeePayslipView />} />
          <Route path="documents" element={<ApproverEmployeeDocuments />} />
          <Route path="notifications" element={<ApproverEmployeeNotifications />} />
          <Route path="profile" element={<ApproverEmployeeProfile />} />
          <Route path="profile/edit" element={<EmployeeSignIn />} />
          <Route path="career-guidance" element={<ApproverCareerGuidance />} />
        </Route>

        {/* ================= ADMIN HEAD ================= */}
        <Route
          path="/admin-head"
          element={
            <RequireProfileSetup>
              <AdminHeadLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<AdminHeadDashboard />} />
          <Route path="approvals" element={<AdminHeadApprovals />} />
          <Route path="attendance" element={<AdminHeadAttendanceControl />} />
          <Route path="leave" element={<AdminHeadLeaveControl />} />
          <Route path="documents" element={<AdminHeadDocumentControl />} />
          <Route path="payroll" element={<AdminHeadPayslips />} />
          <Route path="settings" element={<AdminHeadSystemSettings />} />
          <Route path="reports" element={<AdminHeadReports />} />
          <Route path="notifications" element={<AdminHeadNotifications />} />
          <Route path="profile" element={<ApproverEmployeeProfile />} />
          <Route path="profile/edit" element={<EmployeeSignIn />} />
        </Route>

        {/* ================= MANAGER ================= */}
        <Route path="/manager-dashboard" element={<ManagerLayout />}>
          <Route index element={<ManagerDashboard />} />
        </Route>

        <Route path="/manager-approver-dashboard" element={<ManagerApproverLayout />}>
          <Route index element={<ManagerApproverDashboard />} />
          <Route path="approvals" element={<ManagerApproverApprovals />} />
          <Route path="notifications" element={<ManagerApproverNotifications />} />
        </Route>

        {/* ================= EMPLOYEE ================= */}
        <Route
          path="/employee-dashboard"
          element={
            <RequireProfileSetup>
              <EmployeeLayout />
            </RequireProfileSetup>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboard />} />
          <Route path="profile" element={<MyProfile />} />
          <Route path="profile/edit" element={<EmployeeSignIn />} />
          <Route path="attendance" element={<EmployeeAttendance />} />
          <Route path="leave" element={<EmployeeLeaveManagement />} />
          <Route path="documents" element={<EmployeeDocuments />} />
          <Route path="payslips" element={<EmployeePayslips />} />
          <Route path="notifications" element={<EmployeeNotifications />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="career-guidance" element={<CareerGuidance />} />
          <Route path="people" element={<PeopleDirectory />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
