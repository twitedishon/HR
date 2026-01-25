
import { useEffect, useState } from "react";
import { Eye, FileSpreadsheet, Lock, Receipt, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";

const PAYROLL_TABLE = "hrmss_payroll";
const STATUS_TABLE = "hrmss_payslip_records";

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const splitDeductions = (total) => {
  const safeTotal = Math.max(toNum(total), 0);
  const loan = Math.round(safeTotal * 0.5);
  const salaryAdvance = Math.round(safeTotal * 0.3);
  const leave = Math.max(safeTotal - loan - salaryAdvance, 0);
  return { loan, salaryAdvance, leave };
};

const formatInr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(toNum(n));

export default function ManagerPayroll() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [openDetailsId, setOpenDetailsId] = useState("");
  const [supportsEmployeeStatus, setSupportsEmployeeStatus] = useState(false);

  const fetchBatches = async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Get payroll rows (one per employee per month)
      const { data: payrollData, error: payrollErr } = await supabase
        .from(PAYROLL_TABLE)
        .select("id, employee_id, month, basic_salary, hra, allowances, deductions, net_salary, created_at")
        .order("month", { ascending: false });

      if (payrollErr) throw payrollErr;

      // 2. Get status from hrmss_payslip_records (try employee_id; fallback to month-only)
      let statusData = [];
      let statusSupportsEmployee = false;
      try {
        const statusRes = await supabase.from(STATUS_TABLE).select("month, employee_id, published, note, created_at");
        if (statusRes.error) throw statusRes.error;
        statusData = statusRes.data || [];
        statusSupportsEmployee = true;
      } catch (errStatus) {
        statusSupportsEmployee = false;
        try {
          const legacyRes = await supabase.from(STATUS_TABLE).select("month, published, note, created_at");
          statusData = legacyRes.data || [];
          if (legacyRes.error) {
            console.warn("Status table fetch failed", legacyRes.error);
          }
        } catch (legacyErr) {
          console.warn("Status table fetch failed", legacyErr);
          statusData = [];
        }
      }
      setSupportsEmployeeStatus(statusSupportsEmployee);

      const statusMap = statusSupportsEmployee
        ? new Map((statusData || []).map((s) => [`${s.month}_${s.employee_id}`, s]))
        : new Map((statusData || []).map((s) => [s.month, s]));

      // 3. Merge per payroll row so each employee submission is visible
      const merged = (payrollData || []).map(row => {
        const s = statusSupportsEmployee
          ? statusMap.get(`${row.month}_${row.employee_id}`)
          : statusMap.get(row.month);
        return {
          id: row.id,
          employeeId: row.employee_id,
          month: row.month,
          basic: toNum(row.basic_salary),
          hra: toNum(row.hra),
          allowances: toNum(row.allowances),
          deductions: toNum(row.deductions),
          net: toNum(row.net_salary),
          gross: toNum(row.basic_salary) + toNum(row.hra) + toNum(row.allowances),
          deductionSplit: splitDeductions(row.deductions),
          status: s?.published ? "Approved" : "Pending Approval",
          remarks: s?.note || "Awaiting manager review",
          created_at: s?.created_at || row.created_at || new Date().toISOString(),
          isPublished: !!s?.published
        };
      });

      setBatches(merged);
    } catch (err) {
      console.error("Error fetching batches:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const saveStatusRow = async (payload) => {
    const { month, employee_id } = payload;
    if (!month || (supportsEmployeeStatus && !employee_id)) throw new Error("Missing employee_id for status update");

    const cleanPayload = supportsEmployeeStatus
      ? payload
      : { month: payload.month, published: payload.published, note: payload.note };

    const selectFields = supportsEmployeeStatus ? "month, employee_id" : "month";

    const query = supabase.from(STATUS_TABLE).update(cleanPayload).eq("month", month);
    if (supportsEmployeeStatus) query.eq("employee_id", employee_id);

    const { data, error: updateErr } = await query.select(selectFields);

    if (updateErr) throw updateErr;

    if (!data || data.length === 0) {
      const insertPayload = supportsEmployeeStatus ? cleanPayload : { ...cleanPayload };
      const { error: insertErr } = await supabase.from(STATUS_TABLE).insert(insertPayload);
      if (insertErr) throw insertErr;
    }
  };

  const handleApprove = async (month, employeeId) => {
    if (!supportsEmployeeStatus) {
      setError("Per-employee approval needs an employee_id column on hrmss_payslip_records. Currently approvals are month-level.");
      return;
    }
    setActionLoading(true);
    try {
      // Upsert into hrmss_payslip_records to mark as Approved (published=true)
      await saveStatusRow({
        month,
        employee_id: employeeId,
        published: true,
        note: "Approved by Manager",
      });

      await fetchBatches();
    } catch (err) {
      alert("Failed to approve: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (month, employeeId) => {
    if (!supportsEmployeeStatus) {
      setError("Per-employee rejection needs an employee_id column on hrmss_payslip_records. Currently approvals are month-level.");
      return;
    }
    setActionLoading(true);
    try {
      // For rejection, we can either delete from status table or mark published=false with a note
      await saveStatusRow({
        month,
        employee_id: employeeId,
        published: false,
        note: "Rejected by Manager",
      });

      await fetchBatches();
    } catch (err) {
      alert("Failed to reject: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-slate-900 text-white p-5 flex items-center gap-3 shadow-xl">
        <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
          <Lock className="text-indigo-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Manager Portal</p>
          <p className="text-xl font-black">Payroll Approval Center</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">
          <CheckCircle size={12} /> Approver Access
        </span>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <FileSpreadsheet size={18} className="text-indigo-600" />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-900">Payroll Runs</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase">Real-time database records</p>
            </div>
          </div>
          <button 
            onClick={fetchBatches} 
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : "Refresh Data"}
          </button>
        </div>

        {!supportsEmployeeStatus ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            Per-employee approval needs an <b>employee_id</b> column on hrmss_payslip_records. Currently approvals are month-level; add the column in Supabase to approve individually.
          </div>
        ) : null}

        {loading ? (
            <div className="py-12 text-center">
                <Loader2 size={32} className="animate-spin mx-auto text-indigo-600 mb-2" />
                <p className="text-sm text-slate-500 font-medium">Fetching payroll batches...</p>
            </div>
        ) : error ? (
            <div className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-center">
                <XCircle size={24} className="mx-auto text-rose-600 mb-2" />
                <p className="text-sm text-rose-700 font-bold">{error}</p>
                <button onClick={fetchBatches} className="mt-2 text-xs font-bold text-rose-600 underline">Try again</button>
            </div>
        ) : batches.length === 0 ? (
            <div className="py-12 text-center rounded-3xl border-2 border-dashed border-slate-100 bg-slate-50/50">
                <Receipt size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-bold">No Payroll Data Detected</p>
                <p className="text-xs text-slate-400 mt-1">When HR generates payroll, it will appear here for your review.</p>
            </div>
        ) : (
            <div className="grid gap-4">
              {batches.map((row) => (
                <div
                  key={`${row.month}-${row.id}`}
                  className={`rounded-2xl border transition-all p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    row.status === "Approved"
                      ? "bg-emerald-50/30 border-emerald-100"
                      : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        row.status === "Approved" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                      }`}
                    >
                      <CalendarClock month={row.month} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-slate-900 text-lg">{row.month}</p>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            row.status === "Approved"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : row.status === "Pending Approval"
                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {row.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenDetailsId(openDetailsId === row.id ? "" : row.id)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 px-2 py-1 border border-indigo-100 rounded-lg hover:bg-indigo-50"
                        >
                          <Eye size={12} /> {openDetailsId === row.id ? "Hide" : "Details"}
                        </button>
                      </div>
                      <p className="text-sm text-slate-500 font-medium mt-0.5">
                        Employee: <span className="font-bold text-slate-900">{row.employeeId || "-"}</span>
                      </p>
                      <p className="text-sm text-slate-500 font-medium">
                        Net Pay: <span className="font-bold text-emerald-700">{formatInr(row.net)}</span>
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                        Last Update: {formatDDMMYYYY(row.created_at)}
                      </p>
                      {openDetailsId === row.id ? (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-2">
                          <p className="font-semibold text-slate-700">Payroll Details</p>
                          <div className="grid grid-cols-2 gap-2">
                            <DetailItem label="Basic" value={formatInr(row.basic)} />
                            <DetailItem label="HRA" value={formatInr(row.hra)} />
                            <DetailItem label="Allowances" value={formatInr(row.allowances)} />
                            <DetailItem label="Gross Salary" value={formatInr(row.gross)} />
                            <DetailItem label="Loan Deduction" value={formatInr(row.deductionSplit.loan)} />
                            <DetailItem label="Salary Advance Deduction" value={formatInr(row.deductionSplit.salaryAdvance)} />
                            <DetailItem label="Leave Deduction" value={formatInr(row.deductionSplit.leave)} />
                            <DetailItem label="Total Deductions" value={formatInr(row.deductions)} />
                            <DetailItem label="Net Salary" value={formatInr(row.net)} emphasize />
                          </div>
                          <p className="text-[10px] text-slate-500">
                            Net Salary = Gross Salary - Deductions
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Remarks: <span className="font-bold text-slate-900">{row.remarks}</span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center self-end">
                    {row.status === "Pending Approval" ? (
                      <>
                        <button
                          onClick={() => handleApprove(row.month, row.employeeId)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-lg shadow-indigo-200 disabled:opacity-50"
                        >
                          <CheckCircle size={14} /> APPROVE
                        </button>
                        <button
                          onClick={() => handleReject(row.month, row.employeeId)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-xl transition disabled:opacity-50"
                        >
                          <XCircle size={14} /> REJECT
                        </button>
                        {!supportsEmployeeStatus ? (
                          <p className="text-[10px] text-amber-700 font-semibold">
                            Add an `employee_id` column to hrmss_payslip_records for per-employee approvals.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                          Finalized
                        </span>
                        <p className="text-[9px] text-slate-400 font-bold mt-1">READY FOR PAYSLIP DISTRIBUTION</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
    </div>
  );
}


function DetailItem({ label, value, emphasize = false }) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <span className="text-[10px] font-semibold text-slate-500">{label}</span>
      <span className={`text-[11px] font-bold ${emphasize ? "text-emerald-700" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function CalendarClock({ month }) {
    const [m, y] = month.split("-");
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const monthIndex = parseInt(m) - 1;
    return (
        <div className="text-center leading-none">
            <p className="text-[10px] font-black opacity-60 uppercase">{monthNames[monthIndex] || m}</p>
            <p className="text-lg font-black">{y?.slice(-2)}</p>
        </div>
    );
}
