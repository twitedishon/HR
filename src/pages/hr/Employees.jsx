// src/pages/hr/Employees.jsx
import React, { useState, useMemo, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";

/* ---------------------- SAMPLE DATA ---------------------- */
const initialEmployees = [
  {
    id: "EMP001",
    name: "Priya Sharma",
    department: "AI Engineer",
    role: "UI Developer",
    email: "priya.sharma@example.com",
    phone: "",
    location: "Remote",
    joinDate: "2023-01-10",
    employeeType: "Full-time",
    status: "Permanent",
    avatar: "",
    gender: "Female",
    dob: "",
    reportingManager: "CEO",
  },
];

/* ---------------------- DROPDOWN OPTIONS ---------------------- */
const DEPARTMENTS = [
  "Founder",
  "Finance & HR",
  "Business Development Executive",
  "AI Engineer",
  "AI Intern",
  "UI/UX Intern",
  "Software Developer Intern",
  "Talent Acquisition Manager",
  "Talent Acquisition Executive",
];

const WORK_LOCATIONS = ["Chennai", "Bangalore", "Remote", "Srilanka", "Other"];
const EMPLOYEE_STATUSES = ["Probation", "Permanent"];

/* ---------------------- TAG HELPERS ---------------------- */
const departmentColors = {
  Founder: "bg-amber-50 text-amber-700",
  "Finance & HR": "bg-emerald-50 text-emerald-700",
  "Business Development Executive": "bg-pink-50 text-pink-700",
  "AI Engineer": "bg-sky-50 text-sky-700",
  "AI Intern": "bg-indigo-50 text-indigo-700",
  "UI/UX Intern": "bg-fuchsia-50 text-fuchsia-700",
  "Software Developer Intern": "bg-violet-50 text-violet-700",
  "Talent Acquisition Manager": "bg-teal-50 text-teal-700",
  "Talent Acquisition Executive": "bg-cyan-50 text-cyan-700",
};

const deptPill = (dept) =>
  departmentColors[dept] || "bg-slate-100 text-slate-700";

const normalizeEmail = (v) => {
  const s = String(v || "")
    .trim()
    .toLowerCase();
  return s.includes("@") ? s : s || "";
};

const formatJoinDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return formatDDMMYYYY(raw);
};

const generateEmployeeId = (list) => {
  const numbers = (list || [])
    .map((emp) => {
      const match = String(emp?.id || "").match(/\d+/);
      return match ? parseInt(match[0], 10) : NaN;
    })
    .filter((n) => Number.isFinite(n));

  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  const width = Math.max(3, ...numbers.map((n) => String(n).length));
  let candidate = `EMP-${String(next).padStart(width, "0")}`;

  const idSet = new Set((list || []).map((emp) => String(emp?.id || "")));
  while (idSet.has(candidate)) {
    const bump = parseInt(candidate.match(/\d+/)?.[0] || "0", 10) + 1;
    candidate = `EMP-${String(bump).padStart(width, "0")}`;
  }
  return candidate;
};

/* ---------------------- SMALL UI HELPERS ---------------------- */
function initials(name) {
  const s = String(name || "").trim();
  if (!s) return "E";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "E";
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className="text-sm text-slate-900 text-right break-words max-w-[65%]">
        {value}
      </div>
    </div>
  );
}

