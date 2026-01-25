// src/pages/employee/EmployeeMenuPages.jsx
import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  Wallet,
  TrendingUp,
  CalendarClock,
  FileText,
  ChevronDown,
  Percent,
  HelpCircle,
  MessageSquarePlus,
} from "lucide-react";

import {
  Badge,
  IconButton,
  PrimaryButton,
  SectionCard,
  ProgressBar,
  cn,
} from "./shared/ui.jsx";

/* ---------------- utils ---------------- */
const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const months = ["September 2023", "October 2023", "November 2023"];

const demo = {
  bankMasked: "•••• 4589",
  byMonth: {
    "September 2023": {
      paidOn: "Sep 30",
      gross: 5200,
      net: 4020,
      ytd: 46500,
      nextPay: "Oct 31, 2023",
      nextIn: "In 31 days",
      earnings: [
        { label: "Basic Salary", value: 2400 },
        { label: "House Rent Allowance", value: 1100 },
        { label: "Special Allowance", value: 700 },
        { label: "Bonus", value: 1000 },
      ],
      deductions: [
        { label: "Provident Fund", value: 280 },
        { label: "Income Tax (TDS)", value: 750 },
        { label: "Professional Tax", value: 150 },
      ],
      tax: { regime: "New Regime", paid: 2100, projected: 7200 },
    },
    "October 2023": {
      paidOn: "Oct 31",
      gross: 5400,
      net: 4160,
      ytd: 49200,
      nextPay: "Nov 30, 2023",
      nextIn: "In 30 days",
      earnings: [
        { label: "Basic Salary", value: 2500 },
        { label: "House Rent Allowance", value: 1150 },
        { label: "Special Allowance", value: 750 },
        { label: "Bonus", value: 1000 },
      ],
      deductions: [
        { label: "Provident Fund", value: 290 },
        { label: "Income Tax (TDS)", value: 780 },
        { label: "Professional Tax", value: 170 },
      ],
      tax: { regime: "New Regime", paid: 2250, projected: 7200 },
    },
    "November 2023": {
      paidOn: "Nov 30",
      gross: 5500,
      net: 4250,
      ytd: 51000,
      nextPay: "Dec 31, 2023",
      nextIn: "In 30 days",
      earnings: [
        { label: "Basic Salary", value: 2500 },
        { label: "House Rent Allowance", value: 1200 },
        { label: "Special Allowance", value: 800 },
        { label: "Bonus", value: 1000 },
      ],
      deductions: [
        { label: "Provident Fund", value: 300 },
        { label: "Income Tax (TDS)", value: 800 },
        { label: "Professional Tax", value: 150 },
      ],
      tax: { regime: "New Regime", paid: 2400, projected: 7200 },
    },
  },
};

function KpiCard({ icon: Icon, title, value, badge }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Icon size={16} className="text-slate-500" />
            {title}
          </div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {value}
          </div>
          <div className="mt-2">{badge}</div>
        </div>
        <div className="h-12 w-12 rounded-2xl bg-slate-50" />
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-50" />
    </div>
  );
}

function LineRow({ label, value, tone = "earn" }) {
  const color =
    tone === "earn" ? "text-blue-700" : tone === "ded" ? "text-rose-700" : "text-slate-900";
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={cn("text-sm font-bold", color)}>{money(value)}</span>
    </div>
  );
}

