// src/pages/admin/AdminNotifications.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Check,
  Trash2,
  ShieldCheck,
  Clock3,
  MailOpen,
  RefreshCw,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient"; // ✅ adjust path if different

/* ===================== CONFIG ===================== */
const TABLE = "hrmss_notifications";

const ALLOWED_SOURCES = [
  "LeaveManagement",
];

const SOURCE_ROUTE = {
  LeaveManagement: "/dashboard/leave",
};

// ✅ User-specific localStorage keys for approver employee
const AUTH_KEY = "HRMSS_AUTH_SESSION";
const DISMISSED_KEY = "hrmss.notifications.dismissed.approver";
const READ_KEY = "hrmss.notifications.read.approver";

function readAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getDismissedIds() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDismissedIds(ids) {
  const current = getDismissedIds();
  const updated = [...new Set([...current, ...ids])];
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(updated));
}

function getReadIds() {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addReadIds(ids) {
  const current = getReadIds();
  const updated = [...new Set([...current, ...ids])];
  localStorage.setItem(READ_KEY, JSON.stringify(updated));
}

const tone = {
  success: {
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: "text-emerald-600",
    border: "border-emerald-100",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50/60",
    cardBg: "bg-emerald-50/30",
  },
  warning: {
    pill: "bg-rose-50 text-rose-800 ring-rose-200",
    icon: "text-rose-600",
    border: "border-rose-100",
    dot: "bg-rose-500",
    bg: "bg-rose-50/60",
    cardBg: "bg-rose-50/30",
  },
  info: {
    pill: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: "text-blue-600",
    border: "border-blue-100",
    dot: "bg-blue-500",
    bg: "bg-blue-50/60",
    cardBg: "bg-blue-50/30",
  },
};

const typeIcon = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const typeLabel = (key) => {
  if (key === "success") return "APPROVED";
  if (key === "warning") return "REJECTED";
  return String(key).toUpperCase();
};

/* ===================== HELPERS ===================== */
function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function Chip({ active, children, onClick, activeClass }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-3 py-1.5 rounded-full border transition",
        active
          ? activeClass || "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
      <div className="mx-auto h-12 w-12 rounded-2xl border bg-slate-50 grid place-items-center">
        <Bell className="text-slate-700" size={20} />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">No notifications</p>
      <p className="mt-1 text-xs text-slate-500">Try changing filters or search.</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, active, onClick, colorTheme }) {
  // Define themes
  const themes = {
    blue: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100",
    rose: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100",
  };
  const themeClass = colorTheme ? themes[colorTheme] : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-3xl border p-4 shadow-sm transition",
        themeClass
          ? themeClass
          : active
            ? "bg-white/15 border-white/25 ring-2 ring-white/20 text-white"
            : "bg-white/10 border-white/15 hover:bg-white/15 text-white"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-11 w-11 rounded-2xl grid place-items-center border",
            themeClass
              ? "bg-white/60 border-black/5"
              : active
                ? "bg-white/10 border-white/20"
                : "bg-white/10 border-white/15"
          )}
        >
          <Icon size={18} className={themeClass ? "text-current" : "text-white"} />
        </div>
        <div className="min-w-0">
          <p className={cn("text-xs", themeClass ? "text-current opacity-80" : "text-white/70")}>{label}</p>
          <p className={cn("text-lg font-bold leading-tight", themeClass ? "text-current" : "text-white")}>{value}</p>
        </div>
      </div>
    </button>
  );
}

