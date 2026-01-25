const items = [
  "Payroll Input Sheet",
  "Approve Attendance for Payroll",
  "Salary Structure Assignment",
  "Payroll Summary Overview",
];

export default function AdminHeadPayrollAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payroll Administration</h1>
        <p className="text-sm text-slate-500">Oversee payroll inputs, approvals, and summary checks.</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Payroll Tasks</h3>
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
