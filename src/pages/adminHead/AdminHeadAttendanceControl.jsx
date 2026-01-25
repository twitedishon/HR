
import { useEffect, useState } from "react";
import { fetchAttendanceStats } from "../../lib/attendanceUtils";

const checklist = [
  "Daily Attendance Sheet",
  "Manual Punch Corrections",
  "Shift Assignment",
  "Overtime Rules",
  "Attendance Policy Setup",
  "Workforce Attendance Analytics",
];

export default function AdminHeadAttendanceControl() {

  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    missingPunch: 0,
  });

  useEffect(() => {
    const loadStats = async () => {
      const data = await fetchAttendanceStats();
      if (data) {
        setStats(data);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attendance Control</h1>
        <p className="text-sm text-slate-500">Control sheets, corrections, shift assignments, overtime and policy setup.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Actions</h3>
          <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Daily Attendance Sheet (summary)</h3>
          <div className="space-y-2 text-sm text-slate-700">

            <p>Total Employees: {stats.total}</p>
            <p>Present: {stats.present}</p>
            <p>Late: {stats.late}</p>
            <p>Absent: {stats.absent}</p>
            <p>Missing Punch: {stats.missingPunch}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
