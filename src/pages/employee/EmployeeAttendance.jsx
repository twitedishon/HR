import { useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, LogOut, RefreshCcw } from "lucide-react";


const AUTH_KEY = "HRMSS_AUTH_SESSION";

const readUserFromAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const LS_KEY = (empId) => `HRMS_EMP_ATTENDANCE_${empId}`;

const todayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const timeHHMMSS = (date = new Date()) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const loadAttendance = (empId) => {

  if (!empId) return [];
  try {
    const raw = localStorage.getItem(LS_KEY(empId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};


const saveAttendance = (empId, rows) => {
  if (!empId) return;
  localStorage.setItem(LS_KEY(empId), JSON.stringify(rows));
};

export default function EmployeeAttendance() {
  const [user] = useState(() => readUserFromAuth());
  const empId = user?.employee_id || user?.identifier || "EMP-GUEST";
  const empName = user?.full_name || user?.name || "Guest";

  const [rows, setRows] = useState(() => loadAttendance(empId));

  useEffect(() => {
    saveAttendance(empId, rows);
  }, [rows, empId]);

  const today = todayISO();
  const todayRow = useMemo(() => rows.find((r) => r.date === today) || null, [rows, today]);

  const checkedIn = Boolean(todayRow?.checkIn);
  const checkedOut = Boolean(todayRow?.checkOut);

  const handleCheckIn = () => {
    if (checkedIn) return;
    setRows((prev) => [
      { date: today, checkIn: timeHHMMSS(), checkOut: "", status: "Present" },
      ...prev.filter((r) => r.date !== today),
    ]);
  };

  const handleCheckOut = () => {
    if (!checkedIn || checkedOut) return;
    setRows((prev) =>
      prev.map((r) => (r.date === today ? { ...r, checkOut: timeHHMMSS() } : r))
    );
  };

  const handleMarkAbsent = () => {
    setRows((prev) => [
      { date: today, checkIn: "", checkOut: "", status: "Absent" },
      ...prev.filter((r) => r.date !== today),
    ]);
  };

  const handleResetToday = () => setRows((prev) => prev.filter((r) => r.date !== today));

  const stats = useMemo(() => {
    const present = rows.filter((r) => r.status === "Present").length;
    const absent = rows.filter((r) => r.status === "Absent").length;
    return { present, absent, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Attendance</h2>
            <p className="text-sm text-gray-600 mt-1">

              Employee: <span className="font-semibold">{empName}</span> ({empId})
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCheckIn}
              disabled={checkedIn || todayRow?.status === "Absent"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                checkedIn || todayRow?.status === "Absent"
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-purple-700 text-white hover:bg-purple-800"
              }`}
            >
              <Clock size={18} />
              Check In
            </button>

            <button
              onClick={handleCheckOut}
              disabled={!checkedIn || checkedOut || todayRow?.status === "Absent"}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                !checkedIn || checkedOut || todayRow?.status === "Absent"
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-black"
              }`}
            >
              <LogOut size={18} />
              Check Out
            </button>

            <button
              onClick={handleMarkAbsent}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition"
            >
              Mark Absent
            </button>

            <button
              onClick={handleResetToday}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gray-50 text-gray-800 hover:bg-gray-100 transition"
            >
              <RefreshCcw size={18} />
              Reset Today
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Present Days</p>
            <p className="text-2xl font-extrabold text-gray-900">{stats.present}</p>
          </div>
          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Absent Days</p>
            <p className="text-2xl font-extrabold text-gray-900">{stats.absent}</p>
          </div>
          <div className="rounded-2xl border bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Total Records</p>
            <p className="text-2xl font-extrabold text-gray-900">{stats.total}</p>
          </div>
        </div>

        {todayRow && (
          <div className="mt-5 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <CheckCircle2 size={18} className="text-green-600" />
              Today ({today})
            </div>
            <div className="mt-2 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="text-gray-500">Status:</span>{" "}
                <span className="font-semibold">{todayRow.status}</span>
              </div>
              <div>
                <span className="text-gray-500">Check In:</span>{" "}
                <span className="font-semibold">{todayRow.checkIn || "—"}</span>
              </div>
              <div>
                <span className="text-gray-500">Check Out:</span>{" "}
                <span className="font-semibold">{todayRow.checkOut || "—"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-6">
        <h3 className="text-lg font-extrabold text-gray-900">History</h3>
        <p className="text-sm text-gray-600 mt-1">Saved in localStorage (demo).</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-3 pr-3">Date</th>
                <th className="py-3 pr-3">Status</th>
                <th className="py-3 pr-3">Check In</th>
                <th className="py-3 pr-3">Check Out</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={4}>
                    No attendance records yet.
                  </td>
                </tr>
              ) : (
                rows
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .map((r) => (
                    <tr key={r.date} className="border-b last:border-b-0">
                      <td className="py-3 pr-3 font-semibold text-gray-900">{r.date}</td>
                      <td className="py-3 pr-3">{r.status}</td>
                      <td className="py-3 pr-3">{r.checkIn || "—"}</td>
                      <td className="py-3 pr-3">{r.checkOut || "—"}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