function NotificationRow({ n, selected, onToggleSelect, onMarkRead, onDelete, onGoToSource }) {
  const Icon = typeIcon[n.type] ?? Info;
  const t = tone[n.type] ?? tone.info;

  return (
    <div
      className={cn(
        "group rounded-3xl border p-4 shadow-sm transition",
        selected ? "ring-2 ring-slate-900/10" : "hover:shadow-md",
        n.unread ? "border-slate-200" : "border-slate-100",
        t.cardBg || "bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggleSelect}
          className={cn(
            "mt-1 h-5 w-5 rounded-md border grid place-items-center",
            selected ? "bg-slate-900 border-slate-900" : "bg-white"
          )}
          title="Select"
        >
          {selected ? <Check size={14} className="text-white" /> : null}
        </button>

        <div className={cn("mt-1 h-10 w-10 rounded-2xl border grid place-items-center", t.bg, t.border)}>
          <Icon size={18} className={t.icon} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-[11px] font-semibold rounded-full px-3 py-1 ring-1", t.pill)}>
                  {typeLabel(n.type)}
                </span>

                <span className="text-[11px] text-slate-500 rounded-full border px-2.5 py-1">
                  {n.source}
                </span>

                {n.unread ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                    <span className={cn("h-2 w-2 rounded-full", t.dot)} />
                    Unread
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500">Read</span>
                )}
              </div>

              <p className="mt-2 text-sm font-bold text-slate-900">{n.title}</p>
              {n.detail ? <p className="mt-1 text-sm text-slate-600">{n.detail}</p> : null}

              <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={14} />
                Admin Notifications
                <span className="mx-1 text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={12} />
                  {n.timeLabel || n.created_at}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={onGoToSource}
                  className="text-[11px] font-semibold rounded-full border px-3 py-1 hover:bg-slate-50"
                  title={`Go to ${n.source}`}
                >
                  Go to {n.source}
                </button>

                {n.unread ? (
                  <button
                    onClick={onMarkRead}
                    className="text-[11px] font-semibold rounded-full border px-3 py-1 hover:bg-slate-50 inline-flex items-center gap-1"
                    title="Mark as read"
                  >
                    <MailOpen size={12} />
                    Mark read
                  </button>
                ) : null}

                <button
                  onClick={onDelete}
                  className="text-[11px] font-semibold rounded-full border px-3 py-1 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                  title="Delete"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== PAGE ===================== */
export default function AdminNotifications() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const [q, setQ] = useState("");
  const [type, setType] = useState("All");
  const [source, setSource] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState(() => new Set());

  // ✅ fetch notifications (with user-specific filtering by target_email)
  const fetchNotifications = async () => {
    setLoading(true);

    // Get current user's email and ID from auth session
    const authSession = readAuthSession();
    const currentUserEmail = String(
      authSession?.email ||
      authSession?.official_email ||
      authSession?.identifier ||
      ""
    ).trim().toLowerCase();
    const currentUserId = String(
      authSession?.employee_id ||
      authSession?.admin_id ||
      authSession?.id ||
      ""
    ).trim();

    // Fetch notifications targeted to this specific approver
    let query = supabase
      .from(TABLE)
      .select("id,title,detail,type,source,route,unread,created_at")
      .in("source", ALLOWED_SOURCES)
      .in("audience", ["admin", "all"])
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    // Debug logging
    console.log("[ApproverEmployeeNotifications] Query result:", { data, error, currentUserId });

    if (error) {
      console.error("Notifications fetch error:", error);
      setItems([]);
    } else {
      // Note: target_email filtering removed - column not in database schema
      const dismissedIds = getDismissedIds();
      const readIds = getReadIds();

      const filteredData = (data || [])
        .filter(n => !dismissedIds.includes(n.id))
        .filter(n => {
          const title = String(n.title || "").toLowerCase();
          const detail = String(n.detail || "").toLowerCase();

          // ✅ Show admin's own leave approval notifications (marked with [ADMIN-SELF])
          if (detail.includes("[admin-self]")) {
            return true;
          }

          // Skip notifications related to HR leave requests
          if (title.includes("hr") || detail.includes("hr sent") || detail.includes("hr admin")) {
            return false;
          }

          // Skip other employee leave approval/rejection notifications
          if (detail.includes("your") && (detail.includes("request was approved") || detail.includes("request was rejected") || detail.includes("request was updated"))) {
            return false;
          }

          return true;
        })
        .map(n => ({
          ...n,
          // Strip [ADMIN-SELF] marker from detail for display
          detail: String(n.detail || "").replace(/\[ADMIN-SELF\]\s*/gi, ""),
          // Override unread status with user-specific read state
          unread: readIds.includes(n.id) ? false : n.unread,
        }));

      setItems(filteredData);
    }

    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return items
      .filter((n) => ALLOWED_SOURCES.includes(n.source))
      .filter((n) => {
        const typeOk = type === "All" ? true : n.type === type;
        const sourceOk = source === "All" ? true : n.source === source;
        const statusOk =
          status === "All"
            ? true
            : status === "Unread"
              ? n.unread === true
              : status === "Read"
                ? n.unread === false
                : status === "Team"
                  ? n.type === "info"
                  : true;

        const text = `${n.title || ""} ${n.detail || ""} ${n.source || ""} ${n.created_at || ""}`.toLowerCase();
        const qOk = !query ? true : text.includes(query);

        return typeOk && sourceOk && statusOk && qOk;
      });
  }, [items, q, type, source, status]);

  // counts should reflect the FULL list, not the filtered list
  const counts = useMemo(() => {
    const list = items;
    const total = list.length;
    const unread = list.filter((x) => x.unread).length;
    const read = list.filter((x) => !x.unread).length;
    const success = list.filter((x) => x.type === "success").length;
    const warning = list.filter((x) => x.type === "warning").length;
    const info = list.filter((x) => x.type === "info").length;
    return { total, unread, read, success, warning, info };
  }, [items]);

  const selectedCount = selected.size;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // ✅ mark read (user-specific, stored in localStorage)
  const markRead = async (ids) => {
    if (!ids?.length) return;

    // Store read state in localStorage for this user
    addReadIds(ids);

    setItems((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, unread: false } : x)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  // ✅ dismiss notification (user-specific, stored in localStorage - doesn't delete from DB)
  const remove = async (ids) => {
    if (!ids?.length) return;

    // Store dismissed IDs in localStorage for this user only
    addDismissedIds(ids);

    // Remove from local state
    setItems((prev) => prev.filter((x) => !ids.includes(x.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const goToSource = (n) => {
    const route = n.route || SOURCE_ROUTE[n.source] || "/dashboard";
    navigate(route, { state: { fromNotification: n, notifId: n.id } });
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl border bg-[#464975] text-white p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -top-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>

            <h1 className="text-2xl font-bold mt-1">Notifications</h1>
            <p className="text-sm text-white/85 mt-1">
              Shows only: LeaveManagement.
            </p>
          </div>

          <button
            onClick={fetchNotifications}
            className="self-start lg:self-end inline-flex items-center gap-2 text-xs font-semibold rounded-full border border-white/25 bg-white/10 px-4 py-2 hover:bg-white/15"
            title="Refresh"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Bell} label="Total" value={counts.total} active={status === "All"} onClick={() => setStatus("All")} colorTheme="blue" />
          <StatCard
            icon={AlertTriangle}
            label="Unread"
            value={counts.unread}
            active={status === "Unread"}
            onClick={() => setStatus("Unread")}
            colorTheme="rose"
          />
          <StatCard icon={ShieldCheck} label="Read" value={counts.read} active={status === "Read"} onClick={() => setStatus("Read")} colorTheme="emerald" />
          <StatCard icon={Users} label="Team" value={counts.info} active={status === "Team"} onClick={() => setStatus("Team")} colorTheme="indigo" />
        </div>
      </div>

      {/* CONTROLS + LIST */}
      <div className="space-y-4">
        <div className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search notifications (title, detail, source, time...)"
                  className="w-full rounded-2xl border bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                />
              </div>


            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Chip active={type === "All"} onClick={() => setType("All")}>
                All ({counts.total})
              </Chip>
              <Chip active={type === "success"} onClick={() => setType("success")} activeClass="bg-emerald-600 text-white border-emerald-600">
                Approved ({counts.success})
              </Chip>
              <Chip active={type === "warning"} onClick={() => setType("warning")} activeClass="bg-rose-600 text-white border-rose-600">
                Rejected ({counts.warning})
              </Chip>
              <Chip active={type === "info"} onClick={() => setType("info")} activeClass="bg-blue-600 text-white border-blue-600">
                Info ({counts.info})
              </Chip>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip active={source === "All"} onClick={() => setSource("All")}>
              All Modules
            </Chip>
            {ALLOWED_SOURCES.map((s) => (
              <Chip key={s} active={source === s} onClick={() => setSource(s)}>
                {s}
              </Chip>
            ))}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              {selectedCount > 0 ? <span className="text-xs text-slate-500">{selectedCount} selected</span> : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={selectedCount === 0}
                onClick={() => markRead([...selected])}
                className={cn(
                  "text-xs font-semibold rounded-full border px-3 py-1.5",
                  selectedCount === 0 ? "text-slate-400 bg-slate-50 cursor-not-allowed" : "hover:bg-slate-50"
                )}
              >
                Mark read
              </button>
              <button
                disabled={selectedCount === 0}
                onClick={() => remove([...selected])}
                className={cn(
                  "text-xs font-semibold rounded-full border px-3 py-1.5 inline-flex items-center gap-2",
                  selectedCount === 0
                    ? "text-slate-400 bg-slate-50 cursor-not-allowed"
                    : "hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                )}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border bg-white p-8 text-sm text-slate-600 shadow-sm">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                selected={selected.has(n.id)}
                onToggleSelect={() => toggleSelect(n.id)}
                onMarkRead={() => markRead([n.id])}
                onDelete={() => remove([n.id])}
                onGoToSource={() => goToSource(n)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
