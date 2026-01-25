
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { formatDDMMYYYY } from "../../lib/dateUtils";
import { 
  Search, 
  Filter, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  X,
  User as UserIcon,
  ChevronRight,
  ClipboardList,
  AlertCircle
} from "lucide-react";

/* ---------------- HELPERS ---------------- */
const safeJson = (v) => {
  try { return JSON.parse(v); } catch { return null; }
};

const getUserFromStorage = (wantedRole) => {
  if (typeof window === "undefined") return null;
  const likelyKeys = ["HRMSS_AUTH_SESSION", "hrmss.session", "hrmss.auth"];
  
  for (const k of likelyKeys) {
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;
    const parsed = safeJson(raw);
    const user = parsed?.user || parsed;
    const role = String(user?.role || user?.login_role || "").toLowerCase();
    
    if (wantedRole === "admin" && (role.includes("admin") || role.includes("head"))) {
      return {
        id: user?.employee_id || user?.id || "",
        name: user?.full_name || user?.name || "Admin Head",
        role: "admin-head"
      };
    }
  }
  return null;
};

const fmtDMY = (v) => formatDDMMYYYY(v);

const diffDays = (from, to) => {
  if (!from || !to) return 1;
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0,0,0,0);
  b.setHours(0,0,0,0);
  const days = Math.floor((b - a) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(days, 1);
};

/* ---------------- COMPONENTS ---------------- */


