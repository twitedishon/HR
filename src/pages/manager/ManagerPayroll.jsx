
import { Eye, FileSpreadsheet, Lock, Receipt } from "lucide-react";
import { payrollRecords, payslipRecords } from "./managerData";

export default function ManagerPayroll() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-slate-900 text-white p-5 flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
          <Lock />
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-200">Payroll & Payslip Center</p>

          <p className="text-lg font-bold">View-only payroll access</p>
        </div>
        <span className="inline-flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold">
          <Eye size={14} /> Read only
        </span>
      </div>


      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Payroll Runs</h3>
          </div>
          <span className="text-xs text-slate-500">Managers cannot edit</span>
        </div>
        <div className="space-y-2">
          {payrollRecords.map((row) => (
            <div
              key={row.month}
              className="rounded-xl border p-3 flex items-start justify-between bg-slate-50/50"
            >
              <div>
                <p className="font-semibold text-slate-900">{row.month}</p>
                <p className="text-xs text-slate-500">{row.remarks}</p>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-3 py-1 rounded-full">
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Payslip Status</h3>
          </div>
          <span className="text-xs text-slate-500">Read only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="py-2">Employee</th>
                <th className="py-2">Month</th>
                <th className="py-2">Net Pay</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payslipRecords.map((p) => (
                <tr key={`${p.id}-${p.month}`} className="hover:bg-slate-50">
                  <td className="py-3">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.id}</div>
                  </td>
                  <td className="py-3 text-slate-800">{p.month}</td>
                  <td className="py-3 text-slate-900 font-semibold">{p.netPay}</td>
                  <td className="py-3">
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
