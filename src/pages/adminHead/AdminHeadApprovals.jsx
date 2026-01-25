
const rows = [];

export default function AdminHeadApprovals() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
        <p className="text-sm text-slate-500">Control approvals for attendance, documents, profile changes, and payroll inputs.</p>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">Area</th>
              <th className="px-4 py-3 text-left">Pending</th>
              <th className="px-4 py-3 text-left">SLA</th>
              <th className="px-4 py-3 text-left">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.area} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{r.area}</td>
                <td className="px-4 py-3">{r.pending}</td>
                <td className="px-4 py-3">{r.sla}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      r.risk === "High"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : r.risk === "Medium"
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {r.risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
