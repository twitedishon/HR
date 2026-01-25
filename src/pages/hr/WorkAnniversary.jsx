import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  CalendarDays,
  Sparkles,
  Search,
  Mail,
  Building2,
  IdCard,
  CalendarCheck2,
  Award,
  Medal,
  Clock,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";

const EMP_TABLE = "hrmss_employees";
const EMP_PROFILE_TABLE = "hrmss_employee_profiles";
const EMPLOYEE_COLUMNS =
  "employee_id, full_name, department, role, join_date, avatar, email, phone";
const PROFILE_COLUMNS =
  "employee_id, full_name, department, role, location, avatar_url, official_email, personal_email, mobile_number, created_at";

/* ---------------- HELPERS ---------------- */
const fmtDateLong = (iso) => formatDDMMYYYY(iso);

function getYearsOfService(joinDate) {
  if (!joinDate) return 0;
  const today = new Date();
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return 0;

  let years = today.getFullYear() - start.getFullYear();
  const m = today.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < start.getDate())) {
    years--;
  }
  return years;
}

function daysUntilAnniversary(joinDate) {
  if (!joinDate) return 9999;
  const today = new Date();
  const start = new Date(joinDate);
  if (Number.isNaN(start.getTime())) return 9999;

  const target = new Date(
    today.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  target.setHours(0, 0, 0, 0);

  const t = new Date(today);
  t.setHours(0, 0, 0, 0);

  if (target < t) target.setFullYear(today.getFullYear() + 1);

  const diff = Math.ceil((target - t) / (1000 * 60 * 60 * 24));
  return Number.isFinite(diff) ? diff : 9999;
}

function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "U";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase();
}

function isAnniversaryThisMonth(joinDate) {
  if (!joinDate) return false;
  const today = new Date();
  const start = new Date(joinDate);
  return start.getMonth() === today.getMonth();
}

/* ---------------- SMALL UI ---------------- */
function StatCard({ icon: Icon, label, value, tone = "teal", onClick, active }) {
  const tones = {
    teal: { tone: "#0F766E", soft: "#D8F3EF" },
    gold: { tone: "#B45309", soft: "#FEF3C7" },
    slate: { tone: "#334155", soft: "#E2E8F0" },
    clay: { tone: "#9A3412", soft: "#FDE7D8" },
  };
  const palette = tones[tone] || tones.teal;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`wa-panel wa-stat wa-fade-up ${onClick ? "cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg" : ""} ${active ? "ring-2 ring-emerald-200" : ""}`}
      style={{ "--wa-tone": palette.tone, "--wa-tone-soft": palette.soft }}
    >
      <div className="wa-stat-icon">
        <Icon size={20} />
      </div>
      <div>
        <div className="wa-stat-value">{value}</div>
        <div className="wa-stat-label">{label}</div>
      </div>
    </Tag>
  );
}

function IconBadge({ children }) {
  return <div className="wa-icon-badge">{children}</div>;
}

function DetailRow({ icon, label, value }) {
  return (
    <div className="wa-detail-row">
      <IconBadge>{icon}</IconBadge>
      <div className="min-w-0">
        <div className="wa-detail-label">{label}</div>
        <div className="wa-detail-value">{value || "-"}</div>
      </div>
    </div>
  );
}