/* ---------------------- MAIN COMPONENT ---------------------- */
export default function Employees() {
  const [employees, setEmployees] = useState(initialEmployees);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // ✅ View employee modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // ✅ Show/Hide password (Add modal only)
  const [showPw, setShowPw] = useState(false);

  // 🔍 FILTER STATES
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState("All");

  // ➕ ADD EMPLOYEE STATE
  const [newEmployee, setNewEmployee] = useState({
    email: "",
    password: "",
    name: "",
    department: "",
    role: "",
    employeeType: "",
    status: "",
    gender: "",
    reportingManager: "",
    joinDate: "",
    workLocations: [],
    otherWorkLocation: "",
    internDuration: "",
  });

  // ✅ PAGE LOAD: DB fetch
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!isSupabaseConfigured) return;

      try {
        const { data, error } = await supabase
          .from("hrmss_employees")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((r) => ({
            id: r.employee_id || "",
            name: r.full_name || "",
            department: r.department || "",
            role: r.role || "",
            email: r.email || "",
            phone: r.phone || "",
            location: r.location || "",
            joinDate: r.join_date || "",
            employeeType: r.employee_type || "",
            status: r.status || "",
            avatar: r.avatar || "",
            gender: r.gender || "",
            dob: r.dob || "",
            reportingManager: r.reporting_manager || "",
          }));
          setEmployees(mapped);
        }
      } catch (err) {
        console.error("Fetch employees failed:", err);
      }
    };

    fetchEmployees();
  }, []);

  // ✅ ESC close view modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeEmployeeModal();
    };
    if (isViewModalOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isViewModalOpen]);

  const openEmployeeModal = (emp) => {
    setSelectedEmployee(emp);
    setIsViewModalOpen(true);
  };

  const closeEmployeeModal = () => {
    setIsViewModalOpen(false);
    setSelectedEmployee(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee((p) => ({
      ...p,
      [name]: value,
      ...(name === "employeeType" && value !== "Intern" ? { internDuration: "" } : {}),
    }));
  };

  const toggleWorkLocation = (loc) => {
    setNewEmployee((p) => {
      const exists = p.workLocations.includes(loc);
      const next = exists
        ? p.workLocations.filter((x) => x !== loc)
        : [...p.workLocations, loc];

      const nextOther = loc === "Other" && exists ? "" : p.otherWorkLocation;
      return { ...p, workLocations: next, otherWorkLocation: nextOther };
    });
  };

  const buildLocationText = (workLocations, otherWorkLocation) => {
    const base = workLocations.filter((x) => x !== "Other");
    const other =
      workLocations.includes("Other") && otherWorkLocation?.trim()
        ? [`Other: ${otherWorkLocation.trim()}`]
        : workLocations.includes("Other")
          ? ["Other"]
          : [];
    return [...base, ...other].join(", ");
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();

    const email = String(newEmployee.email || "")
      .trim()
      .toLowerCase();

    if (
      !email ||
      !newEmployee.password ||
      !newEmployee.name ||
      !newEmployee.department
    ) {
      alert("Email, Password, Name & Department required");
      return;
    }

    if (newEmployee.employeeType === "Intern" && !newEmployee.internDuration) {
      alert("Please select internship duration");
      return;
    }

    const employeeId = generateEmployeeId(employees);

    // duplicate email check
    const emailExists = employees.some(
      (x) => String(x.email || "").toLowerCase() === email
    );
    if (emailExists) {
      alert("This Email already exists");
      return;
    }

    const locationText = buildLocationText(
      newEmployee.workLocations,
      newEmployee.otherWorkLocation
    );

    const resolvedEmployeeType =
      newEmployee.employeeType === "Intern" && newEmployee.internDuration
        ? `Intern (${newEmployee.internDuration} months)`
        : newEmployee.employeeType;

    if (isSupabaseConfigured) {
      try {
        // 1) Save employee details FIRST (Required for Foreign Key)
        const reportingManagerEmail = normalizeEmail(
          newEmployee.reportingManager
        );

        const payload = {
          employee_id: employeeId,
          full_name: String(newEmployee.name || "").trim(),
          department: newEmployee.department || null,
          role: newEmployee.role || null,
          employee_type: resolvedEmployeeType || null,
          status: newEmployee.status || null,
          gender: newEmployee.gender || null,
          reporting_manager: reportingManagerEmail || null,
          join_date: newEmployee.joinDate || null,
          location: locationText || null,
          email: email || null,

          // not collected in add form
          phone: null,
          dob: null,
          avatar: null,
        };

        const { data: inserted, error: insErr } = await supabase
          .from("hrmss_employees")
          .insert([payload])
          .select("*")
          .single();

        if (insErr) throw insErr;

        const insertedEmployeeType =
          inserted.employee_type || resolvedEmployeeType || "";

        // 2) Save login credentials via RPC (Now that employee exists)
        const { error: credErr } = await supabase.rpc(
          "upsert_employee_account",
          {
            p_employee_id: employeeId,
            p_password: String(newEmployee.password || ""),
          }
        );
        if (credErr) throw credErr;

        setEmployees((prev) => [
          {
            id: inserted.employee_id,
            name: inserted.full_name,
            department: inserted.department || "",
            role: inserted.role || "",
            email: inserted.email || "",
            phone: inserted.phone || "",
            location: inserted.location || "",
            joinDate: inserted.join_date || "",
            employeeType: insertedEmployeeType,
            status: inserted.status || "",
            avatar: inserted.avatar || "",
            gender: inserted.gender || "",
            dob: inserted.dob || "",
            reportingManager: inserted.reporting_manager || "",
          },
          ...prev,
        ]);
      } catch (err) {
        console.error(err);
        alert(err?.message || "Failed to save employee");
        return;
      }
    } else {
      // local fallback (no password in list)
      setEmployees((prev) => [
        {
          id: employeeId,
          name: newEmployee.name,
          department: newEmployee.department,
          role: newEmployee.role,
          employeeType: resolvedEmployeeType,
          status: newEmployee.status,
          gender: newEmployee.gender,
          reportingManager: normalizeEmail(newEmployee.reportingManager),
          joinDate: newEmployee.joinDate,
          location: locationText,
          email: email,
          phone: "",
          dob: "",
          avatar: "",
        },
        ...prev,
      ]);
    }

    setIsAddModalOpen(false);
    setShowPw(false);
    setNewEmployee({
      password: "",
      email: "",
      name: "",
      department: "",
      role: "",
      employeeType: "",
      status: "",
      gender: "",
      reportingManager: "",
      joinDate: "",
      workLocations: [],
      otherWorkLocation: "",
      internDuration: "",
    });
  };

  // 🔍 FILTER LOGIC
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        (emp.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (emp.id || "").toLowerCase().includes(search.toLowerCase()) ||
        (emp.email || "").toLowerCase().includes(search.toLowerCase());

      const matchDepartment =
        departmentFilter === "All" || emp.department === departmentFilter;

      const currentType = String(emp.employeeType || "");
      const matchEmployeeType =
        employeeTypeFilter === "All"
          ? true
          : employeeTypeFilter === "Intern"
            ? currentType.toLowerCase().startsWith("intern")
            : emp.employeeType === employeeTypeFilter;

      return matchSearch && matchDepartment && matchEmployeeType;
    });
  }, [employees, search, departmentFilter, employeeTypeFilter]);

  // ✅ Modal shows ONLY fields that are part of Add form / DB fields you set
  // ✅ DOB + Phone removed
  const modalFields = useMemo(() => {
    const e = selectedEmployee;
    if (!e) return [];

    const fields = [
      { label: "Status", value: e.status },
      { label: "Designation", value: e.department },
      { label: "Team", value: e.role },
      { label: "Employee Type", value: e.employeeType },
      { label: "Gender", value: e.gender },
      { label: "Join Date", value: formatJoinDate(e.joinDate) },
      { label: "Reporting To", value: e.reportingManager },
      { label: "Work Location", value: e.location },
      { label: "Email", value: e.email },
    ];

    return fields
      .map((f) => ({ ...f, value: String(f.value || "").trim() }))
      .filter((f) => f.value);
  }, [selectedEmployee]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Employee Details
          </h1>
          {/* <p className="text-sm text-slate-500">Manage employee records</p> */}
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add Employee
        </button>
      </div>

      {/* 🔍 FILTER BAR */}
      <div className="mb-6 grid gap-4 rounded-xl bg-white p-4 shadow ring-1 ring-slate-100 md:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, email..."
          className="rounded-lg border px-3 py-2 text-sm"
        />

        <select
          value={departmentFilter}
          onChange={(e) => setDepartmentFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="All">All Designation</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={employeeTypeFilter}
          onChange={(e) => setEmployeeTypeFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="All">All</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Intern">Intern</option>
          <option value="Contract">Contract</option>
          <option value="Freelancer">Freelancer</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-xl bg-white shadow ring-1 ring-slate-100">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold">
                Employee
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold">
                Designation
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold">
                Team
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold">
                Work Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold">
                Join Date
              </th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {filteredEmployees.map((emp) => (
              <tr
                key={emp.id}
                className="hover:bg-slate-50/60 cursor-pointer"
                onClick={() => openEmployeeModal(emp)}
                title="Click to view details"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{emp.name}</div>
                  <div className="text-xs text-slate-500">{emp.id}</div>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs ${deptPill(
                      emp.department
                    )}`}
                  >
                    {emp.department || "-"}
                  </span>
                </td>

                <td className="px-4 py-3 text-slate-700">{emp.role || "-"}</td>

                <td className="px-4 py-3 text-slate-700">
                  {emp.location || "-"}
                </td>

                <td className="px-4 py-3 text-slate-700">
                  {emp.status || "-"}
                </td>

                <td className="px-4 py-3 text-slate-700">
                  {formatJoinDate(emp.joinDate) || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEmployees.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            No employees found.
          </div>
        )}
      </div>

      {/* ================= VIEW EMPLOYEE MODAL ================= */}
      {isViewModalOpen && selectedEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEmployeeModal();
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-700 grid place-items-center font-bold overflow-hidden">
                  {selectedEmployee.avatar ? (
                    <img
                      src={selectedEmployee.avatar}
                      alt={selectedEmployee.name}
                      className="h-12 w-12 rounded-2xl object-cover"
                    />
                  ) : (
                    initials(selectedEmployee.name)
                  )}
                </div>

                <div>
                  <div className="text-base font-semibold text-slate-900">
                    {selectedEmployee.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {selectedEmployee.id}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeEmployeeModal}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              {modalFields.length ? (
                modalFields.map((f) => (
                  <InfoRow key={f.label} label={f.label} value={f.value} />
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No details available.
                </div>
              )}
            </div>

            {/* ✅ Status, DOB, Phone removed */}
          </div>
        </div>
      )}

      {/* ================= ADD EMPLOYEE MODAL ================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Add New Employee
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setShowPw(false);
                }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleAddEmployee}
              className="grid gap-4 md:grid-cols-2"
            >
              <input
                type="email"
                name="email"
                value={newEmployee.email}
                onChange={handleChange}
                placeholder="Email *"
                className="rounded border px-3 py-2"
              />

              {/* ✅ Password with show/hide */}
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  name="password"
                  value={newEmployee.password}
                  onChange={handleChange}
                  placeholder="Password *"
                  className="w-full rounded border px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-600 hover:bg-slate-100"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <input
                name="name"
                value={newEmployee.name}
                onChange={handleChange}
                placeholder="Full Name *"
                className="rounded border px-3 py-2"
              />

              <select
                name="department"
                value={newEmployee.department}
                onChange={handleChange}
                className="rounded border px-3 py-2"
              >
                <option value="">Select Designation *</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <input
                name="role"
                value={newEmployee.role}
                onChange={handleChange}
                placeholder="Team"
                className="rounded border px-3 py-2"
              />

              <select
                name="employeeType"
                value={newEmployee.employeeType}
                onChange={handleChange}
                className="rounded border px-3 py-2"
              >
                <option value="">Employee Type</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Intern">Intern</option>
                <option value="Contract">Contract</option>
                <option value="Freelancer">Freelancer</option>
              </select>

              {newEmployee.employeeType === "Intern" && (
                <select
                  name="internDuration"
                  value={newEmployee.internDuration}
                  onChange={handleChange}
                  className="rounded border px-3 py-2"
                >
                  <option value="">Internship duration</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                </select>
              )}

              <select
                name="status"
                value={newEmployee.status}
                onChange={handleChange}
                className="rounded border px-3 py-2"
              >
                <option value="">Status</option>
                {EMPLOYEE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                name="gender"
                value={newEmployee.gender}
                onChange={handleChange}
                className="rounded border px-3 py-2"
              >
                <option value="">Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>

              <input
                type="date"
                name="joinDate"
                value={newEmployee.joinDate}
                onChange={handleChange}
                className="rounded border px-3 py-2"
              />

              <input
                name="reportingManager"
                value={newEmployee.reportingManager}
                onChange={handleChange}
                placeholder="Reporting To (email)"
                className="rounded border px-3 py-2"
              />

              {/* ✅ Work Location Checkboxes */}
              <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Work Location
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  {WORK_LOCATIONS.map((loc) => (
                    <label
                      key={loc}
                      className="flex items-center gap-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={newEmployee.workLocations.includes(loc)}
                        onChange={() => toggleWorkLocation(loc)}
                        className="h-4 w-4"
                      />
                      {loc}
                    </label>
                  ))}
                </div>

                {newEmployee.workLocations.includes("Other") && (
                  <div className="mt-3">
                    <input
                      value={newEmployee.otherWorkLocation}
                      onChange={(e) =>
                        setNewEmployee((p) => ({
                          ...p,
                          otherWorkLocation: e.target.value,
                        }))
                      }
                      placeholder="Other location (type here)"
                      className="w-full rounded border px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="mt-2 text-xs text-slate-500">
                  Selected:{" "}
                  {buildLocationText(
                    newEmployee.workLocations,
                    newEmployee.otherWorkLocation
                  ) || "—"}
                </div>
              </div>

              {/* 🔘 BUTTONS */}
              <div className="md:col-span-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setShowPw(false);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
