const items = [
  "HR Master Report",
  "Attendance & Leave Reports",
  "Payroll Reports",
  "Hiring & Attrition Reports",
  "Compliance Reports (PDF / Excel)",
];

export default function AdminHeadReports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">Generate master, attendance, payroll, hiring, and compliance reports.</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Available Reports</h3>
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
