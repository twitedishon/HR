import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  CalendarDays,
  Wallet,
  TrendingUp,
  CalendarClock,
  FileText,
  Percent,
  ChevronDown,
} from "lucide-react";

import {
  Badge,
  IconButton,
  PrimaryButton,
  ProgressBar,
  SectionCard,
} from "./shared/ui.jsx";

const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ✅ UI-ல காட்டும்போது மட்டும் 2023 → 2025
const fixYear = (s) => String(s ?? "").replace(/2023/g, "2025");

const demo = {
  employee: { bankMasked: "•••• 4589" },
  byMonth: {
    // ⚠️ If your real data still has 2023 keys, keep them.
    // UI display will still show 2025 via fixYear().
    "February 2025": {
      paidOn: "Feb 28, 2025",
      gross: 1200,
      net: 980,
      ytd: 1960,
      nextPay: "Mar 31, 2025",
      nextIn: "In 30 days",
      earnings: [
        { label: "Basic Salary", value: 1000 },
        { label: "Allowance", value: 200 },
      ],
      deductions: [
        { label: "Tax", value: 150 },
        { label: "PF", value: 70 },
      ],
      tax: { paid: 300, projected: 1200, regime: "New Regime" },
    },

    "March 2025": {
      paidOn: "Mar 31, 2025",
      gross: 1400,
      net: 1120,
      ytd: 3080,
      nextPay: "Apr 30, 2025",
      nextIn: "In 30 days",
      earnings: [
        { label: "Basic Salary", value: 1200 },
        { label: "Allowance", value: 200 },
      ],
      deductions: [
        { label: "Tax", value: 200 },
        { label: "PF", value: 80 },
      ],
      tax: { paid: 500, projected: 1200, regime: "New Regime" },
    },
  },
};

function StatCard({ icon: Icon, title, value, sub, badge }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Icon size={16} className="text-slate-500" />
            <span>{title}</span>
          </div>

          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            {value}
          </div>

          <div className="mt-2 flex items-center gap-2">
            {badge}
            {sub ? <span className="text-xs text-slate-500">{sub}</span> : null}
          </div>
        </div>

        <div className="h-12 w-12 rounded-2xl bg-slate-50" />
      </div>

      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-50" />
    </div>
  );
}

function Row({ label, value, tone = "neutral" }) {
  const color =
    tone === "earn"
      ? "text-blue-700"
      : tone === "deduct"
      ? "text-rose-700"
      : "text-slate-900";

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{money(value)}</span>
    </div>
  );
}

export default function PayrollPage() {
  // ✅ months list always matches data keys
  const months = useMemo(() => Object.keys(demo.byMonth), []);
  const [month, setMonth] = useState(months[months.length - 1] || "March 2025");

  const data = demo.byMonth[month] || demo.byMonth[months[0]];

  const totals = useMemo(() => {
    const earn = (data?.earnings || []).reduce((a, b) => a + (b.value || 0), 0);
    const ded = (data?.deductions || []).reduce((a, b) => a + (b.value || 0), 0);
    return { earn, ded };
  }, [data]);

  const bar = useMemo(() => {
    const total = totals.earn + totals.ded || 1;
    return {
      earnPct: Math.round((totals.earn / total) * 100),
      dedPct: Math.round((totals.ded / total) * 100),
    };
  }, [totals]);

  const taxPct = useMemo(() => {
    const paid = data?.tax?.paid || 0;
    const projected = data?.tax?.projected || 1;
    const p = (paid / projected) * 100;
    return Math.min(100, Math.max(0, p));
  }, [data]);

  const recentPayslips = useMemo(
    () =>
      months
        .slice()
        .reverse()
        .slice(0, 2)
        .map((m) => ({
          month: m,
          paidOn: demo.byMonth[m]?.paidOn,
        })),
    [months]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              My Payroll
            </h1>
            <IconButton title="View">
              <Eye size={18} />
            </IconButton>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            View salary, payslips, and tax details.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border bg-white px-4 pr-10 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-purple-200 sm:w-[180px]"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {fixYear(m)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>

          <PrimaryButton onClick={() => alert("Annual Statement (demo)")}>
            <Download size={16} />
            Annual Statement
          </PrimaryButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          icon={Wallet}
          title="Latest Net Pay"
          value={money(data?.net || 0)}
          badge={<Badge tone="success">Paid on {fixYear(data?.paidOn)}</Badge>}
        />
        <StatCard
          icon={TrendingUp}
          title="YTD Earnings"
          value={money(data?.ytd || 0)}
          sub="This year"
          badge={<Badge tone="info">YTD</Badge>}
        />
        <StatCard
          icon={CalendarClock}
          title="Next Pay Date"
          value={fixYear(data?.nextPay)}
          badge={<Badge tone="warning">{fixYear(data?.nextIn)}</Badge>}
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  {money(data?.gross || 0)}{" "}
                  <span className="font-medium text-slate-500">Gross</span>
                </div>
                <div className="text-sm font-semibold text-slate-500">{fixYear(month)}</div>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full w-full">
                  <div className="h-full bg-blue-600" style={{ width: `${bar.earnPct}%` }} />
                  <div className="h-full bg-rose-500" style={{ width: `${bar.dedPct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <div className="text-xs font-bold tracking-wider text-slate-400">EARNINGS</div>
                  <div className="mt-3 divide-y">
                    {(data?.earnings || []).map((e) => (
                      <Row key={e.label} label={e.label} value={e.value} tone="earn" />
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <span className="text-sm font-semibold text-slate-900">Total Earnings</span>
                    <span className="text-sm font-extrabold text-blue-700">
                      {money(totals.earn)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold tracking-wider text-slate-400">DEDUCTIONS</div>
                  <div className="mt-3 divide-y">
                    {(data?.deductions || []).map((d) => (
                      <Row key={d.label} label={d.label} value={d.value} tone="deduct" />
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

        <div className="space-y-6">
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
                  className="flex items-center justify-between gap-4 rounded-2xl border bg-white px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                      <FileText size={18} className="text-slate-600" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{fixYear(p.month)}</div>
                      <div className="text-xs text-slate-500">Paid {fixYear(p.paidOn)}</div>
                    </div>
                  </div>

                  <IconButton title="Download">
                    <Download size={18} />
                  </IconButton>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Tax Summary"
            subtitle="Regime"
            action={<Badge tone="neutral">{data?.tax?.regime || "Regime"}</Badge>}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Percent size={16} className="text-slate-500" />
                  Tax Paid
                </div>
                <div className="text-sm font-extrabold text-slate-900">
                  {money(data?.tax?.paid || 0)} <span className="text-slate-400">/</span>{" "}
                  {money(data?.tax?.projected || 0)}
                </div>
              </div>

              <ProgressBar value={taxPct} />

              <div className="text-center text-xs text-slate-500">
                {Math.round(taxPct)}% of projected annual tax (2025)
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
              {money(data?.net || 0)}
            </div>
            <div className="mt-2 text-sm text-white/80">
              Credited to Account ending in {demo.employee.bankMasked}
            </div>
          </div>

          <PrimaryButton
            onClick={() => alert("Open Payslip (demo)")}
            className="bg-white text-slate-900 hover:bg-white/95"
          >
            <CalendarDays size={16} />
            View Pay Slip
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