/* ---------------- MAIN ---------------- */
export default function WorkAnniversary() {
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  // Fetch Logic
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Fetch all employees from profile table
        const { data: profileRows, error: profileError } = await supabase
          .from(EMP_PROFILE_TABLE)
          .select(
            "employee_id, full_name, official_email, personal_email, mobile_number, location, avatar_url"
          )
          .eq("profile_completed", true)
          .order("employee_id", { ascending: true });

        if (profileError) throw profileError;
        if (!mounted) return;

        const rows = profileRows || [];
        const employeeIds = rows.map((row) => row.employee_id).filter(Boolean);

        let joinDateMap = new Map();
        let departmentMap = new Map();
        let roleMap = new Map();

        if (employeeIds.length) {
          const { data: jobRows, error: jobError } = await supabase
            .from(EMP_TABLE)
            .select("employee_id, join_date, department, role")
            .in("employee_id", employeeIds);

          if (jobError) {
            console.warn(
              "Work Anniversary: failed to load join dates",
              jobError
            );
          } else if (jobRows) {
            for (const row of jobRows) {
              if (row.employee_id && row.join_date) {
                joinDateMap.set(row.employee_id, row.join_date);
              }
              if (row.employee_id && row.department) {
                departmentMap.set(row.employee_id, row.department);
              }
              if (row.employee_id && row.role) {
                roleMap.set(row.employee_id, row.role);
              }
            }
          }
        }

        // Map all employees (no filtering by join_date)
        const mapped = rows
          .map((emp) => {
            const joinDate = joinDateMap.get(emp.employee_id);
            const years = joinDate ? getYearsOfService(joinDate) : 0;
            const days = joinDate ? daysUntilAnniversary(joinDate) : 9999;

            return {
              id: emp.employee_id,
              name: emp.full_name,
              department: departmentMap.get(emp.employee_id) || "-",
              role: roleMap.get(emp.employee_id) || "-",
              joinDate: joinDate || null,
              email: emp.official_email || emp.personal_email || "",
              phone: emp.mobile_number || "",
              avatar: emp.avatar_url || "",
              yearsOfService: years,
              daysUntil: days,
            };
          })
          .filter((x) => x.id);

        setEmployees(mapped);
      } catch (error) {
        console.error("Error fetching anniversaries:", error);
        if (mounted) setErr(error.message || "Failed to load anniversaries");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Filter & Sort
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = employees;

    if (filter === "week") {
      filtered = filtered.filter((e) => e.daysUntil <= 7);
    } else if (filter === "month") {
      filtered = filtered.filter(
        (e) => e.yearsOfService >= 1 && isAnniversaryThisMonth(e.joinDate)
      );
    } else if (filter === "milestone") {
      filtered = filtered.filter(
        (e) => e.yearsOfService >= 5 && e.yearsOfService % 5 === 0
      );
    }

    if (q) {
      filtered = filtered.filter(
        (e) =>
          (e.name || "").toLowerCase().includes(q) ||
          (e.department || "").toLowerCase().includes(q)
      );
    }

    return filtered.sort(
      (a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name)
    );
  }, [query, employees, filter]);

  // Auto-select
  useEffect(() => {
    if (!list.length) {
      setSelected(null);
      return;
    }
    const still = selected && list.find((x) => x.id === selected.id);
    if (!still) setSelected(list[0]);
  }, [list, selected]);

  const showNoResults = !loading && !list.length;
  const noResultsText = query.trim()
    ? "No work anniversaries found matching your search."
    : "No work anniversaries yet.";

  // Stats
  const stats = useMemo(() => {
    const total = employees.length;
    const week = employees.filter((e) => e.daysUntil <= 7).length;
    const month = employees.filter(
      (e) => e.yearsOfService >= 1 && isAnniversaryThisMonth(e.joinDate)
    ).length;
    const milestones = employees.filter(
      (e) => e.yearsOfService >= 5 && e.yearsOfService % 5 === 0
    ).length; // e.g., 5, 10, 15 years
    return { total, week, month, milestones };
  }, [employees]);

  return (
    <div
      className="wa-root"
      style={{
        "--wa-bg": "#f7f3ec",
        "--wa-panel": "#ffffff",
        "--wa-ink": "#0f172a",
        "--wa-muted": "#667085",
        "--wa-line": "#e5e7eb",
        "--wa-accent": "#0f766e",
        "--wa-accent-strong": "#115e59",
        "--wa-accent-soft": "#d8f3ef",
        "--wa-gold": "#b45309",
        "--wa-shadow": "0 18px 40px rgba(15, 23, 42, 0.08)",
        "--wa-font-display": '"Playfair Display","Georgia","Times New Roman",serif',
        "--wa-font-body": '"Source Serif 4","Georgia",serif',
      }}
    >
      <style>{`
        .wa-root {
          color: var(--wa-ink);
          font-family: var(--wa-font-body);
        }
        .wa-page {
          min-height: 100vh;
          background: #f7f3ec url("/ANN-work-anniversary-desk-SH2-2021.jpg")
            center / cover no-repeat;
          position: relative;
          overflow: hidden;
        }
        .wa-page::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.72);
          pointer-events: none;
          z-index: 0;
        }
        .wa-shell {
          max-width: 1200px;
          margin: 0 auto;
          padding: 28px 24px 40px;
          position: relative;
          z-index: 1;
        }
        .wa-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .wa-blob {
          position: absolute;
          border-radius: 999px;
          opacity: 0.6;
        }
        .wa-blob.one {
          width: 220px;
          height: 220px;
          background: #dff3f0;
          top: -40px;
          right: 6%;
        }
        .wa-blob.two {
          width: 260px;
          height: 260px;
          background: #f6e7d8;
          bottom: -120px;
          left: 4%;
        }
        .wa-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          flex-wrap: wrap;
        }
        .wa-hero-grid {
          display: grid;
          gap: 20px;
          align-items: stretch;
        }
        .wa-hero-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .wa-stats-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: stretch;
          align-content: start;
        }
        .wa-eyebrow {
          text-transform: uppercase;
          letter-spacing: 0.2em;
          font-size: 10px;
          color: var(--wa-muted);
        }
        .wa-title {
          font-family: var(--wa-font-display);
          font-size: 32px;
          font-weight: 700;
          margin-top: 6px;
        }
        .wa-sub {
          margin-top: 6px;
          font-size: 14px;
          color: var(--wa-muted);
          max-width: 520px;
        }
        .wa-panel {
          background: var(--wa-panel);
          border: 1px solid var(--wa-line);
          border-radius: 28px;
          box-shadow: var(--wa-shadow);
        }
        .wa-stat {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 96px;
        }
        .wa-stat-icon {
          height: 44px;
          width: 44px;
          border-radius: 16px;
          background: var(--wa-tone-soft);
          color: var(--wa-tone);
          display: grid;
          place-items: center;
        }
        .wa-stat-value {
          font-size: 24px;
          font-weight: 700;
          color: var(--wa-ink);
        }
        .wa-stat-label {
          font-size: 11px;
          color: var(--wa-muted);
          text-transform: uppercase;
          letter-spacing: 0.12em;
          margin-top: 2px;
        }
        .wa-search {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--wa-line);
          border-radius: 18px;
          padding: 12px 14px;
          background: #fff;
        }
        .wa-list {
          border: 1px solid var(--wa-line);
          border-radius: 28px;
          background: var(--wa-panel);
          box-shadow: var(--wa-shadow);
          overflow: hidden;
        }
        .wa-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 20px;
          text-align: left;
          width: 100%;
          background: transparent;
          transition: background 0.2s ease, transform 0.2s ease;
          position: relative;
        }
        .wa-row:hover {
          background: #f8fbfa;
        }
        .wa-row.is-active {
          background: var(--wa-accent-soft);
        }
        .wa-row.is-active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 10px;
          bottom: 10px;
          width: 4px;
          background: var(--wa-accent);
          border-radius: 999px;
        }
        .wa-avatar {
          height: 48px;
          width: 48px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 13px;
          background: #0f766e;
          color: #fff;
          overflow: hidden;
        }
        .wa-avatar.is-active {
          background: #0c5f59;
        }
        .wa-row-title {
          font-weight: 700;
          color: var(--wa-ink);
        }
        .wa-row-sub {
          font-size: 12px;
          color: var(--wa-muted);
          margin-top: 2px;
        }
        .wa-chip {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          border: 1px solid rgba(15, 118, 110, 0.2);
          color: var(--wa-accent-strong);
          background: #e9f7f4;
        }
        .wa-chip.soon {
          border-color: rgba(180, 83, 9, 0.25);
          color: var(--wa-gold);
          background: #fff4db;
        }
        .wa-spotlight {
          border: 1px solid var(--wa-line);
          border-radius: 28px;
          overflow: hidden;
          background: var(--wa-panel);
          box-shadow: var(--wa-shadow);
        }
        .wa-spotlight-head {
          padding: 22px;
          background: linear-gradient(135deg, #0f766e 0%, #14532d 100%);
          color: #fff;
        }
        .wa-spotlight-title {
          font-family: var(--wa-font-display);
          font-size: 20px;
          font-weight: 700;
        }
        .wa-spotlight-role {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.8);
          margin-top: 4px;
        }
        .wa-spotlight-body {
          padding: 20px 22px;
        }
        .wa-detail-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .wa-detail-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--wa-muted);
        }
        .wa-detail-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--wa-ink);
          margin-top: 4px;
        }
        .wa-icon-badge {
          height: 36px;
          width: 36px;
          border-radius: 12px;
          background: #f1f5f4;
          color: #4b5563;
          display: grid;
          place-items: center;
        }
        .wa-fade-up {
          animation: waFadeUp 0.5s ease both;
        }
        @keyframes waFadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (min-width: 900px) {
          .wa-hero-grid {
            grid-template-columns: minmax(0, 1fr);
          }
          .wa-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1200px) {
          .wa-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 680px) {
          .wa-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
      <div className="wa-page">
        <div className="wa-bg" aria-hidden="true">
          <span className="wa-blob one" />
          <span className="wa-blob two" />
        </div>
        <div className="wa-shell space-y-6">
          <section className="wa-hero-grid">
            <div className="wa-hero-content">
              <header className="wa-header">
                <div>
                  <p className="wa-eyebrow">HR workspace</p>
                  <h1 className="wa-title">Work Anniversary</h1>
                  <p className="wa-sub">
                    Track service milestones, upcoming celebrations, and team tenure at a
                    glance.
                  </p>
                </div>
              </header>

              <div className="wa-stats-grid">
                <StatCard
                  icon={Award}
                  label="Total Anniversaries"
                  value={stats.total}
                  tone="slate"
                  onClick={() => setFilter("all")}
                  active={filter === "all"}
                />
                <StatCard
                  icon={Clock}
                  label="Coming This Week"
                  value={stats.week}
                  tone="gold"
                  onClick={() => setFilter("week")}
                  active={filter === "week"}
                />
                <StatCard
                  icon={CalendarDays}
                  label="This Month"
                  value={stats.month}
                  tone="teal"
                  onClick={() => setFilter("month")}
                  active={filter === "month"}
                />
                <StatCard
                  icon={Medal}
                  label="Milestones (5y, 10y...)"
                  value={stats.milestones}
                  tone="clay"
                  onClick={() => setFilter("milestone")}
                  active={filter === "milestone"}
                />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)] gap-6">
            <div className="space-y-4">
              <div className="wa-list">
                <div className="px-5 pt-5 pb-4">
                  <div className="wa-search">
                    <Search className="text-slate-400" size={18} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by name or department..."
                      className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                  {err ? (
                    <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      {err}
                    </div>
                  ) : null}
                </div>

                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {loading ? (
                    <div className="px-5 py-10 text-center text-sm text-slate-500">
                      Loading anniversaries...
                    </div>
                  ) : (
                    <>
                      {list.map((emp, index) => {
                        const active = selected?.id === emp.id;
                        const soon = emp.daysUntil <= 7;

                        return (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => setSelected(emp)}
                            className={`wa-row ${active ? "is-active" : ""}`}
                            style={{
                              animation: "waFadeUp 0.45s ease both",
                              animationDelay: `${Math.min(index * 40, 320)}ms`,
                            }}
                          >
                            <div className={`wa-avatar ${active ? "is-active" : ""}`}>
                              {emp.avatar ? (
                                <img
                                  src={emp.avatar}
                                  alt={emp.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                initials(emp.name)
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="wa-row-title truncate">{emp.name}</div>
                              <div className="wa-row-sub truncate">
                                {emp.role || "-"} - {emp.department || "-"}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span className={`wa-chip ${soon ? "soon" : ""}`}>
                                {emp.yearsOfService} yr
                                {emp.yearsOfService === 1 ? "" : "s"}
                              </span>
                              {soon && (
                                <span className="text-[11px] font-semibold text-amber-700">
                                  In {emp.daysUntil} days
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {showNoResults ? (
                        <div className="px-5 py-10 text-center text-sm text-slate-500">
                          {noResultsText}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="wa-spotlight wa-fade-up sticky top-24 h-fit">
              <div className="wa-spotlight-head">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/15 grid place-items-center font-bold text-white overflow-hidden">
                    {selected?.avatar ? (
                      <img
                        src={selected.avatar}
                        alt={selected.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(selected?.name || "")
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="wa-spotlight-title truncate">
                      {selected?.name || "Select an employee"}
                    </div>
                    <div className="wa-spotlight-role truncate">
                      {selected?.role || "-"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="wa-spotlight-body space-y-4">
                {selected ? (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                    Celebrating {selected.yearsOfService} year
                    {selected.yearsOfService === 1 ? "" : "s"} of service
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 text-slate-600 px-4 py-3 text-sm font-semibold">
                    Pick an employee to view details
                  </div>
                )}

                <div className="space-y-4">
                  <DetailRow
                    icon={<IdCard size={18} />}
                    label="Employee ID"
                    value={selected?.id}
                  />
                  <DetailRow
                    icon={<Building2 size={18} />}
                    label="Department"
                    value={selected?.department}
                  />
                  <DetailRow
                    icon={<CalendarCheck2 size={18} />}
                    label="Date of Joining"
                    value={selected?.joinDate ? fmtDateLong(selected.joinDate) : "-"}
                  />
                  <DetailRow
                    icon={<Clock size={18} />}
                    label="Next Anniversary In"
                    value={
                      Number.isFinite(selected?.daysUntil)
                        ? `${selected.daysUntil} days`
                        : "-"
                    }
                  />
                  <DetailRow
                    icon={<Mail size={18} />}
                    label="Email"
                    value={selected?.email}
                  />
                  {selected?.phone ? (
                    <DetailRow
                      icon={<Users size={18} />}
                      label="Phone"
                      value={selected.phone}
                    />
                  ) : null}
                </div>

               
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
