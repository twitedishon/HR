export const MANAGER_SESSION_KEY = "hrms.manager.session";

export const managerAccounts = [
  {
    id: "MGR-01",
    name: "Priya Menon",
    email: "manager1@hrms.com",

    role: "manager",
    access: "approver", // can approve / reject
    team: "Product",
  },
  {
    id: "MGR-02",
    name: "Arun Dev",
    email: "manager2@hrms.com",

    role: "manager",
    access: "viewer", // view-only
    team: "Operations",
  },
];

export const teamMembers = [
  {

    id: "EMP-001",
    name: "Arun Murugappa",
    email: "arun@hrms.com",
    role: "Senior Developer",
    status: "Available",
    location: "Chennai",
    leaveType: "",
    leaveDates: "",
    leaveReason: "",
  },
  {
    id: "EMP-002",
    name: "Sunil Reddy",
    email: "sunil@hrms.com",
    role: "Product Manager",
    status: "Available",
    location: "Bangalore",
    leaveType: "",
    leaveDates: "",
    leaveReason: "",
  },
  {
    id: "EMP-003",
    name: "Priya Das",
    email: "priya.das@hrms.com",
    role: "QA Engineer",
    status: "On Leave",
    location: "Hyderabad",
    leaveType: "Casual Leave",
    leaveDates: "Jan 15 - Jan 17, 2026",
    leaveReason: "Personal work",
  },
  {
    id: "EMP-004",
    name: "Rajesh Kumar",
    email: "rajesh.k@hrms.com",
    role: "UI/UX Designer",
    status: "Available",
    location: "Chennai",
    leaveType: "",
    leaveDates: "",
    leaveReason: "",
  },
  {
    id: "EMP-005",
    name: "Neha Gupta",
    email: "neha.gupta@hrms.com",
    role: "DevOps Engineer",
    status: "On Leave",
    location: "Pune",
    leaveType: "Sick Leave",
    leaveDates: "Jan 16 - Jan 18, 2026",
    leaveReason: "Medical appointment",
  },
  {
    id: "EMP-006",
    name: "Sanjay Patel",
    email: "sanjay@hrms.com",
    role: "Backend Developer",
    status: "Available",
    location: "Bangalore",
    leaveType: "",
    leaveDates: "",
    leaveReason: "",
  },
];

export const leaveRequests = [
  {

    id: "LEAVE-001",
    employee: "Priya Das",
    employeeId: "EMP-003",
    type: "Casual Leave",
    status: "Pending",
    reason: "Personal work",
    handover: "Assigned to Rajesh Kumar",
    dates: "Jan 15 - Jan 17, 2026",
  },
  {
    id: "LEAVE-002",
    employee: "Neha Gupta",
    employeeId: "EMP-005",
    type: "Sick Leave",
    status: "Pending",
    reason: "Medical appointment",
    handover: "Assigned to Arun Murugappa",
    dates: "Jan 16 - Jan 18, 2026",
  },
  {
    id: "LEAVE-003",
    employee: "Sanjay Patel",
    employeeId: "EMP-006",
    type: "Planned Leave",
    status: "Approved",
    reason: "Vacation",
    handover: "Assigned to Sunil Reddy",
    dates: "Jan 20 - Jan 27, 2026",
  },
];

export const payrollRecords = [

  {
    id: "PAYROLL-JAN-2026",
    month: "January 2026",
    status: "In Progress",
    remarks: "Processing salaries for 50 employees",
  },
  {
    id: "PAYROLL-DEC-2025",
    month: "December 2025",
    status: "Completed",
    remarks: "All salaries processed successfully",
  },
  {
    id: "PAYROLL-NOV-2025",
    month: "November 2025",
    status: "Completed",
    remarks: "Year-end bonus included",
  },
];

export const payslipRecords = [
  {
    id: "PAYSLIP-EMP-001-JAN",
    month: "January 2026",
    employee: "Arun Murugappa",
    published: true,
  },
  {
    id: "PAYSLIP-EMP-002-JAN",
    month: "January 2026",
    employee: "Sunil Reddy",
    published: true,
  },
  {
    id: "PAYSLIP-EMP-003-JAN",
    month: "January 2026",
    employee: "Priya Das",
    published: false,
  },
  {
    id: "PAYSLIP-EMP-004-JAN",
    month: "January 2026",
    employee: "Rajesh Kumar",
    published: true,
  },
];

export const buildDefaultSession = () => {
  // Default to the approver account to avoid locking users in a viewer-only state
  const fallback = managerAccounts[0] || managerAccounts[1];
  return {
    id: fallback.id,
    name: fallback.name,
    email: fallback.email,

    role: fallback.role || "manager",
    access: fallback.access || fallback.role,
    team: fallback.team,
  };
};

export const getManagerSession = () => {
  try {
    const raw = localStorage.getItem(MANAGER_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);

      if (parsed?.id && parsed?.name) {
        // normalize older sessions that only stored `role`
        if (!parsed.access && parsed.role === "approver")
          parsed.access = "approver";
        if (!parsed.access && parsed.role === "viewer")
          parsed.access = "viewer";
        if (!parsed.role) parsed.role = "manager";
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return buildDefaultSession();
};
