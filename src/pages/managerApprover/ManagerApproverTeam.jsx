import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Search,
  MapPin,
  Building2,
  X,
  IdCard,
  BriefcaseBusiness,
  CalendarDays,
  UserRound,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

const norm = (v) => String(v ?? "").trim();

function mapEmployee(row) {
  // ✅ matches YOUR table columns exactly
  return {
    key: row.employee_id,
    employeeId: row.employee_id,
    name: row.full_name,
    department: row.department,
    designation: row.role, // ✅ your table "role" = job title
    employeeType: row.employee_type,
    gender: row.gender,
    reportingManager: row.reporting_manager,
    joinDate: row.join_date,
    location: row.location,
    raw: row,
  };
}

function Modal({ open, onClose, emp }) {
  if (!open || !emp) return null;

  const Row = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3 rounded-xl border bg-white p-3">
      <Icon size={16} className="text-slate-600 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="text-sm text-slate-900 break-words">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto w-[92%] max-w-3xl rounded-2xl border bg-slate-50 shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Employee Details</p>
            <h3 className="text-xl font-bold text-slate-900 truncate">{emp.name}</h3>
            <p className="text-[11px] text-slate-600 mt-1">ID: {emp.employeeId}</p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            <span className="flex items-center gap-2">
              <X size={16} /> Close
            </span>
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Row icon={UserRound} label="Full Name" value={emp.name} />
            <Row icon={IdCard} label="Employee ID" value={emp.employeeId} />
            <Row icon={Building2} label="Department" value={emp.department} />
            <Row icon={BriefcaseBusiness} label="Job Role" value={emp.designation} />
            <Row icon={BriefcaseBusiness} label="Employee Type" value={emp.employeeType} />
            <Row icon={UserRound} label="Gender" value={emp.gender} />
            <Row icon={UserRound} label="Reporting Manager" value={emp.reportingManager} />
            <Row icon={CalendarDays} label="Join Date" value={emp.joinDate} />
            <Row icon={MapPin} label="Location" value={emp.location} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManagerTeam() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("hrmss_employees")
      .select(
        "employee_id, full_name, department, role, employee_type, gender, reporting_manager, join_date, location"
      );

    console.log("EMPLOYEES DATA:", data);
    console.log("EMPLOYEES ERROR:", error);

    if (error) {
      setErr(`${error.message} (code: ${error.code || "-"})`);
      setEmployees([]);
      setLoading(false);
      return;
    }

    setEmployees((data || []).map(mapEmployee));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = norm(q).toLowerCase();
    if (!qq) return employees;

    return employees.filter((e) =>
      [e.employeeId, e.name, e.department, e.designation, e.location]
        .map((x) => norm(x).toLowerCase())
        .join(" | ")
        .includes(qq)
    );
  }, [employees, q]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Employees</h3>
        </div>

        <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 w-full">
          <Search size={16} className="text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / id / dept / role..."
            className="w-full outline-none text-sm text-slate-800"
          />
          <button
            onClick={load}
            className="rounded-lg border px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reload
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Total loaded: <span className="font-semibold text-slate-900">{employees.length}</span>
        </div>
      </div>

      {/* Error */}
      {!loading && err && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          <div className="font-bold mb-2">Fetch failed</div>
          <div className="whitespace-pre-wrap">{err}</div>
          <div className="text-xs mt-2 text-rose-700/80">
            Most common reason: RLS policy இல்லை. SQL policy add பண்ணுங்க.
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">
          Loading employees from Supabase...
        </div>
      )}

      {/* List */}
      {!loading && !err && filtered.length === 0 && (
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">
          No employees found.
        </div>
      )}

      {!loading && !err && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((e) => (
            <button
              key={e.key}
              onClick={() => {
                setSelected(e);
                setOpen(true);
              }}
              className="text-left rounded-2xl border p-4 bg-white shadow-sm space-y-2 hover:shadow-md transition"
            >
              <p className="text-base font-semibold text-slate-900 truncate">{e.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {e.department} {e.designation ? `• ${e.designation}` : ""}
              </p>
              <p className="text-[11px] text-slate-500">ID: {e.employeeId}</p>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <MapPin size={14} />
                {e.location || "-"}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Building2 size={14} />
                {e.employeeType || "-"}
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} emp={selected} />
    </div>
  );
}