/* ========================= PAYROLL PAGE (LIKE IMAGE) ========================= */
export function PayrollPage() {
  const [month, setMonth] = useState("November 2023");
  const data = demo.byMonth[month];

  const totals = useMemo(() => {
    const earn = data.earnings.reduce((a, b) => a + b.value, 0);
    const ded = data.deductions.reduce((a, b) => a + b.value, 0);
    return { earn, ded };
  }, [data]);

  const barPct = useMemo(() => {
    const total = totals.earn + totals.ded || 1;
    return {
      earn: Math.round((totals.earn / total) * 100),
      ded: Math.round((totals.ded / total) * 100),
    };
  }, [totals]);

  const taxPct = useMemo(() => {
    const p = (data.tax.paid / (data.tax.projected || 1)) * 100;
    return Math.max(0, Math.min(100, p));
  }, [data]);

  const recentPayslips = ["November 2023", "October 2023", "September 2023"].map((m) => ({
    month: m,
    paidOn: demo.byMonth[m].paidOn,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Payroll
            </h1>
            <IconButton title="Visibility">
              <Eye size={18} />
            </IconButton>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage your salary details, payslips, and tax information.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Month Select */}
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border bg-white px-4 pr-10 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-purple-200 sm:w-[180px]"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>

          <PrimaryButton onClick={() => alert("Annual Statement download (demo)")}>
            <Download size={16} />
            Annual Statement
          </PrimaryButton>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiCard
          icon={Wallet}
          title="Latest Net Pay"
          value={money(data.net)}
          badge={<Badge tone="success">Paid on {data.paidOn}</Badge>}
        />
        <KpiCard
          icon={TrendingUp}
          title="YTD Earnings"
          value={money(data.ytd)}
          badge={<Badge tone="info">Fiscal Year 2023-2024</Badge>}
        />
        <KpiCard
          icon={CalendarClock}
          title="Next Pay Date"
          value={data.nextPay}
          badge={<Badge tone="warning">{data.nextIn}</Badge>}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Salary Breakdown */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Salary Breakdown"
            action={
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Earnings
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Deductions
                </div>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-bold text-slate-900">
                  {money(data.gross)}{" "}
                  <span className="font-medium text-slate-500">Gross</span>
                </div>
                <div className="text-sm font-semibold text-slate-500">{month}</div>
              </div>

              {/* bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full w-full">
                  <div className="h-full bg-blue-600" style={{ width: `${barPct.earn}%` }} />
                  <div className="h-full bg-rose-500" style={{ width: `${barPct.ded}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Earnings */}
                <div>
                  <div className="text-xs font-bold tracking-wider text-slate-400">
                    EARNINGS
                  </div>
                  <div className="mt-3 divide-y">
                    {data.earnings.map((e) => (
                      <LineRow key={e.label} label={e.label} value={e.value} tone="earn" />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <span className="text-sm font-semibold text-slate-900">Total Earnings</span>
                    <span className="text-sm font-extrabold text-blue-700">
                      {money(totals.earn)}
                    </span>
                  </div>
                </div>

                {/* Deductions */}
                <div>
                  <div className="text-xs font-bold tracking-wider text-slate-400">
                    DEDUCTIONS
                  </div>
                  <div className="mt-3 divide-y">
                    {data.deductions.map((d) => (
                      <LineRow key={d.label} label={d.label} value={d.value} tone="ded" />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <span className="text-sm font-semibold text-slate-900">Total Deductions</span>
                    <span className="text-sm font-extrabold text-rose-700">
                      {money(totals.ded)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Recent Payslips */}
          <SectionCard
            title="Recent Payslips"
            action={
              <button className="text-sm font-semibold text-purple-700 hover:text-purple-800">
                View All
              </button>
            }
          >
            <div className="space-y-3">
              {recentPayslips.map((p) => (
                <div
                  key={p.month}
                  className="flex items-center justify-between gap-4 rounded-2xl border bg-slate-50 px-4 py-3 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white border">
                      <FileText size={18} className="text-slate-600" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{p.month}</div>
                      <div className="text-xs text-slate-500">Paid {p.paidOn}</div>
                    </div>
                  </div>

                  <IconButton title="Download payslip">
                    <Download size={18} />
                  </IconButton>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Tax Summary */}
          <SectionCard
            title="Tax Summary"
            subtitle="Regime"
            action={<Badge tone="neutral">{data.tax.regime}</Badge>}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Percent size={16} className="text-slate-500" />
                  Tax Paid
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {money(data.tax.paid)} <span className="text-slate-400">/</span>{" "}
                  {money(data.tax.projected)}
                </div>
              </div>

              <ProgressBar value={taxPct} />

              <div className="text-center text-xs text-slate-500">
                {Math.round(taxPct)}% of projected annual tax
              </div>

              <button className="w-full rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-50">
                Manage Tax Declarations
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Take Home Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-blue-600 p-6 text-white shadow-sm">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-white/10" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-white/80">Take Home Amount</div>
            <div className="mt-1 text-4xl font-extrabold tracking-tight">
              {money(data.net)}
            </div>
            <div className="mt-2 text-sm text-white/80">
              Credited to Account ending in {demo.bankMasked}
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white/95 active:scale-[0.99]">
            <Eye size={16} />
            View Pay Slip
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================= SUPPORT PAGE ========================= */
export function SupportPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-purple-50 p-3">
            <HelpCircle className="text-purple-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Help & Support</h1>
            <p className="text-sm text-slate-500 mt-1">
              Browse FAQs or raise a ticket to get help from HR.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Quick Help"
          subtitle="Common support options"
          action={
            <PrimaryButton onClick={() => alert("Create ticket (demo)")}>
              <MessageSquarePlus size={16} />
              Raise a Ticket
            </PrimaryButton>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border bg-slate-50 p-4">• Salary / payslip issue</div>
            <div className="rounded-xl border bg-slate-50 p-4">• Leave & attendance correction</div>
            <div className="rounded-xl border bg-slate-50 p-4">• Document upload support</div>
          </div>
        </SectionCard>

        <SectionCard title="HR Contact" subtitle="Reach HR directly">
          <div className="space-y-2 text-sm text-slate-700">
            <div className="rounded-xl border bg-slate-50 p-4">
              Email: <span className="font-semibold">hr@company.com</span>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              Phone: <span className="font-semibold">+94 77 123 4567</span>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              Working Hours: <span className="font-semibold">9:00 AM - 6:00 PM</span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
