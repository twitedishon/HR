
import { useMemo, useState, useEffect } from "react";
import {
  Banknote,
  CalendarDays,
  Download,
  Printer,
  ShieldCheck,
  User,

  AlertCircle,
} from "lucide-react";
import { PrimaryButton } from "./shared/ui.jsx";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);


function numberToWords(n) {
  const ones = [
    "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const toWordsBelow100 = (x) => {
    if (x < 20) return ones[x];
    const t = Math.floor(x / 10);
    const o = x % 10;
    return tens[t] + (o ? " " + ones[o] : "");
  };

  const toWordsBelow1000 = (x) => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    if (!h) return toWordsBelow100(r);
    if (!r) return ones[h] + " Hundred";
    return ones[h] + " Hundred " + toWordsBelow100(r);
  };

  const num = Math.floor(Number(n || 0));
  if (Number.isNaN(num)) return "";
  if (num === 0) return "Zero";
  if (num < 1000) return toWordsBelow1000(num);

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;

  const parts = [];
  if (crore) parts.push(toWordsBelow1000(crore) + " Crore");
  if (lakh) parts.push(toWordsBelow1000(lakh) + " Lakh");
  if (thousand) parts.push(toWordsBelow1000(thousand) + " Thousand");
  if (rest) parts.push(toWordsBelow1000(rest));

  return parts.join(" ");
}

