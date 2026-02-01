// src/pages/hr/Payroll.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Filter,
  Trash2,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  Percent,
  ReceiptIndianRupee,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  BadgeIndianRupee,
  Banknote,
  X,
  Save,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

/* ---------------- CONFIG ---------------- */
const EMP_TABLE = "hrmss_employees";
const PAYROLL_TABLE = "hrmss_payroll";
const BATCH_TABLE = "hrmss_payslip_records";
const PROFILE_TABLE = "hrmss_profiles"; // optional (bank details)
const ATT_TABLE = "employee_attendance"; // optional
const LEAVE_TABLE = "hrmss_leave_requests"; // optional (if exists)

const COMPANY = {
  name: import.meta.env.VITE_COMPANY_NAME || "HRMS Pvt Ltd",
  addressLine1: import.meta.env.VITE_COMPANY_ADDRESS_LINE1 || "123 Business Park",
  logoUrl: import.meta.env.VITE_COMPANY_LOGO || "",
};

/* ---------------- helpers ---------------- */
const inr = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const monthMap = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};
const monthList = Object.keys(monthMap);

const monthKey = (monthName, year) => {
  const mm = monthMap[monthName] || "01";
  return `${year}-${mm}`; // "2025-01"
};

// Format period from YYYY-MM to MM/YYYY for display
const formatPeriodDisplay = (periodKey) => {
  if (!periodKey || !periodKey.includes("-")) return periodKey;
  const [year, month] = periodKey.split("-");
  return `${month}/${year}`;
};

const monthRange = (monthName, year) => {
  const mm = Number(monthMap[monthName] || "01");
  const yy = Number(year);
  const start = new Date(yy, mm - 1, 1);
  const end = new Date(yy, mm, 1); // next month 1st (exclusive)
  const toISODate = (d) => d.toISOString().slice(0, 10);
  return { startDate: toISODate(start), endDate: toISODate(end) };
};

const maskAccount = (v) => {
  const s = String(v || "").replace(/\s+/g, "");
  if (!s) return "-";
  if (s.length <= 4) return `XXXX`;
  return `XXXX XXXX ${s.slice(-4)}`;
};

const toNum = (v) => {
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
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

const calcDeductionsTotal = (vals = {}) =>
  toNum(vals.loanDeduction) + toNum(vals.salaryAdvanceDeduction) + toNum(vals.leaveDeduction);

const numberToWords = (num) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const units = [
    { label: "Crore", value: 10000000 },
    { label: "Lakh", value: 100000 },
    { label: "Thousand", value: 1000 },
    { label: "Hundred", value: 100 },
  ];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return [tens[t], ones[o]].filter(Boolean).join(" ");
  };

  const segment = (n) => {
    let remaining = n;
    const parts = [];
    for (const u of units) {
      if (remaining >= u.value) {
        const count = Math.floor(remaining / u.value);
        remaining = remaining % u.value;
        parts.push(`${twoDigits(count)} ${u.label}`);
      }
    }
    if (remaining) parts.push(twoDigits(remaining));
    return parts.join(" ");
  };

  const n = Math.floor(toNum(num));
  if (!n) return "Zero";
  return segment(n).trim();
};

/* ---------------- small UI bits ---------------- */
function TabButton({ active, icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold border transition",
        active
          ? "bg-white shadow-sm border-slate-200 text-slate-900"
          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white",
      ].join(" ")}
    >
      <Icon size={14} className={active ? "text-slate-900" : "text-slate-500"} />
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const isApproved = status === "Approved";
  const isPending = status === "Pending Approval" || status === "Pending";
  const isGenerated = status === "Generated";

  let bgClass = "bg-slate-50 text-slate-700";
  let dotClass = "bg-slate-400";

  if (isApproved) {
    bgClass = "bg-emerald-50 text-emerald-700";
    dotClass = "bg-emerald-500";
  } else if (isPending) {
    bgClass = "bg-amber-50 text-amber-700";
    dotClass = "bg-amber-500";
  } else if (isGenerated) {
    bgClass = "bg-blue-50 text-blue-700";
    dotClass = "bg-blue-500";
  }

  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold",
        bgClass,
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", dotClass].join(" ")} />
      {status}
    </span>
  );
}