export default function AdminHeadLeaveControl() {
  const [viewMode, setViewMode] = useState("Employee"); // "Employee" | "Admin"
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [viewing, setViewing] = useState(null);
  const [showApply, setShowApply] = useState(false);

  // Apply Form
  const [leaveType, setLeaveType] = useState("Casual Leave");
  const [leaveMode, setLeaveMode] = useState("Full Day");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [requestedTo, setRequestedTo] = useState(["HR", "Manager"]);

  const currentAdmin = useMemo(() => getUserFromStorage("admin"), []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const table = "hrmss_leave_requests";
      let query = supabase.from(table).select("*");

      if (viewMode === "Admin") {
        if (currentAdmin?.id) {
          query = query.eq("owner_id", currentAdmin.id);
        }
      } else {
        query = query.eq("owner_role", "employee");
      }

      const { data, error } = await query.order("applied_at", { ascending: false });
      if (error) throw error;
      
      // Grouping logic for multi-recipient requests
      const groups = new Map();
      (data || []).forEach(r => {
        const key = `${r.applied_at}_${r.owner_id}_${(r.reason || "").slice(0, 30)}`;
        if (!groups.has(key)) {
          groups.set(key, { ...r, recipients: [] });
        }
        groups.get(key).recipients.push({
          id: r.request_to_id,
          role: r.request_to_role,
          name: r.request_to_name,
          status: r.status,
          rowId: r.id,
        });
      });

      setRequests(Array.from(groups.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [viewMode, currentAdmin?.id]);

  const filtered = useMemo(() => {
    return requests.filter(r => {
      const matchStatus = statusFilter === "All" || r.status === statusFilter;
      const q = search.toLowerCase();
      const matchSearch = !q || 
        r.leave_type.toLowerCase().includes(q) || 
        r.owner_name?.toLowerCase().includes(q) ||
        r.owner_id?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [requests, statusFilter, search]);

  const stats = useMemo(() => {
    return {
      Total: requests.length,
      Pending: requests.filter(r => r.status === "Pending").length,
      Approved: requests.filter(r => r.status === "Approved").length,
      Rejected: requests.filter(r => r.status === "Rejected").length,
    };
  }, [requests]);

  const handleDecision = async (recipientRowId, decision) => {
    if (!recipientRowId) return;
    try {
      const { error } = await supabase
        .from("hrmss_leave_requests")
        .update({ status: decision, decided_at: new Date().toISOString(), decision_note: `Admin Head ${decision}` })
        .eq("id", recipientRowId)
        .eq("owner_role", "employee")
        .eq("request_to_role", "admin-head");
      if (error) throw error;
      fetchRequests();
      setViewing(null);
    } catch (e) {
      alert(e?.message || "Failed to update status");
    }
  };

  const handleApplySubmit = async () => {
    if (!fromDate || (!toDate && leaveMode === "Full Day") || !reason) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      const appliedAt = new Date().toISOString();
      const payloadBase = {
        owner_id: currentAdmin.id,
        owner_name: currentAdmin.name,
        owner_role: "admin",
        leave_type: leaveType,
        mode: leaveMode,
        from_date: fromDate,
        to_date: leaveMode === "Full Day" ? toDate : fromDate,
        reason: reason,
        applied_at: appliedAt,
        status: "Pending"
      };

      const rows = [];
      if (requestedTo.includes("HR")) {
        rows.push({ ...payloadBase, request_to_role: "hr", request_to_id: "HR-001", request_to_name: "HR Admin" });
      }
      if (requestedTo.includes("Manager")) {
        const { data: managers } = await supabase.from("hrmss_approvers").select("id, name").eq("role", "manager").eq("active", true).limit(1);
        if (managers?.[0]) {
          rows.push({ ...payloadBase, request_to_role: "manager", request_to_id: managers[0].id, request_to_name: managers[0].name });
        }
      }

      const { error } = await supabase.from("hrmss_leave_requests").insert(rows);
      if (error) throw error;

      alert("Leave request applied successfully.");
      setShowApply(false);
      setReason("");
      fetchRequests();
    } catch (err) {
      alert("Error applying leave: " + err.message);
    }
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto p-4 md:p-0">
      {/* Header Section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-blue-600 shadow-lg shadow-blue-100">
            <ClipboardList size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Leave Letters</h1>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium italic">
              {viewMode === "Admin" 
                ? "Admin can apply leave and view only their own leave letters."
                : "Admin can view all employee leave letters."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            <button 
              onClick={() => { setViewMode("Employee"); setStatusFilter("All"); }}
              className={`px-5 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === "Employee" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              Employee
            </button>
            <button 
              onClick={() => { setViewMode("Admin"); setStatusFilter("All"); }}
              className={`px-5 py-1.5 rounded-lg text-xs font-black transition-all ${
                viewMode === "Admin" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              Admin Head
            </button>
          </div>

          {viewMode === "Admin" && (
            <button 
              onClick={() => setShowApply(true)}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-black text-xs transition-all shadow-md active:scale-95"
            >
              <Plus size={14} strokeWidth={3} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-3">
        <StatusCard label="Total" count={stats.Total} active={statusFilter === "All"} onClick={() => setStatusFilter("All")} color="ring-slate-400" />
        <StatusCard label="Pending" count={stats.Pending} active={statusFilter === "Pending"} onClick={() => setStatusFilter("Pending")} color="ring-amber-400" />
        <StatusCard label="Approved" count={stats.Approved} active={statusFilter === "Approved"} onClick={() => setStatusFilter("Approved")} color="ring-emerald-400" />
        <StatusCard label="Rejected" count={stats.Rejected} active={statusFilter === "Rejected"} onClick={() => setStatusFilter("Rejected")} color="ring-rose-400" />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/50 rounded-xl px-4 py-2 flex-1 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <Search size={16} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by request id / name / id / type / reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full font-bold text-slate-700 placeholder:text-slate-300"
          />
        </div>
        
        <div className="flex items-center gap-2 px-3 py-2 border border-slate-200/50 rounded-xl bg-slate-50 min-w-[140px]">
          <Filter size={14} className="text-slate-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</span>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer flex-1"
          >
            <option value="All">All</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Request</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dates</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Days</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-50 rounded-full border-t-blue-600 animate-spin"></div>
                      <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Syncing...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center text-slate-300">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <Calendar size={48} strokeWidth={1} />
                      <p className="text-sm font-black tracking-tight">No leave letters found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center shrink-0 border border-blue-100/50 shadow-sm group-hover:scale-105 transition-transform">
                          <span className="text-xs font-black text-blue-600">
                            {r.owner_name?.[0] || "E"}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-black text-slate-900 leading-tight">{r.leave_type}</p>
                          <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">Mode: {r.mode || "Full Day"}</p>
                          <div className="mt-2.5 space-y-1 border-l-2 border-slate-100 pl-3 py-0.5">
                            <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                              <span className="text-slate-400 font-black tracking-wider uppercase text-[9px]">Sent To:</span> 
                              {r.recipients?.map(rt => rt.name).join(", ") || "HR Admin"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Applied: {fmtDMY(r.applied_at)} • {new Date(r.applied_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium italic mt-0.5 line-clamp-1">"{r.reason}"</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} className="text-blue-500" />
                          <p className="text-[13px] font-black text-slate-800 tracking-tight">{fmtDMY(r.from_date)} → {fmtDMY(r.to_date)}</p>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 tabular-nums tracking-widest pl-4.5">{r.owner_id}</p>
                        <div className="pl-4.5">
                          <span className="inline-flex px-1.5 py-0.5 bg-slate-100 text-[8px] font-black text-slate-500 rounded uppercase tracking-widest border border-slate-200/50">
                            Emp: {r.owner_role || "Employee"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-slate-900 tabular-nums">{diffDays(r.from_date, r.to_date)}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Days</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={r.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setViewing(r)}
                        className="px-3.5 py-1.5 rounded-xl text-[10px] font-black border border-slate-200/60 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all active:scale-95 uppercase tracking-wider"
                      >
                        View Letter
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Viewing Modal */}
      {viewing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-white overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">Leave Request Detail</h2>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Application #{String(viewing.id).slice(0, 8)}</p>
              </div>
              <button onClick={() => setViewing(null)} className="p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-400 hover:text-slate-900">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Applied By</p>
                  <div className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-black text-[10px]">
                      {viewing.owner_name?.[0]}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{viewing.owner_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{viewing.owner_id}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center h-[46px]">
                    <Badge status={viewing.status} />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Schedule</span>
                  <div className="px-3 py-1 bg-white/20 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {viewing.mode || "Full Day"}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase opacity-60">From</p>
                    <p className="text-base font-black">{fmtDMY(viewing.from_date)}</p>
                  </div>
                  <ChevronRight size={18} className="opacity-40" />
                  <div className="space-y-0.5 text-right">
                    <p className="text-[9px] font-black uppercase opacity-60">To</p>
                    <p className="text-base font-black">{fmtDMY(viewing.to_date)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason</p>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-medium text-slate-600 leading-relaxed italic">
                  "{viewing.reason}"
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Routing</p>
                <div className="grid grid-cols-1 gap-2">
                  {viewing.recipients?.map((rt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                        <p className="text-[10px] font-black text-slate-700 uppercase">{rt.role}: {rt.name}</p>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${rt.status === 'Approved' ? 'text-emerald-500' : rt.status === 'Rejected' ? 'text-rose-500' : 'text-amber-500'}`}>
                        {rt.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {(() => {
                const pendingAdminHead = viewing.recipients?.find(
                  (rt) => rt.role === "admin-head" && rt.status === "Pending" && rt.rowId
                );
                if (!pendingAdminHead || viewing.owner_role !== "employee") return null;
                return (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision(pendingAdminHead.rowId, "Rejected")}
                      className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-black hover:bg-rose-50 transition"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(pendingAdminHead.rowId, "Approved")}
                      className="px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-600 text-white text-xs font-black hover:opacity-95 transition"
                    >
                      Approve
                    </button>
                  </div>
                );
              })()}
            </div>

            <div className="p-6 border-t border-slate-50 bg-slate-50/50">
              <button 
                onClick={() => setViewing(null)}
                className="w-full py-3 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 hover:shadow-md transition-all uppercase tracking-widest"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applying Modal - Professional Design */}
      {showApply && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="relative px-8 py-6 bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                    <Calendar size={28} className="text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight leading-none">Apply for Leave</h2>
                    <p className="text-xs font-semibold text-white/80 mt-1.5 flex items-center gap-2">
                      <UserIcon size={12} />
                      {currentAdmin?.name || "Admin Head"}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowApply(false)} 
                  className="p-2.5 rounded-xl hover:bg-white/10 transition-all text-white/80 hover:text-white"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            </div>
            
            <div className="p-8 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
              {/* Leave Type & Mode Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Leave Details</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 ml-1">
                      <ClipboardList size={14} className="text-blue-600" />
                      Leave Type
                    </label>
                    <select 
                      value={leaveType} 
                      onChange={e => setLeaveType(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all cursor-pointer"
                    >
                      <option>Casual Leave</option>
                      <option>Sick Leave</option>
                      <option>Annual Leave</option>
                      <option>Emergency Leave</option>
                      <option>Maternity Leave</option>
                      <option>Paternity Leave</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 ml-1">
                      <Clock size={14} className="text-blue-600" />
                      Leave Mode
                    </label>
                    <select 
                      value={leaveMode} 
                      onChange={e => setLeaveMode(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all cursor-pointer"
                    >
                      <option>Full Day</option>
                      <option>Half Day</option>
                      <option>Permission</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Date Range Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Date Range</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 ml-1">
                      <Calendar size={14} className="text-emerald-600" />
                      From Date
                    </label>
                    <input 
                      type="date" 
                      value={fromDate} 
                      onChange={e => setFromDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200 hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all"
                    />
                  </div>
                  
                  {leaveMode === "Full Day" ? (
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 ml-1">
                        <Calendar size={14} className="text-rose-600" />
                        To Date
                      </label>
                      <input 
                        type="date" 
                        value={toDate} 
                        onChange={e => setToDate(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-200 hover:border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-50 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-700 outline-none transition-all"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-400 ml-1">
                        <Calendar size={14} />
                        To Date
                      </label>
                      <div className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-400 flex items-center justify-center">
                        Not Applicable
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Days Count Display */}
                {fromDate && toDate && leaveMode === "Full Day" && (
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100 rounded-2xl">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                      <span className="text-xl font-black text-white">{diffDays(fromDate, toDate)}</span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-blue-900">Total Days</p>
                      <p className="text-[10px] font-semibold text-blue-600 mt-0.5">
                        {fmtDMY(fromDate)} → {fmtDMY(toDate)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reason Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Reason for Leave</h3>
                </div>
                
                <div className="space-y-2.5">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600 ml-1">
                    <AlertCircle size={14} className="text-amber-600" />
                    Please provide a brief explanation
                  </label>
                  <textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    rows={4}
                    placeholder="Enter the reason for your leave request..."
                    className="w-full bg-slate-50 border-2 border-slate-200 hover:border-amber-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-50 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-700 outline-none resize-none placeholder:text-slate-400 transition-all"
                  />
                  <p className="text-[10px] font-semibold text-slate-400 ml-1 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-slate-400"></span>
                    Minimum 10 characters recommended
                  </p>
                </div>
              </div>

              {/* Request To Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full"></div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Send Request To</h3>
                </div>
                
                <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl border-2 border-slate-200">
                  <p className="text-xs font-semibold text-slate-600 mb-4">Select one or more approvers</p>
                  <div className="grid grid-cols-2 gap-3">
                    {["HR", "Manager"].map(target => (
                      <button 
                        key={target}
                        onClick={() => setRequestedTo(prev => prev.includes(target) ? prev.filter(x => x !== target) : [...prev, target])}
                        className={`group relative flex items-center justify-center gap-2.5 py-4 rounded-xl text-sm font-bold transition-all border-2 ${
                          requestedTo.includes(target) 
                            ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg shadow-blue-200" 
                            : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:shadow-md"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                          requestedTo.includes(target) 
                            ? "bg-white/20 border-white/40" 
                            : "bg-slate-50 border-slate-300 group-hover:border-blue-400"
                        }`}>
                          {requestedTo.includes(target) && (
                            <CheckCircle2 size={14} className="text-white" strokeWidth={3} />
                          )}
                        </div>
                        {target}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 border-t-2 border-slate-100 bg-slate-50/50 flex items-center gap-4">
              <button 
                onClick={() => setShowApply(false)}
                className="flex-1 py-3.5 bg-white border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleApplySubmit}
                className="flex-[2] py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} strokeWidth={2.5} />
                Submit Leave Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- SUB-COMPONENTS ---------------- */
function StatusCard({ label, count, active, onClick, color }) {
  return (
    <button 
      onClick={onClick}
      className={`flex-1 rounded-xl border bg-white p-3 text-left transition-all hover:shadow-sm ${
        active ? `ring-2 ring-offset-1 ${color}` : "border-slate-100"
      }`}
    >
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="mt-0.5 text-xl font-black text-slate-900 tracking-tight">{count}</p>
      <p className="mt-0.5 text-[8px] text-slate-500 font-bold italic opacity-60 uppercase">View List</p>
    </button>
  );
}

function Badge({ status }) {
  const tones = {
    Approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
    Rejected: "bg-rose-50 text-rose-700 border-rose-100",
    Pending: "bg-amber-50 text-amber-700 border-amber-100",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-widest ${tones[status] || tones.Pending}`}>
      {status}
    </span>
  );
}
