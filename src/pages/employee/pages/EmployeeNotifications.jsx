// src/pages/employee/pages/EmployeeNotifications.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  CheckCheck,
  AlertTriangle,
  FileText,
  Megaphone,
  Calendar,
  Mail,
  SlidersHorizontal,
  Trash2,
  BellRing,
  Circle,
  Loader2,
} from "lucide-react";

import { supabase } from "../../../lib/supabaseClient";

/**
 * ✅ DB table used:
 * public.employee_notifications
 * columns: id, user_id, title, message, category, type, priority, route, unread, created_at
 *
 * ✅ This file:
 * - No localStorage
 * - No fake seed data
 * - Fetch real notifications for logged-in user
 * - Mark all read (DB)
 * - Clear read (DB)
 * - Delete one (DB)
 * - Open => mark read (DB) + navigate
 */

/* ---------------- Small local Badge (no import errors) ---------------- */
function MiniBadge({ tone = "neutral", children }) {
  const cls =
    tone === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : tone === "info"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${cls}`}>
      {children}
    </span>
  );
}

/* ---------------- HELPERS ---------------- */
const fmtTime = (iso) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const dayBucket = (iso) => {
  const d = new Date(iso);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffDays = Math.round((startOfToday - startOfThatDay) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 days";
  return "Earlier";
};

export default function EmployeeNotifications() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);
  const [list, setList] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState("all"); // all | alerts | approvals | announcements
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [sort, setSort] = useState("new"); // new | old
  const [typeFilter, setTypeFilter] = useState("all"); // all | warning | action | announcement | info
  const [priorityFilter, setPriorityFilter] = useState("all"); // all | HIGH PRIORITY | ACTION REQUIRED | ANNOUNCEMENT
  const [showFilters, setShowFilters] = useState(false);

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mapRow = (n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    category: n.category || "alerts",
    type: n.type || "info",
    priority: n.priority || "",
    route: n.route || "/employee-dashboard/dashboard",
    unread: n.unread ?? true,
    createdAt: n.created_at,
  });

  const fetchNotifications = async (uid) => {
    const { data, error } = await supabase
      .from("employee_notifications")
      .select("id,title,message,category,type,priority,route,unread,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapRow);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg("");

      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!user?.id) {
          setUserId(null);
          setList([]);
          setErrorMsg("Not logged in. Please sign in again.");
          setLoading(false);
          return;
        }

        setUserId(user.id);

        const rows = await fetchNotifications(user.id);
        setList(rows);
      } catch (e) {
        console.error("Notifications fetch failed:", e);
        setErrorMsg(e?.message || "Failed to load notifications");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = async () => {
    if (!userId) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const rows = await fetchNotifications(userId);
      setList(rows);
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to refresh notifications");
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const base = { all: 0, alerts: 0, approvals: 0, announcements: 0 };
    for (const n of list) {
      base.all += n.unread ? 1 : 0;
      if (n.unread) base[n.category] = (base[n.category] ?? 0) + 1;
    }
    return base;
  }, [list]);

  const markAllRead = async () => {
    if (!userId) return;
    setActionBusy(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("employee_notifications")
        .update({ unread: false })
        .eq("user_id", userId)
        .eq("unread", true);

      if (error) throw error;

      setList((prev) => prev.map((n) => ({ ...n, unread: false })));
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to mark all as read");
    } finally {
      setActionBusy(false);
    }
  };

  const clearRead = async () => {
    if (!userId) return;
    setActionBusy(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("employee_notifications")
        .delete()
        .eq("user_id", userId)
        .eq("unread", false);

      if (error) throw error;

      setList((prev) => prev.filter((n) => n.unread));
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to clear read notifications");
    } finally {
      setActionBusy(false);
    }
  };

  const deleteOne = async (id) => {
    if (!userId) return;
    setActionBusy(true);
    setErrorMsg("");
    try {
      const { error } = await supabase
        .from("employee_notifications")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      setList((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to delete notification");
    } finally {
      setActionBusy(false);
    }
  };

  const openNotification = async (item) => {
    if (!userId) return;
    setErrorMsg("");

    try {
      if (item.unread) {
        const { error } = await supabase
          .from("employee_notifications")
          .update({ unread: false })
          .eq("id", item.id)
          .eq("user_id", userId);

        if (error) throw error;

        setList((prev) => prev.map((n) => (n.id === item.id ? { ...n, unread: false } : n)));
      }

      navigate(item.route || "/employee-dashboard/dashboard");
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || "Failed to open notification");
      navigate(item.route || "/employee-dashboard/dashboard");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = [...list];

    if (activeTab !== "all") rows = rows.filter((n) => n.category === activeTab);
    if (unreadOnly) rows = rows.filter((n) => n.unread);

    if (typeFilter !== "all") rows = rows.filter((n) => (n.type || "info") === typeFilter);
    if (priorityFilter !== "all") rows = rows.filter((n) => (n.priority || "") === priorityFilter);

    if (q) {
      rows = rows.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          (n.message || "").toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return sort === "new" ? tb - ta : ta - tb;
    });

    return rows;
  }, [list, activeTab, unreadOnly, search, sort, typeFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const n of filtered) {
      const key = dayBucket(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    }

    const order = ["Today", "Yesterday", "Last 7 days", "Earlier"];
    return order
      .filter((k) => map.has(k))
      .map((k) => ({ label: k, items: map.get(k) }));
  }, [filtered]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT SIDE */}
      <div className="flex-1 space-y-5">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>

              <MiniBadge tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <BellRing size={14} /> {counts.all} unread
                </span>
              </MiniBadge>

              <button
                onClick={refresh}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50"
                disabled={loading || actionBusy}
                title="Refresh"
              >
                {loading ? <Loader2 className="animate-spin" size={14} /> : "Refresh"}
              </button>
            </div>

            <p className="text-sm text-slate-500">Employee alerts, approvals & announcements</p>

            {errorMsg && (
              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={markAllRead}
              disabled={actionBusy || loading || !userId}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <CheckCheck size={16} />
              Mark all read
            </button>

            <button
              onClick={clearRead}
              disabled={actionBusy || loading || !userId}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
              title="Remove all read notifications"
            >
              <Trash2 size={16} />
              Clear read
            </button>
          </div>
        </div>

        {/* SEARCH + FILTER */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              className="w-full text-sm outline-none"
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`ml-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-slate-50 ${
                showFilters ? "border-blue-300" : "border-slate-200"
              }`}
            >
              <SlidersHorizontal size={16} />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="rounded-2xl border bg-white p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="text-sm">
                  <div className="text-xs text-slate-500 mb-1">Unread</div>
                  <button
                    onClick={() => setUnreadOnly((v) => !v)}
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-left hover:bg-slate-50 ${
                      unreadOnly ? "border-blue-300" : "border-slate-200"
                    }`}
                  >
                    {unreadOnly ? "Only unread" : "All"}
                  </button>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-500 mb-1">Sort</div>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="new">Newest first</option>
                    <option value="old">Oldest first</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-500 mb-1">Type</div>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="warning">Warning</option>
                    <option value="action">Action</option>
                    <option value="announcement">Announcement</option>
                    <option value="info">Info</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="text-xs text-slate-500 mb-1">Priority</div>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="HIGH PRIORITY">HIGH PRIORITY</option>
                    <option value="ACTION REQUIRED">ACTION REQUIRED</option>
                    <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* LIST */}
        <div className="space-y-5">
          {loading && (
            <div className="rounded-3xl border bg-white p-10 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl border bg-slate-50 grid place-items-center">
                <Loader2 size={20} className="animate-spin text-slate-600" />
              </div>
              <p className="text-sm text-slate-600 font-medium">Loading notifications…</p>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="rounded-3xl border bg-white p-10 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl border bg-slate-50 grid place-items-center">
                <Circle size={20} className="text-slate-500" />
              </div>
              <p className="text-sm text-slate-600 font-medium">No notifications</p>
              <p className="text-xs text-slate-500 mt-1">Try changing filters or search keywords.</p>
            </div>
          )}

          {!loading &&
            grouped.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {group.label}
                  </p>
                  <p className="text-xs text-slate-400">
                    {group.items.length} item{group.items.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="space-y-3">
                  {group.items.map((n) => (
                    <NotificationCard
                      key={n.id}
                      data={n}
                      onOpen={() => openNotification(n)}
                      onDelete={() => deleteOne(n.id)}
                      disabled={actionBusy}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="lg:w-72 space-y-3">
        <div className="rounded-3xl border bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Categories</p>
          <p className="text-xs text-slate-500 mt-1">Filter notifications by type</p>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <Category
              icon={AlertTriangle}
              label="All"
              count={counts.all}
              active={activeTab === "all"}
              onClick={() => setActiveTab("all")}
            />
            <Category
              icon={Calendar}
              label="Alerts"
              count={counts.alerts}
              active={activeTab === "alerts"}
              onClick={() => setActiveTab("alerts")}
            />
            <Category
              icon={FileText}
              label="Approvals"
              count={counts.approvals}
              active={activeTab === "approvals"}
              onClick={() => setActiveTab("approvals")}
            />
            <Category
              icon={Megaphone}
              label="Announcements"
              count={counts.announcements}
              active={activeTab === "announcements"}
              onClick={() => setActiveTab("announcements")}
            />
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Quick tips</p>
          <ul className="mt-2 text-xs text-slate-600 space-y-1">
            <li>• Click a notification to open the related page.</li>
            <li>• Use “Clear read” to keep the list clean.</li>
            <li>• Refresh to fetch latest DB updates.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- COMPONENTS ---------------- */

function Category({ icon: Icon, label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm border transition ${
        active
          ? "bg-blue-50 border-blue-200 text-blue-800 font-semibold"
          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className="h-9 w-9 rounded-2xl border bg-white grid place-items-center">
          <Icon size={18} className={active ? "text-blue-700" : "text-slate-600"} />
        </span>
        {label}
      </span>

      <span className="rounded-full bg-blue-600 text-white text-xs px-2 py-0.5">{count}</span>
    </button>
  );
}

function NotificationCard({ data, onOpen, onDelete, disabled }) {
  const iconMap = {
    warning: AlertTriangle,
    action: FileText,
    announcement: Megaphone,
    info: Calendar,
  };
  const Icon = iconMap[data.type] || Mail;

  const accent =
    data.type === "warning"
      ? "border-l-amber-400"
      : data.type === "action"
      ? "border-l-blue-500"
      : data.type === "announcement"
      ? "border-l-violet-500"
      : "border-l-emerald-400";

  const timeText = data.createdAt ? fmtTime(data.createdAt) : "";

  return (
    <div
      className={`rounded-3xl border bg-white p-5 flex gap-4 transition hover:shadow-sm ${
        data.unread ? `border-l-4 ${accent}` : ""
      }`}
    >
      <div className="rounded-2xl bg-slate-50 border p-3 h-fit">
        <Icon size={20} className="text-slate-700" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900 truncate">{data.title}</h3>

          {data.priority && (
            <MiniBadge tone={data.priority === "HIGH PRIORITY" ? "warning" : "info"}>
              {data.priority}
            </MiniBadge>
          )}

          {data.unread && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              Unread
            </span>
          )}
        </div>

        <p className="text-sm text-slate-600 mt-1 line-clamp-2">{data.message}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">{timeText}</p>

          <div className="flex items-center gap-2">
            <button
              onClick={onDelete}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs hover:bg-slate-50 disabled:opacity-60"
              title="Delete"
            >
              <Trash2 size={14} />
              Delete
            </button>

            <button
              onClick={onOpen}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-60"
              title="Open"
            >
              Open
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