function StatCard({ variant, title, value, sub, icon: Icon, onClick, active }) {
  const map = {
    white: "bg-white border-slate-200",
    navy: "bg-[#1C2648] border-[#1C2648] text-white",
    yellow: "bg-[#FFF7D6] border-[#F3E4A8]",
    green: "bg-[#02A88A] border-[#02A88A] text-white",
  };

  const iconWrap = {
    white: "bg-slate-50 border-slate-200",
    navy: "bg-white/10 border-white/10",
    yellow: "bg-[#FFF1B8] border-[#F3E4A8]",
    green: "bg-white/10 border-white/10",
  };

  const titleCls = variant === "navy" || variant === "green" ? "text-white/80" : "text-slate-500";
  const subCls = variant === "navy" || variant === "green" ? "text-white/70" : "text-slate-500";
  const isClickable = Boolean(onClick);
  const Wrapper = isClickable ? "button" : "div";

  return (
    <Wrapper
      type={isClickable ? "button" : undefined}
      onClick={onClick}
      className={[
        "rounded-xl border p-4 text-left transition",
        map[variant],
        isClickable ? "hover:-translate-y-0.5 hover:shadow-md" : "",
        active ? "ring-2 ring-emerald-300" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-xs font-semibold ${titleCls}`}>{title}</p>
          <p
            className={[
              "mt-2 text-2xl font-extrabold tracking-tight tabular-nums",
              variant === "navy" || variant === "green" ? "text-white" : "text-slate-900",
            ].join(" ")}
          >
            {value}
          </p>
          {sub ? <p className={`mt-1 text-[11px] ${subCls}`}>{sub}</p> : null}
        </div>

        <div className={["h-9 w-9 rounded-lg border grid place-items-center shrink-0", iconWrap[variant]].join(" ")}>
          <Icon size={16} className={variant === "navy" || variant === "green" ? "text-white" : "text-slate-700"} />
        </div>
      </div>
    </Wrapper>
  );
}

function ActionTile({ tone = "white", icon: Icon, disabled, title, onClick }) {
  const map = {
    navy: "bg-[#1C2648] text-white border-[#1C2648] hover:opacity-95",
    blue: "bg-[#3F49E0] text-white border-[#3F49E0] hover:opacity-95",
    mint: "bg-[#7ED7C1] text-[#0B3B33] border-[#7ED7C1] hover:opacity-95",
    white: "bg-white text-slate-900 border-slate-200 hover:bg-slate-50",
    disabled: "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed",
  };

  const cls = disabled ? map.disabled : map[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={["h-14 rounded-xl border px-4 flex items-center justify-center gap-2 text-xs font-semibold", cls].join(
        " "
      )}
    >
      <Icon size={16} className={disabled ? "text-slate-400" : ""} />
      {title}
    </button>
  );
}

/* ---------------- page ---------------- */
export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(monthList[now.getMonth()] || "January");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [tab, setTab] = useState("all"); // all | approved | pending
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All | Approved | Pending

  const [batchStatus, setBatchStatus] = useState("Draft"); // Draft / Pending / Approved / Paid

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteErr, setDeleteErr] = useState("");

  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [activeStat, setActiveStat] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [actionEmpId, setActionEmpId] = useState("");
  const [actionForm, setActionForm] = useState({
    basic: 0,
    hra: 0,
    conveyance: 0,
    medicalAllowance: 0,
    specialAllowance: 0,
    pfEmployee: 0,
    pfEmployer: 0,
    esiEmployee: 0,
    esiEmployer: 0,
    professionalTax: 0,
  });
  const [actionSaving, setActionSaving] = useState(false);
  const [actionSaveErr, setActionSaveErr] = useState("");

  // details helpers
  const [bankInfo, setBankInfo] = useState(null);
  const [attSummary, setAttSummary] = useState(null); // { workingDays, presentDays, rate }
  const [leaveSummary, setLeaveSummary] = useState(null); // { paidLeave, lopDays } (optional)

  // Create/Edit modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payModalEmpId, setPayModalEmpId] = useState("");
  const [payFixedEmp, setPayFixedEmp] = useState(false); // if opened from row/details -> fixed employee
  const [payForm, setPayForm] = useState({
    basic: 0,
    hra: 0,
    conveyance: 0,
    medicalAllowance: 0,
    specialAllowance: 0,
    pfEmployee: 0,
    pfEmployer: 0,
    esiEmployee: 0,
    esiEmployer: 0,
    professionalTax: 0,
  });
  const [payslipAttendance, setPayslipAttendance] = useState({
    workingDays: "",
    presentDays: "",
    paidLeave: "",
    lopDays: "",
  });
  const [payslipBreakup, setPayslipBreakup] = useState({
    basic: 0,
    hra: 0,
    conveyance: 0,
    medicalAllowance: 0,
    specialAllowance: 0,
    pfEmployee: 0,
    pfEmployer: 0,
    esiEmployee: 0,
    esiEmployer: 0,
    professionalTax: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  const periodKey = useMemo(() => monthKey(month, year), [month, year]);
  const periodRange = useMemo(() => monthRange(month, year), [month, year]);

  /* ---------------- FETCH: employees + payroll ---------------- */
  const fetchPayrollData = async () => {
    setLoading(true);
    setErrorMsg("");

    const empRes = await supabase
      .from(EMP_TABLE)
      .select("employee_id, full_name, role, department, status")
      .order("employee_id", { ascending: true });

    if (empRes.error) {
      setRows([]);
      setLoading(false);
      setErrorMsg(`Employees fetch failed: ${empRes.error.message}`);
      return;
    }

    const employees = (empRes.data || [])
      .filter((e) => String(e.status || "Active") !== "Inactive")
      .map((e) => ({
        empId: String(e.employee_id),
        name: String(e.full_name || ""),
        role: String(e.role || "Employee"),
        department: String(e.department || "-"),
      }));

    const payRes = await supabase
      .from(PAYROLL_TABLE)
      .select(
        "id, employee_id, month, basic_salary, hra, allowances, conveyance_allowance, medical_allowance, special_allowance, pf_employee, pf_employer, esi_employee, esi_employer, professional_tax, deductions, net_salary, created_at, ctc"
      )
      .eq("month", periodKey);

    if (payRes.error) {
      setRows([]);
      setLoading(false);
      setErrorMsg(`Payroll fetch failed: ${payRes.error.message}`);
      return;
    }

    const payrollByEmp = new Map();
    for (const p of payRes.data || []) payrollByEmp.set(String(p.employee_id), p);

    const merged = employees.map((e) => {
      const p = payrollByEmp.get(e.empId);

      const basic = Number(p?.basic_salary || 0);
      const hra = Number(p?.hra || 0);
      const conveyance = Number(p?.conveyance_allowance || 0);
      const medicalAllowance = Number(p?.medical_allowance || 0);
      const specialAllowance = Number(p?.special_allowance || 0);
      const allowancesRaw = Number(p?.allowances || 0);
      const allowances = conveyance + medicalAllowance + specialAllowance || allowancesRaw;
      const pfEmployee = Number(p?.pf_employee || 0);
      const pfEmployer = Number(p?.pf_employer || 0);
      const esiEmployee = Number(p?.esi_employee || 0);
      const esiEmployer = Number(p?.esi_employer || 0);
      const professionalTax = Number(p?.professional_tax || 0);
      const deductionsRaw = Number(p?.deductions || 0);
      const deductions = pfEmployee + esiEmployee + professionalTax || deductionsRaw;

      const gross = basic + hra + allowances;
      const net = Number(p?.net_salary ?? Math.max(gross - deductions, 0));

      // HR-created payrolls are auto-approved; no manager step.
      const status = p?.id ? "Approved" : "Pending";

      return {
        empId: e.empId,
        name: e.name,
        role: e.role,
        department: e.department,

        payrollId: p?.id || null,
        basic,
        hra,
        allowances,
        conveyance,
        medicalAllowance,
        specialAllowance,
        pfEmployee,
        pfEmployer,
        esiEmployee,
        esiEmployer,
        professionalTax,
        deductions,
        gross,
        net,
        ctc: Number(p?.ctc || (gross + pfEmployer + esiEmployer)),

        status,
        createdAt: p?.created_at || null,
      };
    });

    // Aggregate batch status for header
    const hasAnyPayroll = merged.some((r) => r.payrollId);
    const approvedCount = merged.filter((r) => r.status === "Approved").length;
    let currentBatchStatus = "Draft";
    if (hasAnyPayroll) {
      currentBatchStatus = approvedCount === merged.length ? "Approved" : "Pending";
    }
    setBatchStatus(currentBatchStatus);

    setRows(merged);

    if (!selectedEmpId && merged.length) {
      setSelectedEmpId(merged[0].empId);
    } else if (selectedEmpId && !merged.some((r) => r.empId === selectedEmpId)) {
      setSelectedEmpId(merged[0]?.empId || "");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPayrollData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey]);

  useEffect(() => {
    if (!actionEmpId && rows.length) {
      setActionEmpId(rows[0].empId);
    } else if (actionEmpId && !rows.some((r) => r.empId === actionEmpId)) {
      setActionEmpId(rows[0]?.empId || "");
    }
  }, [rows, actionEmpId]);

  const fillActionFormFromRow = (empId) => {
    const target = rows.find((r) => r.empId === empId) || rows[0] || null;
    const base = {
      basic: 0,
      hra: 0,
      conveyance: 0,
      medicalAllowance: 0,
      specialAllowance: 0,
      pfEmployee: 0,
      pfEmployer: 0,
      esiEmployee: 0,
      esiEmployer: 0,
      professionalTax: 0,
    };
    if (!target) {
      setActionForm(base);
      return;
    }
    const pfEmp = toNum(target.pfEmployee);
    const esiEmp = toNum(target.esiEmployee);
    const pt = toNum(target.professionalTax);
    const dedFallback = pfEmp + esiEmp + pt || toNum(target.deductions);
    setActionForm({
      basic: toNum(target.basic),
      hra: toNum(target.hra),
      conveyance: toNum(target.conveyance),
      medicalAllowance: toNum(target.medicalAllowance),
      specialAllowance: toNum(target.specialAllowance || target.allowances),
      pfEmployee: pfEmp || dedFallback,
      pfEmployer: toNum(target.pfEmployer),
      esiEmployee: esiEmp,
      esiEmployer: toNum(target.esiEmployer),
      professionalTax: pt,
    });
  };

  useEffect(() => {
    if (activeAction === "create") {
      fillActionFormFromRow(actionEmpId || rows[0]?.empId || "");
      setActionSaveErr("");
      setActionSaving(false);
    }
  }, [actionEmpId, activeAction, rows]);

  useEffect(() => {
    if (activeAction === "payslip") {
      const target =
        rows.find((r) => r.empId === actionEmpId) || rows.find((r) => r.empId === selectedEmpId) || rows[0] || null;
      if (target) {
        setPayslipBreakup({
          basic: toNum(target.basic),
          hra: toNum(target.hra),
          conveyance: toNum(target.conveyance),
          medicalAllowance: toNum(target.medicalAllowance),
          specialAllowance: toNum(target.specialAllowance || target.allowances),
          pfEmployee: toNum(target.pfEmployee),
          pfEmployer: toNum(target.pfEmployer),
          esiEmployee: toNum(target.esiEmployee),
          esiEmployer: toNum(target.esiEmployer),
          professionalTax: toNum(target.professionalTax),
        });
      }
    }
  }, [activeAction, actionEmpId, selectedEmpId, rows]);

  /* ---------------- FILTERED LIST ---------------- */
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((r) => {
      // 1. Status Filter
      if (statusFilter !== "All" && r.status !== statusFilter) {
        return false;
      }

      // 2. Search Query
      if (!q) return true;
      return (
        r.empId.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        String(r.role || "").toLowerCase().includes(q) ||
        String(r.department || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  /* ---------------- HEADER STATS ---------------- */
  const headerStats = useMemo(() => {
    const totalEmployees = rows.length;
    const grossTotal = rows.reduce((a, r) => a + Number(r.gross || 0), 0);
    const deductionsTotal = rows.reduce((a, r) => a + Number(r.deductions || 0), 0);
    const netTotal = rows.reduce((a, r) => a + Number(r.net || 0), 0);
    return { totalEmployees, grossTotal, deductionsTotal, netTotal };
  }, [rows]);

  const headerBreakdown = useMemo(() => {
    const totalBasic = rows.reduce((a, r) => a + toNum(r.basic), 0);
    const totalHra = rows.reduce((a, r) => a + toNum(r.hra), 0);
    const totalAllowances = rows.reduce((a, r) => a + toNum(r.allowances), 0);
    const grossTotal = totalBasic + totalHra + totalAllowances;
    const deductionsTotal = rows.reduce((a, r) => a + toNum(r.deductions), 0);
    const netTotal = rows.reduce((a, r) => a + toNum(r.net), 0);

    const approvedRows = rows.filter((r) => r.status === "Approved");
    const approvedNetTotal = approvedRows.reduce((a, r) => a + toNum(r.net), 0);
    const processed = approvedRows.length;
    const pending = rows.length - processed;

    return {
      totalBasic,
      totalHra,
      totalAllowances,
      grossTotal,
      deductionsTotal,
      netTotal,
      approvedNetTotal,
      processed,
      pending,
      deductionSplit: splitDeductions(deductionsTotal),
    };
  }, [rows]);

  /* ---------------- CLICK EMPLOYEE -> DETAILS ---------------- */
  const openEmployeeDetails = (empId) => {
    setSelectedEmpId(empId);
    setTab("details");
  };

  const selectedRow = useMemo(() => rows.find((r) => r.empId === selectedEmpId) || null, [rows, selectedEmpId]);
  const actionRow = useMemo(() => rows.find((r) => r.empId === actionEmpId) || null, [rows, actionEmpId]);
  const actionAllowances = useMemo(
    () => toNum(actionForm.conveyance) + toNum(actionForm.medicalAllowance) + toNum(actionForm.specialAllowance),
    [actionForm]
  );
  const actionGross = useMemo(
    () => toNum(actionForm.basic) + toNum(actionForm.hra) + actionAllowances,
    [actionForm, actionAllowances]
  );
  const actionDeductionsTotal = useMemo(
    () => toNum(actionForm.pfEmployee) + toNum(actionForm.esiEmployee) + toNum(actionForm.professionalTax),
    [actionForm]
  );
  const actionNet = useMemo(
    () => Math.max(actionGross - actionDeductionsTotal, 0),
    [actionGross, actionDeductionsTotal]
  );

  const actionCTC = useMemo(
    () => actionGross + toNum(actionForm.pfEmployer) + toNum(actionForm.esiEmployer),
    [actionGross, actionForm]
  );

  /* ---------------- DETAILS: bank + attendance + leaves (optional) ---------------- */
  const fetchDetailsForEmployee = async (empId) => {
    if (!empId) return;

    const [profRes, empRes] = await Promise.all([
      supabase
        .from(PROFILE_TABLE)
        .select("employee_id, bank_name, account_number, ifsc_code, branch")
        .eq("employee_id", empId)
        .maybeSingle(),
      supabase
        .from(EMP_TABLE)
        .select("employee_id, bank_name, account_number, ifsc_code, branch")
        .eq("employee_id", empId)
        .maybeSingle(),
    ]);

    const profRow = !profRes.error ? profRes.data : null;
    const empRow = !empRes.error ? empRes.data : null;
    setBankInfo(profRow || empRow || null);

    try {
      const { startDate, endDate } = periodRange;
      const attRes = await supabase
        .from(ATT_TABLE)
        .select("attendance_date, status")
        .eq("employee_id", empId)
        .gte("attendance_date", startDate)
        .lt("attendance_date", endDate);

      if (!attRes.error) {
        const rr = attRes.data || [];
        const presentDays = rr.filter((x) => x.status === "Present").length;
        const workingDays = rr.length || 0;
        const rate = workingDays ? Math.round((presentDays / workingDays) * 100) : 0;
        setAttSummary({ workingDays, presentDays, rate });
      } else setAttSummary(null);
    } catch {
      setAttSummary(null);
    }

    try {
      const { startDate, endDate } = periodRange;

      const leaveRes = await supabase
        .from(LEAVE_TABLE)
        .select("id, owner_id, owner_role, status, from_date, to_date, mode")
        .eq("owner_role", "employee")
        .eq("owner_id", empId)
        .eq("status", "Approved")
        .gte("from_date", startDate)
        .lt("from_date", endDate);

      if (!leaveRes.error) {
        const paidLeave = (leaveRes.data || []).length;
        setLeaveSummary({ paidLeave, lopDays: 0 });
      } else setLeaveSummary(null);
    } catch {
      setLeaveSummary(null);
    }
  };

  useEffect(() => {
    if (tab === "details" && selectedEmpId) fetchDetailsForEmployee(selectedEmpId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedEmpId, periodKey]);

  useEffect(() => {
    if (activeAction === "payslip" && actionEmpId) {
      fetchDetailsForEmployee(actionEmpId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAction, actionEmpId, periodKey]);

  /* ---------------- ACTIONS ---------------- */
  const openActionDetails = (key) => setActiveAction(key);

  const saveBatchStatus = async (payload) => {
    const { month, employee_id } = payload;
    if (!month) return;

    const query = supabase.from(BATCH_TABLE).update(payload).eq("month", month);
    if (employee_id) query.eq("employee_id", employee_id);

    const { data, error: updateErr } = await query.select("month, employee_id");

    if (updateErr) {
      throw updateErr;
    }

    if (!data || data.length === 0) {
      const { error: insertErr } = await supabase.from(BATCH_TABLE).insert(payload);
      if (insertErr) throw insertErr;
    }
  };

  const savePayslipRecord = async (payload) => {
    const { month, employee_id } = payload;
    if (!month || !employee_id) throw new Error("Missing month or employee_id");

    // If an approved record exists, never downgrade it back to pending.
    const existing = await supabase
      .from(BATCH_TABLE)
      .select("id, published")
      .eq("month", month)
      .eq("employee_id", employee_id)
      .maybeSingle();

    const finalPayload =
      existing?.data && existing.data.published && payload.published === false
        ? { ...payload, published: true }
        : payload;

    const res = await supabase
      .from(BATCH_TABLE)
      .upsert(finalPayload, { onConflict: "month,employee_id" });
    if (res.error) throw res.error;
  };

  const onSubmitForApproval = async () => {
    setActionSaving(true);
    setActionSaveErr("");

    // Check if any payrolls exist
    const hasPayrolls = rows.some(r => r.payrollId);
    if (!hasPayrolls) {
      setActionSaveErr("No payroll records generated yet.");
      setActionSaving(false);
      return;
    }

    try {
      // Submit all existing payroll rows for this period
      const payloads = rows.filter((r) => r.payrollId).map((r) => ({
        month: periodKey,
        employee_id: r.empId,
        published: true,
        note: "Auto-approved by HR",
      }));

      for (const p of payloads) {
        // eslint-disable-next-line no-await-in-loop
        await saveBatchStatus(p);
      }
    } catch (err) {
      setActionSaveErr(err.message);
      setActionSaving(false);
      return;
    }

    setActionSaving(false);
    fetchPayrollData(); // refresh to update status to 'Approved'
    setActiveAction("");
  };

  const saveActionPayroll = async () => {
    if (!actionEmpId) return;
    setActionSaving(true);
    setActionSaveErr("");

    const payload = {
      employee_id: actionEmpId,
      month: periodKey,
      basic_salary: toNum(actionForm.basic),
      hra: toNum(actionForm.hra),
      conveyance_allowance: toNum(actionForm.conveyance),
      medical_allowance: toNum(actionForm.medicalAllowance),
      special_allowance: toNum(actionForm.specialAllowance),
      allowances: actionAllowances,
      pf_employee: toNum(actionForm.pfEmployee),
      pf_employer: toNum(actionForm.pfEmployer),
      esi_employee: toNum(actionForm.esiEmployee),
      esi_employer: toNum(actionForm.esiEmployer),
      professional_tax: toNum(actionForm.professionalTax),
      deductions: actionDeductionsTotal,
      net_salary: actionNet,
      ctc: actionCTC,
    };

    const res = await supabase.from(PAYROLL_TABLE).upsert(payload, { onConflict: "employee_id,month" });

    if (res.error) {
      setActionSaveErr(res.error.message);
      setActionSaving(false);
      return;
    }

    try {
      await saveBatchStatus({
        month: periodKey,
        employee_id: actionEmpId,
        published: true,
        note: "Auto-approved by HR",
      });
    } catch (err) {
      setActionSaveErr(err.message);
      setActionSaving(false);
      return;
    }

    setActionSaving(false);
    fetchPayrollData();
    setActiveAction("");
  };

  const saveAndApprovePayroll = async () => {
    if (!actionEmpId) return;
    setActionSaving(true);
    setActionSaveErr("");

    const payload = {
      employee_id: actionEmpId,
      month: periodKey,
      basic_salary: toNum(actionForm.basic),
      hra: toNum(actionForm.hra),
      conveyance_allowance: toNum(actionForm.conveyance),
      medical_allowance: toNum(actionForm.medicalAllowance),
      special_allowance: toNum(actionForm.specialAllowance),
      allowances: actionAllowances,
      pf_employee: toNum(actionForm.pfEmployee),
      pf_employer: toNum(actionForm.pfEmployer),
      esi_employee: toNum(actionForm.esiEmployee),
      professional_tax: toNum(actionForm.professionalTax),
      deductions: actionDeductionsTotal,
      net_salary: actionNet,
    };

    const res = await supabase.from(PAYROLL_TABLE).upsert(payload, { onConflict: "employee_id,month" });

    if (res.error) {
      setActionSaveErr(res.error.message);
      setActionSaving(false);
      return;
    }

    try {
      await saveBatchStatus({
        month: periodKey,
        employee_id: actionEmpId,
        published: true,
        note: "Auto-approved by HR",
      });
    } catch (err) {
      setActionSaveErr(err.message);
      setActionSaving(false);
      return;
    }

    setActionSaving(false);
    fetchPayrollData();
    setActiveAction("");
  };

  const deletePayroll = async (empId) => {
    if (!empId) return;
    const confirmDelete = window.confirm("Delete payroll for this employee for the selected month?");
    if (!confirmDelete) return;
    setDeleteErr("");

    const { error } = await supabase.from(PAYROLL_TABLE).delete().eq("employee_id", empId).eq("month", periodKey);
    if (error) {
      setDeleteErr(`Delete failed: ${error.message}`);
      return;
    }

    // Clean up batch records if present (best-effort).
    await supabase.from(BATCH_TABLE).delete().eq("employee_id", empId).eq("month", periodKey);
    fetchPayrollData();
  };

  const downloadCSV = () => {
    const header = [
      "Emp ID",
      "Employee",
      "Role",
      "Department",
      "Basic",
      "HRA",
      "Allowances",
      "Gross",
      "Deductions",
      "Net",
      "CTC",
      "Status",
    ];
    const lines = [header.join(",")];

    for (const r of filteredRows) {
      const row = [
        r.empId,
        `"${String(r.name || "").replaceAll('"', '""')}"`,
        `"${String(r.role || "").replaceAll('"', '""')}"`,
        `"${String(r.department || "").replaceAll('"', '""')}"`,
        String(Number(r.basic || 0)),
        String(Number(r.hra || 0)),
        String(Number(r.allowances || 0)),
        String(Number(r.gross || 0)),
        String(Number(r.deductions || 0)),
        String(Number(r.net || 0)),
        String(Number(r.ctc || 0)),
        r.status,
      ];
      lines.push(row.join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll_${periodKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ---------------- CREATE / EDIT PAYROLL MODAL ---------------- */
  const openPayrollModal = (empId = "", fixed = false) => {
    const fallbackEmp = empId || selectedEmpId || rows[0]?.empId || "";
    const r = rows.find((x) => x.empId === fallbackEmp) || null;
    const pfEmp = toNum(r?.pfEmployee);
    const esiEmp = toNum(r?.esiEmployee);
    const pt = toNum(r?.professionalTax);
    const deductionTotal = pfEmp + esiEmp + pt || toNum(r?.deductions);

    setPayModalOpen(true);
    setPayModalEmpId(fallbackEmp);
    setPayFixedEmp(Boolean(fixed));

    setPayForm({
      basic: toNum(r?.basic),
      hra: toNum(r?.hra),
      conveyance: toNum(r?.conveyance),
      medicalAllowance: toNum(r?.medicalAllowance),
      specialAllowance: toNum(r?.specialAllowance || r?.allowances),
      pfEmployee: pfEmp || deductionTotal,
      pfEmployer: toNum(r?.pfEmployer),
      esiEmployee: esiEmp,
      professionalTax: pt,
    });

    setSaveErr("");
  };

  const closePayrollModal = () => {
    if (saving) return;
    setPayModalOpen(false);
    setPayModalEmpId("");
    setPayFixedEmp(false);
    setSaveErr("");
  };

  const modalRow = useMemo(() => rows.find((x) => x.empId === payModalEmpId) || null, [rows, payModalEmpId]);

  const modalAllowances = useMemo(
    () => toNum(payForm.conveyance) + toNum(payForm.medicalAllowance) + toNum(payForm.specialAllowance),
    [payForm]
  );
  const modalGross = useMemo(
    () => toNum(payForm.basic) + toNum(payForm.hra) + modalAllowances,
    [payForm, modalAllowances]
  );
  const modalDeductions = useMemo(
    () => toNum(payForm.pfEmployee) + toNum(payForm.esiEmployee) + toNum(payForm.professionalTax),
    [payForm]
  );
  const modalNet = useMemo(() => Math.max(modalGross - modalDeductions, 0), [modalGross, modalDeductions]);
  const modalCTC = useMemo(
    () => modalGross + toNum(payForm.pfEmployer) + toNum(payForm.esiEmployer),
    [modalGross, payForm]
  );

  const savePayroll = async () => {
    if (!payModalEmpId) return;

    setSaving(true);
    setSaveErr("");

    const payload = {
      employee_id: payModalEmpId,
      month: periodKey,
      basic_salary: toNum(payForm.basic),
      hra: toNum(payForm.hra),
      conveyance_allowance: toNum(payForm.conveyance),
      medical_allowance: toNum(payForm.medicalAllowance),
      special_allowance: toNum(payForm.specialAllowance),
      allowances: modalAllowances,
      pf_employee: toNum(payForm.pfEmployee),
      pf_employer: toNum(payForm.pfEmployer),
      esi_employee: toNum(payForm.esiEmployee),
      esi_employer: toNum(payForm.esiEmployer),
      professional_tax: toNum(payForm.professionalTax),
      deductions: modalDeductions,
      net_salary: modalNet,
      ctc: modalCTC,
      // created_by: (optional) if you use supabase auth:
      // created_by: (await supabase.auth.getUser()).data?.user?.id || null,
    };

    const res = await supabase.from(PAYROLL_TABLE).upsert(payload, { onConflict: "employee_id,month" });

    if (res.error) {
      setSaveErr(res.error.message);
      setSaving(false);
      return;
    }

    try {
      await saveBatchStatus({
        month: periodKey,
        employee_id: payModalEmpId,
        published: true,
        note: "Auto-approved by HR",
      });
    } catch (err) {
      setSaveErr(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setPayModalOpen(false);
    fetchPayrollData();
  };

  const renderStatDetails = () => {
    if (!activeStat) return null;
    return (
      <div className="space-y-4">
        {activeStat === "employees" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold text-slate-500">Total Employees</p>
              <p className="mt-1 text-lg font-extrabold text-slate-900">{headerStats.totalEmployees}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-[10px] font-semibold text-emerald-700">Approved</p>
              <p className="mt-1 text-lg font-extrabold text-emerald-900">{headerBreakdown.processed}</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
              <p className="text-[10px] font-semibold text-amber-700">Pending</p>
              <p className="mt-1 text-lg font-extrabold text-amber-900">{headerBreakdown.pending}</p>
            </div>
          </div>
        ) : null}

        {activeStat === "gross" ? (
          <div className="space-y-3">
            {[
              ["Basic Total", headerBreakdown.totalBasic],
              ["HRA Total", headerBreakdown.totalHra],
              ["Allowances Total", headerBreakdown.totalAllowances],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                <p className="text-xs font-bold text-slate-900 tabular-nums">{inr(value)}</p>
              </div>
            ))}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Gross Salary</p>
              <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{inr(headerBreakdown.grossTotal)}</p>
            </div>
            <p className="text-[10px] text-slate-500">Gross = Basic + HRA + Allowances</p>
          </div>
        ) : null}

        {activeStat === "deductions" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Loan Deduction</p>
              <p className="text-xs font-bold text-rose-600 tabular-nums">{inr(headerBreakdown.deductionSplit.loan)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Salary Advance Deduction</p>
              <p className="text-xs font-bold text-rose-600 tabular-nums">{inr(headerBreakdown.deductionSplit.salaryAdvance)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Leave Deduction</p>
              <p className="text-xs font-bold text-rose-600 tabular-nums">{inr(headerBreakdown.deductionSplit.leave)}</p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Total Deductions</p>
              <p className="text-sm font-extrabold text-rose-600 tabular-nums">{inr(headerBreakdown.deductionsTotal)}</p>
            </div>
            <p className="text-[10px] text-slate-500">Total = Loan + Salary Advance + Leave</p>
          </div>
        ) : null}

        {activeStat === "net" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Gross Salary</p>
              <p className="text-xs font-bold text-slate-900 tabular-nums">{inr(headerBreakdown.grossTotal)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Total Deductions</p>
              <p className="text-xs font-bold text-rose-600 tabular-nums">{inr(headerBreakdown.deductionsTotal)}</p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500">Total Net Pay</p>
              <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{inr(headerBreakdown.netTotal)}</p>
            </div>
            <p className="text-[10px] text-slate-500">Net = Gross - Deductions</p>
          </div>
        ) : null}
      </div>
    );
  };

  const renderActionDetails = () => {
    if (!activeAction) return null;
    if (activeAction === "create") {
      return (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1">Select Employee</p>
            <select
              value={actionEmpId}
              onChange={(e) => setActionEmpId(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
            >
              <option value="" disabled>
                Select...
              </option>
              {rows.map((r) => (
                <option key={r.empId} value={r.empId}>
                  {r.empId} - {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldNum label="Basic Salary" value={actionForm.basic} onChange={(v) => setActionForm((p) => ({ ...p, basic: v }))} />
            <FieldNum label="HRA" value={actionForm.hra} onChange={(v) => setActionForm((p) => ({ ...p, hra: v }))} />
            <FieldNum
              label="Conveyance Allowance"
              value={actionForm.conveyance}
              onChange={(v) => setActionForm((p) => ({ ...p, conveyance: v }))}
            />
            <FieldNum
              label="Medical Allowance"
              value={actionForm.medicalAllowance}
              onChange={(v) => setActionForm((p) => ({ ...p, medicalAllowance: v }))}
            />
            <FieldNum
              label="Special Allowance"
              value={actionForm.specialAllowance}
              onChange={(v) => setActionForm((p) => ({ ...p, specialAllowance: v }))}
            />
          </div>

          <button type="button" className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-600">Gross Salary</p>
              <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{inr(actionGross)}</p>
            </div>
            <div className="mt-2 space-y-1 text-[10px] text-slate-500">
              <div className="flex items-center justify-between">
                <span>Basic Salary</span>
                <span className="font-semibold text-slate-700">{inr(actionForm.basic)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>HRA</span>
                <span className="font-semibold text-slate-700">{inr(actionForm.hra)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Conveyance Allowance</span>
                <span className="font-semibold text-slate-700">{inr(actionForm.conveyance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Medical Allowance</span>
                <span className="font-semibold text-slate-700">{inr(actionForm.medicalAllowance)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Special Allowance</span>
                <span className="font-semibold text-slate-700">{inr(actionForm.specialAllowance)}</span>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Gross = Basic + HRA + Conveyance + Medical + Special</p>
          </button>

          <button type="button" className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-600">Deductions</p>
              <p className="text-sm font-extrabold text-rose-600 tabular-nums">{inr(actionDeductionsTotal)}</p>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-[10px] text-slate-500 sm:grid-cols-2">
              <FieldNum
                label="PF Contribution (Employee)"
                value={actionForm.pfEmployee}
                onChange={(v) => setActionForm((p) => ({ ...p, pfEmployee: v }))}
              />
              <FieldNum
                label="PF Contribution (Employer)"
                value={actionForm.pfEmployer}
                onChange={(v) => setActionForm((p) => ({ ...p, pfEmployer: v }))}
              />
              <FieldNum
                label="ESI Contribution (Employee)"
                value={actionForm.esiEmployee}
                onChange={(v) => setActionForm((p) => ({ ...p, esiEmployee: v }))}
              />
              <FieldNum
                label="ESI Contribution (Employer)"
                value={actionForm.esiEmployer}
                onChange={(v) => setActionForm((p) => ({ ...p, esiEmployer: v }))}
              />
              <FieldNum
                label="Professional Tax"
                value={actionForm.professionalTax}
                onChange={(v) => setActionForm((p) => ({ ...p, professionalTax: v }))}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Total Deductions = PF (Employee) + ESI (Employee) + Professional Tax
            </p>
          </button>

          <button type="button" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-emerald-900">Net Salary</p>
              <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{inr(actionNet)}</p>
            </div>
            <p className="mt-1 text-[10px] text-emerald-700">Net Salary = Gross Salary - Total Deductions</p>
          </button>

          <button type="button" className="w-full rounded-xl border border-blue-200 bg-blue-50 p-4 text-left">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-blue-900">CTC Calculation</p>
              <p className="text-lg font-extrabold text-blue-700 tabular-nums">{inr(actionCTC)}</p>
            </div>
            <div className="mt-2 space-y-1 text-[10px] text-blue-700">
              <div className="flex items-center justify-between">
                <span>Gross Salary</span>
                <span className="font-semibold">{inr(actionGross)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Employer PF</span>
                <span className="font-semibold">{inr(actionForm.pfEmployer)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Employer ESI</span>
                <span className="font-semibold">{inr(actionForm.esiEmployer)}</span>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-blue-700 uppercase">CTC = Gross salary + (Employer PF + Employer ESI)</p>
          </button>

          {actionSaveErr ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-700">
              {actionSaveErr}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveAndApprovePayroll}
              disabled={actionSaving || !actionEmpId}
              className="h-9 rounded-lg border border-blue-600 bg-blue-600 px-4 text-[11px] font-extrabold text-white hover:opacity-95 disabled:opacity-60"
            >
              {actionSaving ? "Saving..." : "Save Payroll (Auto-Approve)"}
            </button>
          </div>
        </div>
      );
    }

    if (activeAction === "preview") {
      return (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">Preview shows the salary breakup and net pay for the selected employee.</p>
          <button
            type="button"
            onClick={() => {
              if (actionEmpId) setSelectedEmpId(actionEmpId);
              setTab("details");
              setActiveAction("");
            }}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Salary Details
          </button>
        </div>
      );
    }

    if (activeAction === "approve") {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-500">Batch Status</span>
            <span className="text-[11px] font-bold text-slate-900">{batchStatus}</span>
          </div>

          {batchStatus === "Approved" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              This payroll batch is already approved.
            </div>
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                Payroll entries are auto-approved once created. If any rows still show pending, finalize below to force-approve them.
              </p>
              {actionSaveErr && <p className="text-xs text-rose-600">{actionSaveErr}</p>}
              <button
                type="button"
                onClick={onSubmitForApproval}
                disabled={actionSaving}
                className="h-9 w-full rounded-lg border border-blue-600 bg-blue-600 px-3 text-[11px] font-extrabold text-white hover:opacity-95 disabled:opacity-60"
              >
                {actionSaving ? "Finalizing..." : "Mark All Approved"}
              </button>
            </>
          )}
        </div>
      );
    }

    if (activeAction === "payslip") {
      const psRow = rows.find((r) => r.empId === actionEmpId) || selectedRow || actionRow || rows[0] || null;
      if (!psRow) {
        return <p className="text-xs text-rose-600">No payroll data available to generate payslip.</p>;
      }

      const name = psRow.name || "-";
      const empId = psRow.empId || "-";
      const designation = psRow.role || "-";
      const department = psRow.department || "-";
      const joinDate = "-";
      const gross =
        toNum(payslipBreakup.basic) +
        toNum(payslipBreakup.hra) +
        toNum(payslipBreakup.conveyance) +
        toNum(payslipBreakup.medicalAllowance) +
        toNum(payslipBreakup.specialAllowance);
      const deductionsVal =
        toNum(payslipBreakup.pfEmployee) + toNum(payslipBreakup.esiEmployee) + toNum(payslipBreakup.professionalTax);
      const netVal = Math.max(gross - deductionsVal, 0);

      const bankName = bankInfo?.bank_name || "-";
      const accountNumber = bankInfo?.account_number || "-";

      return (
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold text-slate-600 mb-1">Select Employee</p>
            <select
              value={actionEmpId}
              onChange={(e) => {
                setActionEmpId(e.target.value);
                setSelectedEmpId(e.target.value);
                const nextRow = rows.find((r) => r.empId === e.target.value);
                if (nextRow) {
                  setPayslipAttendance({
                    workingDays: "",
                    presentDays: "",
                    paidLeave: "",
                    lopDays: "",
                  });
                  setPayslipBreakup({
                    basic: toNum(nextRow.basic),
                    hra: toNum(nextRow.hra),
                    conveyance: 0,
                    medicalAllowance: 0,
                    specialAllowance: toNum(nextRow.allowances),
                    pfEmployee: toNum(nextRow.deductions),
                    pfEmployer: 0,
                    esiEmployee: 0,
                    professionalTax: 0,
                  });
                }
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
            >
              {rows.map((r) => (
                <option key={r.empId} value={r.empId}>
                  {r.empId} - {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-extrabold text-slate-900">Company</p>
            <div className="flex items-center gap-3 mt-2">
              {COMPANY.logoUrl ? (
                <img
                  src={COMPANY.logoUrl}
                  alt={COMPANY.name}
                  className="h-10 w-10 rounded-md border border-slate-200 object-contain bg-white"
                />
              ) : null}
              <div>
                <p className="text-sm font-bold text-slate-900">{COMPANY.name}</p>
                <p className="text-[11px] text-slate-500">{COMPANY.addressLine1}</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Payslip generated by HRMS · Period: <span className="font-bold text-slate-900">{formatPeriodDisplay(periodKey)}</span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-xs font-extrabold text-slate-900 uppercase">Employee Details</p>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600">
              <Detail label="Employee Name" value={name} />
              <Detail label="Employee ID" value={empId} />
              <Detail label="Designation" value={designation} />
              <Detail label="Department" value={department} />
              <Detail label="Date of Joining" value={joinDate} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-xs font-extrabold text-slate-900 uppercase">Earnings</p>
            <Detail label="Basic Salary" value={inr(payslipBreakup.basic)} />
            <Detail label="House Rent Allowance (HRA)" value={inr(payslipBreakup.hra)} />
            <Detail label="Conveyance Allowance" value={inr(payslipBreakup.conveyance)} />
            <Detail label="Medical Allowance" value={inr(payslipBreakup.medicalAllowance)} />
            <Detail label="Special Allowance" value={inr(payslipBreakup.specialAllowance)} />
            <Detail label="Total Earnings (Gross)" value={inr(gross)} emphasize />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-xs font-extrabold text-slate-900 uppercase">Deductions</p>
            <Detail label="PF Contribution (Employee)" value={`-${inr(payslipBreakup.pfEmployee)}`} />
            <Detail label="PF Contribution (Employer)" value={`-${inr(payslipBreakup.pfEmployer)}`} />
            <Detail label="ESI Contribution (Employee)" value={`-${inr(payslipBreakup.esiEmployee)}`} />
            <Detail label="Professional Tax" value={`-${inr(payslipBreakup.professionalTax)}`} />
            <Detail label="Total Deductions" value={`-${inr(deductionsVal)}`} emphasize />
            <p className="text-[10px] text-slate-500">
              Total Deductions = PF (Employee) + ESI (Employee) + Professional Tax. Employer PF shown for reference.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-xs font-extrabold text-slate-900 uppercase">Attendance Summary</p>
            <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-600">
              <LabeledInput
                label="Total Working Days"
                placeholder="e.g., 22"
                value={payslipAttendance.workingDays}
                onChange={(v) => setPayslipAttendance((p) => ({ ...p, workingDays: v }))}
              />
              <LabeledInput
                label="Days Present"
                placeholder="e.g., 20"
                value={payslipAttendance.presentDays}
                onChange={(v) => setPayslipAttendance((p) => ({ ...p, presentDays: v }))}
              />
              <LabeledInput
                label="Paid Leave"
                placeholder="e.g., 1"
                value={payslipAttendance.paidLeave}
                onChange={(v) => setPayslipAttendance((p) => ({ ...p, paidLeave: v }))}
              />
              <LabeledInput
                label="Loss of Pay (LOP) Days"
                placeholder="e.g., 1"
                value={payslipAttendance.lopDays}
                onChange={(v) => setPayslipAttendance((p) => ({ ...p, lopDays: v }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-xs font-extrabold text-slate-900 uppercase">Net Pay Summary</p>
            <Detail label="Total Earnings" value={inr(gross)} />
            <Detail label="Total Deductions" value={`-${inr(deductionsVal)}`} />
            <Detail label="Net Pay (Take-Home)" value={inr(netVal)} emphasize />
            <p className="text-[11px] text-slate-500">
              Rupees {numberToWords(netVal)} Only
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-xs font-extrabold text-slate-900 uppercase">Payment Details</p>
            <Detail label="Bank Name" value={bankName} />
            <Detail label="Account Number" value={maskAccount(accountNumber)} />
            <Detail label="Payment Mode" value="Bank Transfer" />
            <Detail label="Paid On" value={formatPeriodDisplay(periodKey)} />
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] text-emerald-800">
            This is a system-generated payslip and does not require a signature.
          </div>

          <button
            type="button"
            onClick={async () => {
              setActionSaving(true);
              setActionSaveErr("");
              try {
                await savePayslipRecord({
                  month: periodKey,
                  employee_id: empId,
                  published: true,
                  note: JSON.stringify({
                    earnings: {
                      basic: payslipBreakup.basic,
                      hra: payslipBreakup.hra,
                      conveyance: payslipBreakup.conveyance,
                      medicalAllowance: payslipBreakup.medicalAllowance,
                      specialAllowance: payslipBreakup.specialAllowance,
                    },
                    deductions: {
                      pfEmployee: payslipBreakup.pfEmployee,
                      pfEmployer: payslipBreakup.pfEmployer,
                      esiEmployee: payslipBreakup.esiEmployee,
                      professionalTax: payslipBreakup.professionalTax,
                    },
                    attendance: payslipAttendance,
                    net: netVal,
                    gross,
                    totalDeductions: deductionsVal,
                  }),
                });
                setActionSaving(false);
                setActiveAction("");
                fetchPayrollData();
              } catch (err) {
                setActionSaveErr(err.message);
                setActionSaving(false);
              }
            }}
            disabled={actionSaving}
            className="h-10 w-full rounded-xl border border-emerald-600 bg-emerald-600 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-60"
          >
            {actionSaving ? "Saving..." : "Save / Create Payslip"}
          </button>
          {actionSaveErr ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-[11px] font-semibold text-rose-700">
              {actionSaveErr}
            </div>
          ) : null}
        </div>
      );
    }

    if (activeAction === "download") {
      return (
        <div className="space-y-3">
          <p className="text-[11px] text-slate-500">Download the payroll report for the current month.</p>
          <button
            type="button"
            onClick={downloadCSV}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Download Reports
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="p-6 overflow-x-hidden">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Header */}
        <div className="rounded-xl bg-gradient-to-r from-[#1F2A4D] to-[#2E3A66] text-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg border border-white/10 bg-white/10 grid place-items-center">
                <FileText size={18} className="text-white" />
              </div>

              <div className="min-w-0">
                <p className="text-base font-bold leading-tight">Payroll Dashboard</p>
                <p className="mt-1 text-[11px] text-white/70">Manage employee salaries and payments</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
            <div className="inline-flex items-center gap-2">
              <CalendarDays size={14} className="text-white/70" />
              <span className="font-semibold">Payroll Period:</span>
            </div>

            <div className="inline-flex items-center gap-2">
              <div className="relative">
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-8 appearance-none rounded-md border border-white/10 bg-white/10 pl-3 pr-8 text-[11px] font-semibold text-white outline-none"
                >
                  {Object.keys(monthMap).map((m) => (
                    <option key={m} value={m} className="text-slate-900">
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/70"
                />
              </div>

              <div className="relative">
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="h-8 appearance-none rounded-md border border-white/10 bg-white/10 pl-3 pr-8 text-[11px] font-semibold text-white outline-none"
                >
                  {["2023", "2024", "2025", "2026"].map((y) => (
                    <option key={y} value={y} className="text-slate-900">
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/70"
                />
              </div>
            </div>

            <div className="ml-auto text-[11px] text-white/70">
              Month Key: <span className="font-semibold text-white">{periodKey}</span>
            </div>
          </div>
        </div>

        {/* error / loading */}
        {errorMsg ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{errorMsg}</div>
        ) : null}

        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            variant="white"
            title="Total Employees"
            value={loading ? "..." : headerStats.totalEmployees}
            sub="Active this month"
            icon={UserRound}
            active={activeStat === "employees"}
            onClick={() => setActiveStat("employees")}
          />
          <StatCard
            variant="navy"
            title="Total Gross Salary"
            value={loading ? "..." : inr(headerStats.grossTotal)}
            sub="Before deductions"
            icon={ReceiptIndianRupee}
            active={activeStat === "gross"}
            onClick={() => setActiveStat("gross")}
          />
          <StatCard
            variant="yellow"
            title="Total Deductions"
            value={loading ? "..." : inr(headerStats.deductionsTotal)}
            sub="PF, ESI, Tax & more"
            icon={Percent}
            active={activeStat === "deductions"}
            onClick={() => setActiveStat("deductions")}
          />
          <StatCard
            variant="green"
            title="Total Net Pay"
            value={loading ? "..." : inr(headerStats.netTotal)}
            sub="Take-home salary"
            icon={Wallet}
            active={activeStat === "net"}
            onClick={() => setActiveStat("net")}
          />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "all"} icon={LayoutGrid} onClick={() => { setTab("all"); setStatusFilter("All"); }}>
            All
          </TabButton>
          <TabButton active={tab === "approved"} icon={ListChecks} onClick={() => { setTab("approved"); setStatusFilter("Approved"); }}>
            Approved
          </TabButton>
          <TabButton active={tab === "pending"} icon={BadgeIndianRupee} onClick={() => { setTab("pending"); setStatusFilter("Pending"); }}>
            Pending
          </TabButton>
        </div>

        {/* Employee Salary List */}
        {(tab === "all" || tab === "approved" || tab === "pending") && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Employee Salary List</p>
                  <p className="text-[11px] text-slate-500 mt-1">{loading ? "Loading..." : `${filteredRows.length} employee(s)`}</p>
                </div>

                <div className="flex items-center gap-2">

                  <div className="relative">
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search employees..."
                      className="h-9 w-64 max-w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <Eye size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>

                  <button
                    type="button"
                    onClick={downloadCSV}
                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white grid place-items-center hover:bg-slate-50"
                    title="Download CSV"
                  >
                    <Download size={16} className="text-slate-700" />
                  </button>
                </div>
              </div>

              {deleteErr ? (
                <div className="mx-4 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
                  {deleteErr}
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 text-left">Emp ID</th>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Department</th>
                      <th className="px-4 py-3 text-left">Basic</th>
                      <th className="px-4 py-3 text-left">HRA</th>
                      <th className="px-4 py-3 text-left">Allowances</th>
                      <th className="px-4 py-3 text-left">Gross Salary</th>
                      <th className="px-4 py-3 text-left">Deductions</th>
                      <th className="px-4 py-3 text-left">Net Pay</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr className="border-t border-slate-100">
                        <td className="px-4 py-6 text-slate-500" colSpan={11}>
                          Loading payroll...
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr className="border-t border-slate-100">
                        <td className="px-4 py-6 text-slate-500" colSpan={11}>
                          No employees found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r) => (
                        <tr key={r.empId} className="border-t border-slate-100">
                          <td className="px-4 py-4 font-semibold text-slate-500">{r.empId}</td>

                          <td className="px-4 py-4">
                            <button type="button" onClick={() => openEmployeeDetails(r.empId)} className="text-left w-full" title="Open Salary Details">
                              <div className="font-bold text-slate-900">{r.name || "-"}</div>
                              <div className="text-[10px] font-semibold text-slate-400">{r.role || "-"}</div>
                            </button>
                          </td>

                          <td className="px-4 py-4 font-semibold text-slate-600">{r.department || "-"}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900 tabular-nums">{inr(r.basic)}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900 tabular-nums">{inr(r.hra)}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900 tabular-nums">{inr(r.allowances)}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900 tabular-nums">{inr(r.gross)}</td>
                          <td className="px-4 py-4 font-semibold text-rose-500 tabular-nums">{inr(r.deductions)}</td>
                          <td className="px-4 py-4 font-semibold text-slate-900 tabular-nums">{inr(r.net)}</td>

                          <td className="px-4 py-4">
                            <StatusPill status={r.status} />
                          </td>

                          {/* actions: edit/delete payroll */}
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmpId(r.empId);
                                setActionEmpId(r.empId);
                                setActiveAction("create");
                                fillActionFormFromRow(r.empId);
                              }}
                              className="h-8 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 mr-2"
                              title="Edit Payroll"
                            >
                              <MoreHorizontal size={16} className="text-slate-500" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => deletePayroll(r.empId)}
                              className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 inline-flex items-center gap-2 text-[11px] font-bold text-rose-700"
                              title="Delete Payroll"
                            >
                              <Trash2 size={16} className="text-rose-500" />
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-4" />
            </div>

            {/* Payroll Actions ONLY in All tab */}
            {tab === "all" && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-slate-600" />
                  <p className="text-sm font-bold text-slate-900">Payroll Actions</p>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ActionTile
                    tone="navy"
                    icon={BadgeIndianRupee}
                    title="Create / Edit Payroll"
                    onClick={() => openActionDetails("create")}
                  />
                  <ActionTile
                    tone="white"
                    icon={FileText}
                    title="Generate Payslip"
                    onClick={() => openActionDetails("payslip")}
                  />
                </div>

              </div>
            )}
          </>
        )}

        {/* Salary Details */}
        {tab === "details" && (
          <div className="space-y-4">
            {!selectedRow ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                Select an employee to view salary details.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedRow.name || "-"}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {selectedRow.empId} | {selectedRow.role || "-"} | {selectedRow.department || "-"}
                    </p>
                  </div>
                  <StatusPill status={selectedRow.status} />
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Salary Structure */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-900">Salary Structure</p>
                      <button
                        type="button"
                        onClick={() => openPayrollModal(selectedRow.empId, true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <FileText size={14} />
                        {selectedRow.status === "Processed" ? "Edit" : "Create"}
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {[
                        ["Basic Salary", selectedRow.basic],
                        ["HRA", selectedRow.hra],
                        ["Allowances", selectedRow.allowances],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-slate-500">{k}</p>
                          <p className="text-xs font-bold text-slate-900 tabular-nums">{inr(v)}</p>
                        </div>
                      ))}

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500">Gross Salary</p>
                        <p className="text-sm font-extrabold text-emerald-600 tabular-nums">{inr(selectedRow.gross)}</p>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-blue-700">
                        <p className="text-[11px] font-bold">CTC Calculation</p>
                        <p className="text-sm font-black tabular-nums">{inr(selectedRow.ctc)}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 -mt-2">CTC = Gross + Employer PF & ESI</p>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full border-2 border-rose-500" />
                      <p className="text-sm font-bold text-slate-900">Deductions</p>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500">Total Deductions</p>
                        <p className="text-sm font-extrabold text-rose-500 tabular-nums">-{inr(selectedRow.deductions)}</p>
                      </div>

                      <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-3">
                        Note: This screen shows the stored payroll row for <b>{periodKey}</b>.
                        <br />
                        If you want PF/ESI/Tax breakdown, add extra columns or a payroll_items table.
                      </div>
                    </div>
                  </div>

                  {/* Net Salary Calculation */}
                  <div className="rounded-xl border border-slate-200 bg-[#F5FAFA] p-4">
                    <div className="flex items-center gap-2">
                      <Banknote size={16} className="text-slate-700" />
                      <p className="text-sm font-bold text-slate-900">Net Salary Calculation</p>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500">Gross Salary</p>
                        <p className="text-xs font-bold text-slate-900 tabular-nums">{inr(selectedRow.gross)}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500">Total Deductions</p>
                        <p className="text-xs font-bold text-rose-500 tabular-nums">-{inr(selectedRow.deductions)}</p>
                      </div>

                      <div className="py-4 border-y border-slate-200 flex items-center justify-center">
                        <span className="text-slate-500 text-sm">=</span>
                      </div>

                      <div className="rounded-xl bg-[#EAF1F1] p-4">
                        <p className="text-[11px] font-semibold text-slate-500">
                          Take-home Salary <span className="text-slate-400">(Net Pay)</span>
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{inr(selectedRow.net)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Attendance & Leave */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-emerald-600" />
                      <p className="text-sm font-bold text-slate-900">Attendance & Leave</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-500">Attendance Rate</p>
                      <p className="text-[11px] font-bold text-slate-900">{attSummary ? `${attSummary.rate}%` : "-"}</p>
                    </div>

                    <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full" style={{ width: `${attSummary?.rate || 0}%` }} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold text-slate-500">Working Days</p>
                        <p className="mt-1 text-sm font-extrabold text-slate-900">{attSummary ? attSummary.workingDays : "-"}</p>
                      </div>

                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-[10px] font-semibold text-emerald-700">Days Present</p>
                        <p className="mt-1 text-sm font-extrabold text-emerald-900">{attSummary ? attSummary.presentDays : "-"}</p>
                      </div>

                      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                        <p className="text-[10px] font-semibold text-indigo-700">Paid Leave</p>
                        <p className="mt-1 text-sm font-extrabold text-indigo-900">{leaveSummary ? leaveSummary.paidLeave : "-"}</p>
                      </div>

                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                        <p className="text-[10px] font-semibold text-amber-700">LOP Days</p>
                        <p className="mt-1 text-sm font-extrabold text-amber-900">{leaveSummary ? leaveSummary.lopDays : "-"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-slate-500">Overtime Hours</p>
                      <p className="text-xs font-bold text-emerald-700">-</p>
                    </div>
                  </div>

                  {/* Bonus & Incentives */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-emerald-600" />
                      <p className="text-sm font-bold text-slate-900">Bonus & Incentives</p>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500">Performance Bonus</p>
                        <p className="text-xs font-bold text-emerald-600 tabular-nums">+{inr(0)}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-500">Incentives</p>
                        <p className="text-xs font-bold text-emerald-600 tabular-nums">+{inr(0)}</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-600">Total Additions</p>
                        <p className="text-sm font-extrabold text-emerald-600 tabular-nums">+{inr(0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Bank & Payment Details */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CreditIcon />
                        <p className="text-sm font-bold text-slate-900">Bank & Payment Details</p>
                      </div>

                      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">
                        {selectedRow.status === "Processed" ? "Ready" : "Pending"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center">
                          <Building2 size={16} className="text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-slate-500">Bank Name</p>
                          <p className="text-xs font-bold text-slate-900">{bankInfo?.bank_name || "-"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center">
                          <Wallet size={16} className="text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-slate-500">Account Number</p>
                          <p className="text-xs font-bold text-slate-900">{maskAccount(bankInfo?.account_number)}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center">
                          <ShieldCheck size={16} className="text-slate-700" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold text-slate-500">IFSC Code</p>
                          <p className="text-xs font-bold text-slate-900">{bankInfo?.ifsc_code || "-"}</p>
                          {bankInfo?.branch ? <p className="text-[10px] text-slate-500 mt-1">Branch: {bankInfo.branch}</p> : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-semibold text-slate-500">Payment Mode</p>
                        <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold text-slate-700 border border-slate-200">
                          Bank Transfer
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <input type="hidden" value={selectedEmpId} readOnly />
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">Create / Edit Payroll</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Month: <b>{periodKey}</b>
                  {modalRow ? (
                    <>
                      {" "} | Employee: <b>{modalRow.name || "-"}</b> ({modalRow.empId})
                    </>
                  ) : null}
                </p>
              </div>

              <button
                type="button"
                onClick={closePayrollModal}
                className="h-9 w-9 rounded-xl border border-slate-200 grid place-items-center hover:bg-slate-50"
                title="Close"
              >
                <X size={16} className="text-slate-700" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!payFixedEmp && (
                <div>
                  <p className="text-[11px] font-bold text-slate-600 mb-1">Select Employee</p>
                  <select
                    value={payModalEmpId}
                    onChange={(e) => setPayModalEmpId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
                  >
                    <option value="" disabled>
                      Select...
                    </option>
                    {rows.map((r) => (
                      <option key={r.empId} value={r.empId}>
                        {r.empId} - {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldNum
                  label="Basic Salary"
                  value={payForm.basic}
                  onChange={(v) => setPayForm((p) => ({ ...p, basic: v }))}
                />
                <FieldNum label="HRA" value={payForm.hra} onChange={(v) => setPayForm((p) => ({ ...p, hra: v }))} />
                <FieldNum
                  label="Conveyance Allowance"
                  value={payForm.conveyance}
                  onChange={(v) => setPayForm((p) => ({ ...p, conveyance: v }))}
                />
                <FieldNum
                  label="Medical Allowance"
                  value={payForm.medicalAllowance}
                  onChange={(v) => setPayForm((p) => ({ ...p, medicalAllowance: v }))}
                />
                <FieldNum
                  label="Special Allowance"
                  value={payForm.specialAllowance}
                  onChange={(v) => setPayForm((p) => ({ ...p, specialAllowance: v }))}
                />
                <FieldNum
                  label="PF Contribution (Employee)"
                  value={payForm.pfEmployee}
                  onChange={(v) => setPayForm((p) => ({ ...p, pfEmployee: v }))}
                />
                <FieldNum
                  label="PF Contribution (Employer)"
                  value={payForm.pfEmployer}
                  onChange={(v) => setPayForm((p) => ({ ...p, pfEmployer: v }))}
                />
                <FieldNum
                  label="ESI Contribution (Employee)"
                  value={payForm.esiEmployee}
                  onChange={(v) => setPayForm((p) => ({ ...p, esiEmployee: v }))}
                />
                <FieldNum
                  label="ESI Contribution (Employer)"
                  value={payForm.esiEmployer}
                  onChange={(v) => setPayForm((p) => ({ ...p, esiEmployer: v }))}
                />
                <FieldNum
                  label="Professional Tax"
                  value={payForm.professionalTax}
                  onChange={(v) => setPayForm((p) => ({ ...p, professionalTax: v }))}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600">Gross</p>
                  <p className="text-sm font-extrabold text-slate-900 tabular-nums">{inr(modalGross)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-600">Net Pay</p>
                  <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{inr(modalNet)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-blue-700">
                  <p className="text-[11px] font-bold">CTC (Cost to Company)</p>
                  <p className="text-lg font-extrabold tabular-nums">{inr(modalCTC)}</p>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 uppercase">
                  Gross = Earnings | Net = Gross - (PF Emp + ESI Emp + PT) | CTC = Gross + (PF Er + ESI Er)
                </p>
              </div>

              {saveErr ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-semibold text-rose-700">
                  {saveErr}
                </div>
              ) : null}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closePayrollModal}
                disabled={saving}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={savePayroll}
                disabled={saving || !payModalEmpId}
                className="h-10 rounded-xl border border-emerald-600 bg-emerald-600 px-4 text-xs font-extrabold text-white hover:opacity-95 disabled:opacity-60 inline-flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? "Saving..." : "Save Payroll"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeStat ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">
                  {activeStat === "employees"
                    ? "Employee Count Details"
                    : activeStat === "gross"
                      ? "Gross Salary Details"
                      : activeStat === "deductions"
                        ? "Deductions Details"
                        : "Net Pay Details"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Click close to return to the dashboard.</p>
              </div>

              <button
                type="button"
                onClick={() => setActiveStat("")}
                className="h-9 w-9 rounded-xl border border-slate-200 grid place-items-center hover:bg-slate-50"
                title="Close"
              >
                <X size={16} className="text-slate-700" />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">{renderStatDetails()}</div>
          </div>
        </div>
      ) : null}

      {activeAction ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">
                  {activeAction === "create"
                    ? "Create Payroll"
                    : activeAction === "preview"
                      ? "Preview Salary"
                      : activeAction === "approve"
                        ? "Approve Payroll"
                        : activeAction === "payslip"
                          ? "Generate Payslip"
                          : "Download Reports"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">Use this panel to complete the action.</p>
              </div>

              <button
                type="button"
                onClick={() => setActiveAction("")}
                className="h-9 w-9 rounded-xl border border-slate-200 grid place-items-center hover:bg-slate-50"
                title="Close"
              >
                <X size={16} className="text-slate-700" />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">{renderActionDetails()}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* small icon component */
function CreditIcon() {
  return (
    <span className="h-5 w-5 inline-flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M4 7.5C4 6.12 5.12 5 6.5 5h11C18.88 5 20 6.12 20 7.5v9c0 1.38-1.12 2.5-2.5 2.5h-11C5.12 19 4 17.88 4 16.5v-9Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M4 9h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Detail({ label, value, emphasize = false }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-[10px] font-semibold text-slate-500">{label}</span>
      <span className={`text-[11px] font-bold ${emphasize ? "text-emerald-700" : "text-slate-900"}`}>{value}</span>
    </div>
  );
}

function LabeledInput({ label, placeholder = "", value = "", onChange = () => { } }) {
  return (
    <label className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-slate-500">{label}</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function FieldNum({ label, value, onChange = () => { }, readOnly = false, disabled = false }) {
  const handleChange =
    readOnly || disabled
      ? undefined
      : (e) => {
        const parsed = Number(e.target.value);
        onChange(Number.isFinite(parsed) ? parsed : 0);
      };

  return (
    <label className="block">
      <span className="text-[11px] font-bold text-slate-600">{label}</span>
      <input
        type="number"
        min="0"
        value={Number(value || 0)}
        onChange={handleChange}
        readOnly={readOnly}
        disabled={disabled}
        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"
      />
    </label>
  );
}
