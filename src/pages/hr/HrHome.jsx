// ✅ File: src/pages/hr/HrHome.jsx
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  Users,
  Shield,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Building2,
  Sparkles,
  Hash,
  IdCard,
  AlertTriangle,
  Briefcase,
  CreditCard,
  GraduationCap,
} from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";

/* ---------------- HELPERS ---------------- */
function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase();
}
function safeLower(x) {
  return (x || "").toString().toLowerCase();
}
function formatDate(iso) {
  return formatDDMMYYYY(iso);
}

const EMP_TABLE = "hrmss_employees";
const EMP_PROFILE_TABLE = "hrmss_employee_profiles";
const ADMIN_PROFILE_TABLE = "hrmss_profiles";

function deptBadge(dept = "Unknown") {
  const key = safeLower(dept);
  const options = [
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-lime-50 text-lime-700 border-lime-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
  ];
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  const pick = options[sum % options.length];
  return `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${pick}`;
}

const pillBase =
  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm";

const typePill = (type) => {
  if (type === "employee")
    return `${pillBase} bg-emerald-50 text-emerald-700 border-emerald-200`;
  return `${pillBase} bg-violet-50 text-violet-700 border-violet-200`;
};

const TAB_VALUES = new Set(["all", "ta_team", "tech_team", "bd_team"]);

const SortIcon = ({ active, dir }) => {
  if (!active) return <ArrowUpDown size={14} className="opacity-70" />;
  return dir === "asc" ? (
    <ArrowUp size={14} className="opacity-90" />
  ) : (
    <ArrowDown size={14} className="opacity-90" />
  );
};

const SegButton = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`group inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${active
      ? "bg-slate-900 text-white border-slate-900 shadow"
      : "bg-white/70 text-slate-700 border-slate-200 hover:bg-white hover:shadow-sm"
      }`}
  >
    {Icon ? (
      <span
        className={`p-1.5 rounded-xl border transition ${active
          ? "bg-white/10 border-white/15"
          : "bg-slate-50 border-slate-200 group-hover:bg-white"
          }`}
      >
        <Icon size={16} />
      </span>
    ) : null}
    {label}
  </button>
);

