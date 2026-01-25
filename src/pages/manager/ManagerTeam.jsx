
import { MapPin, ShieldCheck, Users } from "lucide-react";
import { teamMembers } from "./managerData";

export default function ManagerTeam() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-5 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Team Members</h3>
        </div>
        <p className="text-sm text-slate-600">
          Live view of your squad with leave status. Approval actions stay in the approvals page; here you get a
          quick roster with locations.
        </p>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teamMembers.map((member) => (
          <div key={member.id} className="rounded-2xl border p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">{member.name}</p>
                <p className="text-xs text-slate-500">{member.role}</p>
                <p className="text-[11px] text-slate-500 mt-1">ID: {member.id}</p>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                  member.status === "On Leave"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {member.status}
              </span>
            </div>

            {member.status === "On Leave" && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <div className="font-semibold">{member.leaveType}</div>
                <div>{member.leaveDates}</div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <MapPin size={14} />
              {member.location}
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
              <ShieldCheck size={14} /> Payroll / payslip: view only
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