const MonthCard = ({ label, selected, onClick, paidOn }) => (
  <button
    onClick={onClick}
    className={`w-full text-left rounded-2xl border px-4 py-3 shadow-sm transition ${
      selected
        ? "border-indigo-300 bg-indigo-50"
        : "border-slate-200 bg-white hover:bg-slate-50"
    }`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-extrabold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">Paid on {paidOn}</p>
      </div>
      {selected ? (
        <span className="text-[11px] font-semibold text-indigo-700">
          Viewing
        </span>
      ) : (
        <span className="text-[11px] font-semibold text-slate-500">Open</span>
      )}
    </div>
  </button>
);

const Pill = ({ label, value }) => (
  <div className="rounded-xl border bg-white px-4 py-3 text-center shadow-sm">
    <p className="text-xs font-semibold text-slate-500 uppercase">{label}</p>
    <p className="mt-1 text-lg font-extrabold text-slate-900">{value}</p>
  </div>
);

export default function EmployeePayslips() {

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [company] = useState({
    name: "Twite AI Technology",
    address: "Plot 45, Electronic City, Bengaluru, Karnataka - 560100",
  });
  const [payslipData, setPayslipData] = useState({});
  const [selected, setSelected] = useState("");

  const months = useMemo(() => Object.keys(payslipData), [payslipData]);
  const data = payslipData[selected] || (months.length > 0 ? payslipData[months[0]] : null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const authSession = JSON.parse(localStorage.getItem("HRMSS_AUTH_SESSION") || "{}");
        const employeeId = authSession.employee_id || authSession.id || authSession.identifier;

        if (!employeeId) {
          throw new Error("User session not found. Please login again.");
        }

        if (!isSupabaseConfigured) {
          throw new Error("Database not configured.");
        }

        // 1. Fetch Employee Details
        const { data: emp, error: empErr } = await supabase
          .from("hrmss_employees")
          .select("*")
          .eq("employee_id", employeeId)
          .maybeSingle();

        if (empErr) throw empErr;

        // 2. Fetch Payroll Data
        const { data: payroll, error: payErr } = await supabase
          .from("hrmss_payroll")
          .select("*")
          .eq("employee_id", employeeId)
          .order("month", { ascending: false });

        if (payErr) throw payErr;

        if (!payroll || payroll.length === 0) {
          setPayslipData({});
          setLoading(false);
          return;
        }

        // 3. Map to payslipData format
        const mappedData = {};
        payroll.forEach((p) => {
          const monthKey = p.month || "Unknown";
          mappedData[monthKey] = {
            month: monthKey,
            employee: {
              name: emp?.full_name || "Unknown",
              id: emp?.employee_id || employeeId,
              designation: emp?.role || emp?.designation || "-",
              department: emp?.department || "-",
              doj: emp?.join_date || "-",
            },
            earnings: [
              { label: "Basic Salary", value: p.basic_salary || 0 },
              { label: "House Rent Allowance (HRA)", value: p.hra || 0 },
              { label: "Allowances", value: p.allowances || 0 },
            ],
            deductions: [
              { label: "Deductions", value: p.deductions || 0 },
            ],
            attendance: { 
              working: p.working_days || "-", 
              present: p.present_days || "-", 
              paidLeave: p.paid_leave || "-", 
              lop: p.lop_days || "-" 
            },
            bank: {
              name: emp?.bank_name || "-",
              account: emp?.account_number || "-",
              mode: p.payment_mode || "Bank Transfer",
              paidOn: p.paid_on || p.created_at?.split("T")[0] || "-",
            },
            paidOn: p.paid_on || p.created_at?.split("T")[0] || "-",
          };
        });

        setPayslipData(mappedData);
        const firstMonth = Object.keys(mappedData)[0];
        if (firstMonth) setSelected(firstMonth);

      } catch (err) {
        console.error("Error fetching payslip:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const totals = useMemo(() => {
    if (!data) return { earn: 0, ded: 0, net: 0 };
    const earn = (data?.earnings || []).reduce((a, b) => a + b.value, 0);
    const ded = (data?.deductions || []).reduce((a, b) => a + b.value, 0);
    return { earn, ded, net: earn - ded };
  }, [data]);


  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <p className="ml-3 text-slate-600">Loading your payslips...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-100 bg-rose-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-3 text-rose-600" size={40} />
        <p className="text-lg font-bold text-rose-900">Unable to load payslips</p>
        <p className="text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
        <Banknote className="mx-auto mb-4 text-slate-300" size={48} />
        <h3 className="text-xl font-bold text-slate-900">No Payslips Found</h3>
        <p className="mt-2 text-slate-500">You don't have any payslips available in the system yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-3 xl:gap-6">
        <div className="space-y-3 xl:col-span-1">
          <div className="rounded-3xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Payslip Months
                </p>
                <p className="text-lg font-extrabold text-slate-900">
                  Select a month
                </p>
              </div>
              <Banknote size={18} className="text-slate-500" />
            </div>
            <div className="mt-3 space-y-2">
              {months.map((m) => (
                <MonthCard
                  key={m}
                  label={m}
                  paidOn={payslipData[m].paidOn}
                  selected={selected === m}
                  onClick={() => setSelected(m)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            {/* HEADER with LOGO */}
            <div className="bg-indigo-700 px-6 py-4 text-white flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                {/* Put your logo here: public/twite-logo.jpg */}
                <img
                  src="/twite-logo.jpg"
                  alt="Twite AI Technology"
                  className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1"
                />
                <div>
                  <p className="text-xl font-extrabold">{company.name}</p>
                  <p className="text-sm text-white/80">{company.address}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[13px] font-semibold text-white/80">
                  Payslip for
                </p>
                <p className="text-lg font-bold">{data?.month}</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <User size={16} />
                  Employee Details
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 text-sm text-slate-800">
                  <Pill label="Employee Name" value={data?.employee?.name} />
                  <Pill label="Employee ID" value={data?.employee?.id} />
                  <Pill label="Designation" value={data?.employee?.designation} />
                  <Pill label="Department" value={data?.employee?.department} />
                  <Pill label="Date of Joining" value={data?.employee?.doj} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <p className="text-sm font-extrabold text-slate-900">
                    Earnings
                  </p>
                  <div className="mt-2 divide-y text-sm">
                    {(data?.earnings || []).map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-bold text-emerald-700 tabular-nums">
                          {money(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-bold text-emerald-800">
                    <span>Total Earnings (Gross)</span>
                    <span>{money(totals.earn)}</span>
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <p className="text-sm font-extrabold text-slate-900">
                    Deductions
                  </p>
                  <div className="mt-2 divide-y text-sm">
                    {(data?.deductions || []).map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between py-2"
                      >
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-bold text-rose-700 tabular-nums">
                          - {money(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm font-bold text-rose-700">
                    <span>Total Deductions</span>
                    <span>- {money(totals.ded)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarDays size={16} />
                  Attendance Summary
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Pill
                    label="Total Working Days"
                    value={data?.attendance?.working ?? "-"}
                  />
                  <Pill
                    label="Days Present"
                    value={data?.attendance?.present ?? "-"}
                  />
                  <Pill
                    label="Paid Leave"
                    value={data?.attendance?.paidLeave ?? "-"}
                  />
                  <Pill
                    label="Loss of Pay (LOP)"
                    value={data?.attendance?.lop ?? "-"}
                  />
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <p className="text-sm font-extrabold text-slate-900">
                  Net Pay Summary
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Total Earnings</span>
                    <span className="font-bold text-emerald-700">
                      {money(totals.earn)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-700">Total Deductions</span>
                    <span className="font-bold text-rose-700">
                      - {money(totals.ded)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-700">
                    Net Pay (Take-Home)
                  </p>
                  <p className="text-2xl font-extrabold text-emerald-800">
                    {money(totals.net)}
                  </p>
                  <p className="text-[11px] text-emerald-700">

                    Rupees {numberToWords(totals.net)} Only
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Banknote size={16} />
                  Payment Details
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 text-sm">
                  <Pill label="Bank Name" value={data?.bank?.name} />
                  <Pill label="Account Number" value={data?.bank?.account} />
                  <Pill label="Payment Mode" value={data?.bank?.mode} />
                  <Pill label="Paid On" value={data?.bank?.paidOn} />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <ShieldCheck size={14} />
                This is a system-generated payslip and does not require a
                signature.
              </div>

              <div className="flex flex-wrap gap-2">
                <PrimaryButton

                  onClick={() => alert("Downloading payslip PDF...")}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  <Download size={16} />
                  Download PDF
                </PrimaryButton>

                <PrimaryButton
                  onClick={handlePrint}
                  className="bg-white text-slate-900 border border-slate-200 hover:bg-slate-50"
                >
                  <Printer size={16} />
                  Print
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
