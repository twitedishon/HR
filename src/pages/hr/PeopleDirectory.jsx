// OK src/pages/hr/PeopleDirectory.jsx (or wherever you keep it)
import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Gift,
  CalendarDays,
  Sparkles,
  Search,
  Mail,
  Phone,
  Building2,
  IdCard,
  CalendarCheck2,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient.js";
import { formatDDMMYYYY } from "../../lib/dateUtils";

/* ---------------- HELPERS ---------------- */
const fmtDateLong = (iso) => formatDDMMYYYY(iso);

function daysUntilBirthday(dob) {
  if (!dob) return 9999;
  const today = new Date();
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 9999;

  const target = new Date(
    today.getFullYear(),
    birth.getMonth(),
    birth.getDate()
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

function monthIndexFromDob(dob) {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return -1;
  return d.getMonth(); // 0-11
}

function isBirthdayThisMonth(dob) {
  const now = new Date();
  const m = monthIndexFromDob(dob);
  return m >= 0 && m === now.getMonth();
}

function celebratedThisYear(dob) {
  const now = new Date();
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return false;

  const thisYearBDay = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  thisYearBDay.setHours(0, 0, 0, 0);

  const t = new Date(now);
  t.setHours(0, 0, 0, 0);

  return thisYearBDay < t; // already passed this year
}

/* ---------------- SMALL UI ---------------- */
function StatCard({ icon: Icon, label, value, tone = "purple", onClick, active }) {
  const tones = {
    purple: "bg-[#7C3AED]/10 text-[#7C3AED]",
    orange: "bg-[#FB923C]/15 text-[#F97316]",
    violet: "bg-[#8B5CF6]/10 text-[#7C3AED]",
    amber: "bg-[#F59E0B]/15 text-[#D97706]",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-3xl bg-white/80 backdrop-blur border border-white shadow-sm px-6 py-5 flex items-center gap-4 ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md" : ""
        } ${active ? "ring-2 ring-amber-200" : ""}`}
    >
      <div
        className={`h-11 w-11 rounded-2xl flex items-center justify-center ${tones[tone]}`}
      >
        <Icon size={20} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 leading-none">
          {value}
        </div>
        <div className="mt-1 text-xs text-slate-500">{label}</div>
      </div>
    </Tag>
  );
}

function IconBadge({ children }) {
  return (
    <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
      {children}
    </div>
  );
}

/* ---------------- MAIN ---------------- */
export default function PeopleDirectory() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // OK Load from Supabase (remove fake data)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr("");

        // OK employee sign-in save: hrmss_employee_profiles
        const { data, error } = await supabase
          .from("hrmss_employee_profiles")
          .select(
            `
            employee_id,
            full_name,
            dob,
            official_email,
            personal_email,
            mobile_number,
            location,
            avatar_url
          `
          )
          .eq("profile_completed", true)
          .order("employee_id", { ascending: true });

        if (error) throw error;
        if (!mounted) return;

        const mapped = (data || [])
          .map((r) => ({
            id: r.employee_id || "",
            name: r.full_name || "Unknown",
            dob: r.dob || "",
            joined: "", // not in this table
            position: "Employee", // optional
            department: r.location || "-", // optional: using location (since dept not in table)
            email: r.official_email || r.personal_email || "",
            phone: r.mobile_number || "",
            avatar: r.avatar_url || "",
          }))
          .filter((x) => x.id); // safe

        setEmployees(mapped);
      } catch (e) {
        console.error(e);
        if (mounted) setErr(e?.message || "Failed to load employees");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = employees;

    if (filter === "week") {
      filtered = filtered.filter((e) => daysUntilBirthday(e.dob) <= 7);
    } else if (filter === "month") {
      filtered = filtered.filter((e) => isBirthdayThisMonth(e.dob));
    } else if (filter === "celebrated") {
      filtered = filtered.filter(
        (e) => isBirthdayThisMonth(e.dob) && celebratedThisYear(e.dob)
      );
    }

    return filtered
      .map((e) => ({ ...e, days: daysUntilBirthday(e.dob) }))
      .filter((e) => `${e.name} ${e.department}`.toLowerCase().includes(q))
      .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
  }, [query, employees, filter]);


  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!list.length) {
      setSelected(null);
      return;
    }
    const still = selected && list.find((x) => x.id === selected.id);
    if (!still) setSelected(list[0]);
  }, [list, selected]);

  const stats = useMemo(() => {
    const total = employees.length;
    const week = employees.filter((e) => daysUntilBirthday(e.dob) <= 7).length;
    const month = employees.filter((e) => isBirthdayThisMonth(e.dob)).length;
    const celebrated = employees.filter(
      (e) => isBirthdayThisMonth(e.dob) && celebratedThisYear(e.dob)
    ).length;
    return { total, week, month, celebrated };
  }, [employees]);

  const birthdaySoon = selected?.dob ? daysUntilBirthday(selected.dob) : 0;

  return (
    <div className="min-h-screen px-6 py-7 bg-gradient-to-b from-[#f6efff] via-[#fbf6ff] to-[#ffffff]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* TOP STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <StatCard
            icon={Users}
            label="Total Employees"
            value={stats.total}
            tone="purple"
            onClick={() => setFilter("all")}
            active={filter === "all"}
          />
          <StatCard
            icon={Gift}
            label="This Week"
            value={stats.week}
            tone="orange"
            onClick={() => setFilter("week")}
            active={filter === "week"}
          />
          <StatCard
            icon={CalendarDays}
            label="This Month"
            value={stats.month}
            tone="violet"
            onClick={() => setFilter("month")}
            active={filter === "month"}
          />
          <StatCard
            icon={Sparkles}
            label="Celebrated"
            value={stats.celebrated}
            tone="amber"
            onClick={() => setFilter("celebrated")}
            active={filter === "celebrated"}
          />
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT */}
          <div className="lg:col-span-2">
            <div className="rounded-[32px] bg-white/70 backdrop-blur border border-white shadow-sm overflow-hidden">
              {/* Search */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 px-4 py-3 shadow-sm">
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

              {/* List */}
              <div className="divide-y divide-slate-100">
                {loading ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">
                    Loading employees...
                  </div>
                ) : (
                  <>
                    {list.map((emp) => {
                      const active = selected?.id === emp.id;
                      const soon = emp.days <= 7;

                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setSelected(emp)}
                          className={`w-full text-left px-5 py-4 flex items-center gap-4 transition relative
                            ${active
                              ? "bg-gradient-to-r from-[#FAD2D9] to-[#F8C7C9]"
                              : "hover:bg-white"
                            }
                          `}
                        >
                          {/* left accent when selected */}
                          {active ? (
                            <span className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#7C3AED]" />
                          ) : null}

                          {/* Avatar */}
                          <div
                            className={`h-12 w-12 rounded-full grid place-items-center font-bold text-sm overflow-hidden
                            ${active
                                ? "bg-orange-200 text-orange-800"
                                : "bg-[#7C3AED] text-white"
                              }
                          `}
                          >
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

                          {/* Name + meta */}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">
                              {emp.name}
                            </div>
                            <div className="text-sm text-slate-500 truncate">
                              {emp.position} - {emp.department}
                            </div>
                          </div>

                          {/* days badge */}
                          {soon ? (
                            <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                              <Gift size={14} />
                              {emp.days}d
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">
                              {emp.days}d
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {!list.length ? (
                      <div className="px-5 py-10 text-center text-sm text-slate-500">
                        No employees found.
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="rounded-[32px] overflow-hidden bg-white/70 backdrop-blur border border-white shadow-sm">
            {/* Orange header */}
            <div className="relative px-6 pt-7 pb-6 bg-gradient-to-br from-[#FB923C] to-[#F97316]">
              {/* bubbles */}
              <span className="absolute -top-10 -left-10 h-28 w-28 rounded-full bg-white/15" />
              <span className="absolute top-7 right-10 h-10 w-10 rounded-full bg-white/15" />
              <span className="absolute top-14 left-28 h-4 w-4 rounded-full bg-white/30" />
              <span className="absolute top-10 right-28 h-6 w-6 rounded-full bg-white/20" />

              <div className="relative flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-white/20 grid place-items-center text-white font-extrabold text-lg overflow-hidden">
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
                <div className="text-white min-w-0">
                  <div className="text-xl font-bold truncate">
                    {selected?.name || "Select an employee"}
                  </div>
                  <div className="text-white/90 text-sm truncate">
                    {selected?.position || "-"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Birthday chip */}
              {selected ? (
                <div className="rounded-2xl bg-[#FDEBD9] text-[#B45309] px-4 py-3 flex items-center gap-2 font-semibold">
                  <CalendarDays size={18} />
                  Birthday in {birthdaySoon} day{birthdaySoon === 1 ? "" : "s"}
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 text-slate-600 px-4 py-3 text-sm font-semibold">
                  Pick an employee from the list
                </div>
              )}

              {/* Details list */}
              <div className="space-y-4">
                <DetailRow
                  icon={<IdCard size={18} />}
                  label="EMPLOYEE ID"
                  value={selected?.id}
                />
                <DetailRow
                  icon={<Building2 size={18} />}
                  label="DEPARTMENT"
                  value={selected?.department}
                />
                <DetailRow
                  icon={<CalendarDays size={18} />}
                  label="DATE OF BIRTH"
                  value={selected?.dob ? fmtDateLong(selected.dob) : "-"}
                />
                <DetailRow
                  icon={<Mail size={18} />}
                  label="EMAIL"
                  value={selected?.email}
                />
                <DetailRow
                  icon={<Phone size={18} />}
                  label="PHONE"
                  value={selected?.phone}
                />
              </div>


            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- DETAILS ROW ---------------- */
function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <IconBadge>{icon}</IconBadge>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </div>
        <div className="mt-1 font-semibold text-slate-800 break-words">
          {value || "-"}
        </div>
      </div>
    </div>
  );
}