/* ---------------- SMALL MODAL (SMALLER + SCROLL) ---------------- */
function SmallModal({ open, title, subtitle, children, accent = "indigo", onClose }) {
  if (!open) return null;

  const accentMap = {
    indigo: "from-indigo-500/18 via-sky-500/10 to-emerald-500/10",
    emerald: "from-emerald-500/18 via-cyan-500/10 to-indigo-500/10",
    violet: "from-violet-500/18 via-indigo-500/10 to-cyan-500/10",
    amber: "from-amber-500/18 via-rose-500/10 to-indigo-500/10",
  };
  const bg = accentMap[accent] || accentMap.indigo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />

      {/* ✅ smaller width */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <div className={`absolute inset-0 bg-gradient-to-br ${bg}`} />

        <div className="relative">
          {/* header */}
          <div className="px-4 py-3 border-b bg-white/75 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-slate-900 truncate">{title}</div>
                {subtitle ? <div className="mt-0.5 text-xs text-slate-600 truncate">{subtitle}</div> : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-2xl hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ✅ content scroll */}
          <div className="p-4 max-h-[72vh] overflow-y-auto">{children}</div>

          {/* footer */}
          <div className="px-4 py-3 border-t bg-white/75 backdrop-blur flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-sm font-semibold border bg-slate-900 text-white border-slate-900 hover:bg-slate-800 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SMALL UI: Modal Tabs ---------------- */
const ModalTabBtn = ({ active, onClick, icon: Icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-2xl text-sm font-semibold border transition ${active
      ? "bg-slate-900 text-white border-slate-900 shadow"
      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
  >
    {Icon ? <Icon size={16} /> : null}
    {label}
  </button>
);

const parseList = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const FieldRow = ({ label, value }) => (
  <div className="rounded-2xl border bg-slate-50 p-3">
    <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-semibold text-slate-900 break-words">{value || "-"}</div>
  </div>
);

const ProfileListSection = ({ title, icon: Icon, loading, items, emptyText, render }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
      {Icon ? <Icon size={16} /> : null}
      {title}
    </div>
    {loading ? (
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">Loading...</div>
    ) : items?.length ? (
      <div className="space-y-2">{items.map(render)}</div>
    ) : (
      <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">{emptyText}</div>
    )}
  </div>
);

/* ---------------- PAGE ---------------- */
export default function HrHome() {
  const [searchParams] = useSearchParams();
  const tabParam = (searchParams.get("tab") || "").toLowerCase();
  const initialTab = TAB_VALUES.has(tabParam) ? tabParam : "all";
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const [employees, setEmployees] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [viewing, setViewing] = useState(null);
  const [modalTab, setModalTab] = useState("personal");
  const [profileDetail, setProfileDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const combined = useMemo(
    () => [...employees, ...admins],
    [employees, admins]
  );

  const counts = useMemo(() => {
    const emp = employees.length;
    const adm = admins.length;
    const total = emp + adm;
    return { emp, adm, total };
  }, [employees, admins]);

  useEffect(() => {
    let mounted = true;

    const fetchUsers = async () => {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setEmployees([]);
          setAdmins([]);
          setLoadingUsers(false);
          setLoadError("Supabase not configured.");
        }
        return;
      }

      try {
        setLoadingUsers(true);
        setLoadError("");

        const [empRes, profileRes, adminRes] = await Promise.all([
          supabase
            .from(EMP_TABLE)
            .select(
              "employee_id, full_name, email, phone, department, role, join_date, location, gender"
            )
            .order("employee_id", { ascending: true }),
          supabase
            .from(EMP_PROFILE_TABLE)
            .select(
              "employee_id, full_name, personal_email, official_email, mobile_number, location, gender"
            )
            .eq("profile_completed", true),
          supabase
            .from(ADMIN_PROFILE_TABLE)
            .select(
              "user_id, employee_id, full_name, personal_email, official_email, mobile_number, department, designation, role, location, created_at"
            )
            .in("role", ["admin", "hr"]),
        ]);

        if (empRes.error) throw empRes.error;

        const profileMap = new Map(
          (profileRes.data || [])
            .filter((p) => p?.employee_id)
            .map((p) => [String(p.employee_id), p])
        );

        const mappedEmployees = (empRes.data || [])
          .map((row) => {
            const key = String(row.employee_id || "");
            const profile = profileMap.get(key);
            return {
              type: "employee",
              id: key,
              name: row.full_name || profile?.full_name || "",
              email:
                row.email ||
                profile?.official_email ||
                profile?.personal_email ||
                "",
              phone: row.phone || profile?.mobile_number || "",
              department: row.department || "",
              designation: row.role || "Employee",
              joinedOn: row.join_date || "",
              location: row.location || profile?.location || "",
              gender: row.gender || profile?.gender || "",
            };
          })
          .filter((row) => row.id);

        const EXCLUDED_Admin_IDS = ["HR-001", "HR-PRIYA", "MGR-SUNIL", "lkjfhd"];

        const mappedAdmins = adminRes.error
          ? []
          : (adminRes.data || [])
            .filter((row) => {
              const id = row.employee_id || row.user_id || "";
              return !EXCLUDED_Admin_IDS.includes(id);
            })
            .map((row) => ({
              type: "admin",
              id: row.employee_id || row.user_id || "",
              userId: row.user_id || "",
              name: row.full_name || "",
              email: row.official_email || row.personal_email || "",
              phone: row.mobile_number || "",
              role: row.designation || row.role || "Admin",
              department: row.department || "",
              joinedOn: row.created_at || "",
              location: row.location || "",
            }))
            .filter((row) => row.id);

        if (!mounted) return;
        setEmployees(mappedEmployees);
        setAdmins(mappedAdmins);

        if (adminRes.error) {
          console.warn("Admin fetch failed:", adminRes.error.message);
        }
      } catch (fetchError) {
        if (!mounted) return;
        setEmployees([]);
        setAdmins([]);
        setLoadError(fetchError?.message || "Failed to load users.");
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };

    fetchUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = [...combined];

    // TA Team: Talent Acquisition Manager, Talent Acquisition Executive
    if (tab === "ta_team") {
      list = list.filter((x) => {
        const dept = safeLower(x.department);
        return dept === "talent acquisition manager" || dept === "talent acquisition executive";
      });
    }
    // Tech Team: AI Engineer, AI Intern, UI/UX Intern, Software Developer Intern
    if (tab === "tech_team") {
      list = list.filter((x) => {
        const dept = safeLower(x.department);
        return (
          dept === "ai engineer" ||
          dept === "ai intern" ||
          dept === "ui/ux intern" ||
          dept === "software developer intern"
        );
      });
    }
    // BD Team: Business Development Executive
    if (tab === "bd_team") {
      list = list.filter((x) => {
        const dept = safeLower(x.department);
        return dept === "business development executive";
      });
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((x) => {
        const roleOrDept =
          x.type === "employee"
            ? `${x.department} ${x.designation}`
            : `${x.role || ""} ${x.department || ""}`;
        return (
          safeLower(x.id).includes(q) ||
          safeLower(x.name).includes(q) ||
          safeLower(x.email).includes(q) ||
          safeLower(x.phone).includes(q) ||
          safeLower(roleOrDept).includes(q) ||
          safeLower(x.location).includes(q)
        );
      });
    }

    const get = (x) => {
      switch (sortKey) {
        case "id":
          return x.id || "";
        case "type":
          return x.type || "";
        case "joinedOn":
          return x.joinedOn || "";
        case "name":
        default:
          return x.name || "";
      }
    };

    list.sort((a, b) => {
      const A = get(a);
      const B = get(b);
      if (A === B) return 0;
      const res = A > B ? 1 : -1;
      return sortDir === "asc" ? res : -res;
    });

    return list;
  }, [combined, tab, search, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
  };

  const openProfile = (u) => {
    setViewing(u);
    setModalTab("personal");
  };
  const closeProfile = () => setViewing(null);

  const searchHint = useMemo(() => {
    if (!search.trim()) return "Search by name, id, email, role/department...";
    return `Searching: "${search.trim()}"`;
  }, [search]);

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!viewing || !isSupabaseConfigured) {
        if (mounted) {
          setProfileDetail(null);
          setDetailError("");
          setDetailLoading(false);
        }
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError("");

        const profileTable =
          viewing.type === "employee" ? EMP_PROFILE_TABLE : ADMIN_PROFILE_TABLE;
        const idColumn = viewing.type === "employee" ? "employee_id" : "user_id";

        const { data: profileRow, error: profileErr } = await supabase
          .from(profileTable)
          .select("*")
          .eq(idColumn, viewing.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileErr) throw profileErr;
        setProfileDetail(profileRow || null);
      } catch (fetchError) {
        if (!mounted) return;
        setProfileDetail(null);
        setDetailError(fetchError?.message || "Failed to load details.");
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };

    loadDetails();

    return () => {
      mounted = false;
    };
  }, [viewing]);

  useEffect(() => {
    if (viewing) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => (document.body.style.overflow = "");
  }, [viewing]);

  return (
    <section className="space-y-6">
      {/* HEADER */}
      <div className="relative overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-emerald-500 to-amber-500 opacity-[0.10]" />
          <div className="absolute -top-16 -left-16 w-[320px] h-[320px] rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="absolute -bottom-20 -right-20 w-[380px] h-[380px] rounded-full bg-emerald-500/10 blur-2xl" />
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                HR Dashboard
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/70 text-xs font-semibold text-slate-700">
                  <Hash size={14} className="opacity-80" />
                  Total: {counts.total}
                </span>
              </div>
            </div>

            {/* SEARCH + STATUS */}
            <div className="w-full md:w-[460px]">
              <div className="rounded-3xl border bg-white/80 backdrop-blur-md p-3 shadow-sm">
                <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 focus-within:ring-4 focus-within:ring-indigo-100 focus-within:border-indigo-300 transition">
                  <Search size={18} className="text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search id / name / email / role / dept / location..."
                    className="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="p-1.5 rounded-xl hover:bg-slate-100 transition"
                      aria-label="Clear search"
                    >
                      <X size={16} className="text-slate-500" />
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 text-[11px] text-slate-500">{searchHint}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap items-center gap-2">
        <SegButton active={tab === "all"} onClick={() => setTab("all")} icon={Sparkles} label="All Users" />
        <SegButton active={tab === "ta_team"} onClick={() => setTab("ta_team")} icon={Users} label="TA Team" />
        <SegButton active={tab === "tech_team"} onClick={() => setTab("tech_team")} icon={Users} label="Tech Team" />
        <SegButton active={tab === "bd_team"} onClick={() => setTab("bd_team")} icon={Users} label="BD Team" />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-[28px] border shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-sm font-extrabold text-slate-900">User Directory</div>
          </div>

          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filtered.length}</span> results
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    User <SortIcon active={sortKey === "name"} dir={sortDir} />
                  </button>
                </th>

                <th className="text-left px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("type")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    Type <SortIcon active={sortKey === "type"} dir={sortDir} />
                  </button>
                </th>

                <th className="text-left px-4 py-3 font-semibold">Contact</th>
                <th className="text-left px-4 py-3 font-semibold">Designation</th>

                <th className="text-right px-4 py-3 font-semibold">
                  <button type="button" onClick={() => toggleSort("joinedOn")} className="inline-flex items-center gap-2 hover:text-slate-900">
                    Joined <SortIcon active={sortKey === "joinedOn"} dir={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    Loading users...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-rose-600">
                    {loadError}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr
                    key={`${u.type}-${u.id}`}
                    className="hover:bg-slate-50/70 cursor-pointer transition"
                    onClick={() => openProfile(u)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative w-11 h-11 rounded-2xl border bg-white overflow-hidden shadow-sm">
                          <div
                            className={`absolute inset-0 ${u.type === "employee"
                              ? "bg-gradient-to-br from-emerald-500/25 to-cyan-500/25"
                              : "bg-gradient-to-br from-violet-500/25 to-indigo-500/25"
                              }`}
                          />
                          <div className="relative h-full w-full flex items-center justify-center">
                            <span className="text-xs font-extrabold text-slate-800">{initials(u.name)}</span>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={typePill(u.type)}>
                        {u.type === "employee" ? (
                          <>
                            <Users size={14} /> Employee
                          </>
                        ) : (
                          <>
                            <Shield size={14} /> Admin
                          </>
                        )}
                      </span>
                    </td>

                    {/* ✅ IMPORTANT: clicking email/phone should NOT open modal */}
                    <td className="px-4 py-3">
                      <div
                        className="space-y-1 cursor-text select-text"
                        onClick={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <div className="text-slate-800 font-semibold truncate">{u.email}</div>
                        <div className="text-xs text-slate-500 truncate">{u.phone}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {u.type === "employee" ? (
                        <div className="font-semibold text-slate-800">{u.designation}</div>
                      ) : (
                        <div className="font-semibold text-slate-800">{u.role}</div>
                      )}
                      <div className="mt-1 text-xs text-slate-500 truncate">
                        <MapPin size={12} className="inline-block mr-1 -mt-0.5" />
                        {u.location}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right text-slate-700 font-semibold">{formatDate(u.joinedOn)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>


      </div>

      {/* PROFILE MODAL */}
      <SmallModal
        open={!!viewing}
        accent={viewing?.type === "employee" ? "emerald" : "violet"}
        title={viewing?.name || ""}
        subtitle={viewing ? `${viewing.id} • ${viewing.type === "employee" ? "Employee" : "Admin"}` : ""}
        onClose={closeProfile}
      >
        {viewing ? (
          <div className="space-y-4">
            {/* chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={typePill(viewing.type)}>
                {viewing.type === "employee" ? (
                  <>
                    <Users size={14} /> Employee
                  </>
                ) : (
                  <>
                    <Shield size={14} /> Admin
                  </>
                )}
              </span>

              {viewing.type === "employee" ? <span className={deptBadge(viewing.department)}>{viewing.department}</span> : null}
            </div>

            {/* tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <ModalTabBtn active={modalTab === "personal"} onClick={() => setModalTab("personal")} icon={IdCard} label="Personal" />
              <ModalTabBtn active={modalTab === "experience"} onClick={() => setModalTab("experience")} icon={Briefcase} label="Experience" />
              <ModalTabBtn active={modalTab === "emergency"} onClick={() => setModalTab("emergency")} icon={AlertTriangle} label="Emergency" />
              <ModalTabBtn active={modalTab === "bank"} onClick={() => setModalTab("bank")} icon={CreditCard} label="Bank" />
              <ModalTabBtn active={modalTab === "education"} onClick={() => setModalTab("education")} icon={GraduationCap} label="Education" />
              <ModalTabBtn active={modalTab === "skills"} onClick={() => setModalTab("skills")} icon={Sparkles} label="Skills" />
            </div>

            {detailError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {detailError}
              </div>
            ) : null}

            {/* PERSONAL */}
            {modalTab === "personal" ? (
              <div className="space-y-3">
                {/* compact identity */}
                <div className="rounded-2xl border bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-11 h-11 rounded-2xl border bg-white overflow-hidden shadow-sm">
                      <div
                        className={`absolute inset-0 ${viewing.type === "employee"
                          ? "bg-gradient-to-br from-emerald-500/25 to-indigo-500/25"
                          : "bg-gradient-to-br from-violet-500/25 to-indigo-500/25"
                          }`}
                      />
                      <div className="relative h-full w-full flex items-center justify-center">
                        <span className="text-sm font-extrabold text-slate-900">{initials(viewing.name)}</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500">
                        {viewing.type === "employee" ? "Employee ID" : "Admin ID"}
                      </div>
                      <div className="text-sm font-extrabold text-slate-900 inline-flex items-center gap-2">
                        <IdCard size={16} className="text-slate-500" />
                        {viewing.id}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ✅ Email/Phone cards: NOT clickable (no mailto/tel) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-white p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Mail size={16} /> Email
                    </div>
                    <div className="mt-1 text-xs text-slate-500 truncate select-text cursor-text">{viewing.email}</div>
                  </div>

                  <div className="rounded-2xl border bg-white p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Phone size={16} /> Phone
                    </div>
                    <div className="mt-1 text-xs text-slate-500 truncate select-text cursor-text">{viewing.phone}</div>
                  </div>
                </div>

                {/* details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border bg-white p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin size={16} />
                      <div className="text-xs text-slate-500">Location</div>
                    </div>
                    <div className="mt-1 font-semibold text-slate-900 truncate">{viewing.location}</div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4">
                    <div className="flex items-center gap-2 text-slate-700">
                      <CalendarDays size={16} />
                      <div className="text-xs text-slate-500">Joined On</div>
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">{formatDate(viewing.joinedOn)}</div>
                  </div>

                  <div className="rounded-2xl border bg-white p-4 sm:col-span-2">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building2 size={16} />
                      <div className="text-xs text-slate-500">
                        {viewing.type === "employee" ? "Department / Designation" : "Role"}
                      </div>
                    </div>

                    {viewing.type === "employee" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={deptBadge(viewing.department)}>{viewing.department}</span>
                        <span className="text-sm font-semibold text-slate-900">{viewing.designation}</span>
                        <span className="text-xs text-slate-500">
                          • Gender: <span className="font-semibold text-slate-700">{viewing.gender}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm font-semibold text-slate-900">{viewing.role}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* EXPERIENCE */}
            {modalTab === "experience" ? (
              <ProfileListSection
                title="Experience"
                icon={Briefcase}
                loading={detailLoading}
                items={parseList(profileDetail?.experience)}
                emptyText="No experience records."
                render={(row, idx) => (
                  <div key={idx} className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Briefcase size={16} /> {row.organization || "-"}
                    </div>
                    <div className="mt-2 text-xs text-slate-600">Designation: {row.designation || "-"}</div>
                    <div className="text-xs text-slate-600">Duration: {row.duration || "-"}</div>
                    <div className="text-xs text-slate-600">Reason: {row.reasonForLeaving || "-"}</div>
                  </div>
                )}
              />
            ) : null}

            {/* EMERGENCY */}
            {modalTab === "emergency" ? (
              <div className="rounded-2xl border bg-white p-4">
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <AlertTriangle size={16} /> Emergency Contact
                </div>
                {detailLoading ? (
                  <div className="text-sm text-slate-500 mt-2">Loading...</div>
                ) : profileDetail?.emergency_name || profileDetail?.emergency_contact_number ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <div className="font-semibold">{profileDetail.emergency_name || "-"}</div>
                    <div className="text-xs text-slate-600">Relation: {profileDetail.emergency_relationship || "-"}</div>
                    <div className="text-xs text-slate-600">Phone: {profileDetail.emergency_contact_number || "-"}</div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 mt-2">No emergency contact added.</div>
                )}
              </div>
            ) : null}

            {/* BANK */}
            {modalTab === "bank" ? (
              <div className="rounded-2xl border bg-white p-4 space-y-2">
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <CreditCard size={16} /> Bank & Payroll Details
                </div>
                {detailLoading ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <FieldRow label="Account Holder" value={profileDetail?.account_holder_name} />
                    <FieldRow label="Bank Name" value={profileDetail?.bank_name} />
                    <FieldRow label="Account Number" value={profileDetail?.account_number} />
                    <FieldRow label="IFSC" value={profileDetail?.ifsc_code} />
                    <FieldRow label="Branch" value={profileDetail?.branch} />
                  </div>
                )}
              </div>
            ) : null}

            {/* EDUCATION */}
            {modalTab === "education" ? (
              <ProfileListSection
                title="Educational Qualifications"
                icon={GraduationCap}
                loading={detailLoading}
                items={parseList(profileDetail?.education)}
                emptyText="No education details."
                render={(row, idx) => (
                  <div key={idx} className="rounded-2xl border bg-white p-4">
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <GraduationCap size={16} /> {row.qualification || "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">Institution: {row.institution || "-"}</div>
                    <div className="text-xs text-slate-600">Year: {row.yearOfPassing || "-"}</div>
                    <div className="text-xs text-slate-600">Specialization: {row.specialization || "-"}</div>
                  </div>
                )}
              />
            ) : null}

            {/* SKILLS */}
            {modalTab === "skills" ? (
              <div className="rounded-2xl border bg-white p-4 space-y-3">
                <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Sparkles size={16} /> Skills & Expertise
                </div>
                {detailLoading ? (
                  <div className="text-sm text-slate-500">Loading...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <FieldRow label="Primary Skills" value={profileDetail?.primary_skills} />
                    <FieldRow label="Secondary Skills" value={profileDetail?.secondary_skills} />
                    <div className="sm:col-span-2">
                      <FieldRow label="Tools / Technologies" value={profileDetail?.tools_technologies} />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </SmallModal>
    </section>
  );
}
