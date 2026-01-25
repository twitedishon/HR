import { useState } from "react";
import {
  MapPin,
  IdCard,
  Briefcase,
  Phone,
  X,
  Mail,
  GraduationCap,
  Building2,
  HeartPulse,
  User,
  CalendarDays,
  Home,
  Plus,
  Trash2,
  CreditCard,
} from "lucide-react";

/* ===================== HELPER COMPONENTS ===================== */

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex justify-between items-center gap-3 shrink-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg border p-1 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">
            {children}
        </div>

        {footer && (
            <div className="p-5 border-t bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            {footer}
            </div>
        )}
      </div>
    </div>
  );
}

function subModalFooter(onClose, onSave) {
    return (
        <>
          <button className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
            onClick={onSave}
          >
            Save
          </button>
        </>
      );
}

function Field({ label, icon: Icon, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-purple-100">
        {Icon ? <Icon size={16} className="text-slate-400" /> : null}
        <input
          type={type}
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 bg-transparent"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function FieldSelect({ label, icon: Icon, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-purple-100">
        {Icon ? <Icon size={16} className="text-slate-400" /> : null}
        <select
          className="w-full bg-transparent outline-none text-sm text-slate-900"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function FieldTextarea({ label, icon: Icon, value, onChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-start gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-purple-100">
        {Icon ? <Icon size={16} className="mt-0.5 text-slate-400" /> : null}
        <textarea
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 min-h-[90px] resize-none bg-transparent"
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function BlockTitle({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {Icon ? (
          <div className="mt-0.5 rounded-xl border bg-white p-2 shadow-sm">
            <Icon size={16} className="text-slate-700" />
          </div>
        ) : null}
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ===================== MAIN EDIT MODAL ===================== */

export default function EditProfileModal({ profile, onSave, onClose }) {
  const [f, setF] = useState(profile);

  // Computed / Fallback objects
  const personal = f.personal || {};
  const job = f.job || {};
  const skills = f.skills || {};
  const bank = f.bank || {};

  const education = Array.isArray(f.education) ? f.education : [];
  const experience = Array.isArray(f.experience) ? f.experience : [];
  const emergencyContacts = Array.isArray(f.emergencyContacts) ? f.emergencyContacts : [];

  // Setters
  const setPersonal = (k, v) => setF((p) => ({ ...p, personal: { ...(p.personal || {}), [k]: v } }));
  const setJob = (k, v) => setF((p) => ({ ...p, job: { ...(p.job || {}), [k]: v } }));
  const setSkills = (k, v) => setF((p) => ({ ...p, skills: { ...(p.skills || {}), [k]: v } }));
  const setBank = (k, v) => setF((p) => ({ ...p, bank: { ...(p.bank || {}), [k]: v } }));

  // Array updaters
  const updateEducation = (idx, k, v) => {
    setF((p) => {
      const next = [...(Array.isArray(p.education) ? p.education : [])];
      next[idx] = { ...(next[idx] || {}), [k]: v };
      return { ...p, education: next };
    });
  };
  const addEducation = () => {
    setF((p) => ({
      ...p,
      education: [
        ...(Array.isArray(p.education) ? p.education : []),
        { qualification: "", institution: "", yearOfPassing: "", specialization: "" },
      ],
    }));
  };
  const removeEducation = (idx) => {
    setF((p) => {
      const next = (Array.isArray(p.education) ? p.education : []).filter((_, i) => i !== idx);
      return { ...p, education: next.length ? next : p.education };
    });
  };

  const updateExperience = (idx, k, v) => {
    setF((p) => {
      const next = [...(Array.isArray(p.experience) ? p.experience : [])];
      next[idx] = { ...(next[idx] || {}), [k]: v };
      return { ...p, experience: next };
    });
  };
  const addExperience = () => {
    setF((p) => ({
      ...p,
      experience: [
        ...(Array.isArray(p.experience) ? p.experience : []),
        { organization: "", designation: "", duration: "", reasonForLeaving: "" },
      ],
    }));
  };
  const removeExperience = (idx) => {
    setF((p) => {
      const next = (Array.isArray(p.experience) ? p.experience : []).filter((_, i) => i !== idx);
      return { ...p, experience: next.length ? next : p.experience };
    });
  };

  const updateEmergency = (idx, k, v) => {
    setF((p) => {
      const next = [...(Array.isArray(p.emergencyContacts) ? p.emergencyContacts : [])];
      next[idx] = { ...(next[idx] || {}), [k]: v };
      return { ...p, emergencyContacts: next };
    });
  };
  const addEmergency = () => {
    setF((p) => ({
      ...p,
      emergencyContacts: [
        ...(Array.isArray(p.emergencyContacts) ? p.emergencyContacts : []),
        { name: "", relation: "", phone: "" },
      ],
    }));
  };
  const removeEmergency = (idx) => {
    setF((p) => {
      const next = (Array.isArray(p.emergencyContacts) ? p.emergencyContacts : []).filter(
        (_, i) => i !== idx
      );
      return { ...p, emergencyContacts: next.length ? next : p.emergencyContacts };
    });
  };

  const footer = (
    <>
      <button className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100" onClick={onClose}>
        Cancel
      </button>
      <button
        className="rounded-xl bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700"
        onClick={() => {
            // Reconstruct full object to ensure nothing is lost
            const next = {
              ...f,
              name: f.name || "",
              id: f.id || job.employeeId || "",
              personal: { ...(f.personal || {}) },
              job: { ...(f.job || {}) },
              skills: { ...(f.skills || {}) },
              bank: { ...(f.bank || {}) },
              education: Array.isArray(f.education) ? f.education : [],
              experience: Array.isArray(f.experience) ? f.experience : [],
              emergencyContacts: Array.isArray(f.emergencyContacts) ? f.emergencyContacts : [],
            };
            onSave(next);
            onClose();
        }}
      >
        Save Changes
      </button>
    </>
  );

  return (
    <Modal title="Edit HR Profile" onClose={onClose} footer={footer}>
      <div className="space-y-8">
        {/* Personal */}
        <BlockTitle icon={User} title="Personal Information" subtitle="Basic personal details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            icon={User}
            label="FULL NAME"
            value={f.name}
            onChange={(v) => setF((p) => ({ ...p, name: v }))}
            placeholder="Full name"
          />
          <Field
            icon={IdCard}
            label="EMPLOYEE ID"
            value={f.id || job.employeeId}
            onChange={(v) => {
              setF((p) => ({ ...p, id: v, job: { ...(p.job || {}), employeeId: v } }));
            }}
            placeholder="HR-001"
          />

          <Field icon={CalendarDays} label="DOB" type="date" value={personal.dob} onChange={(v) => setPersonal("dob", v)} />
          <FieldSelect
            icon={User}
            label="GENDER"
            value={personal.gender}
            onChange={(v) => setPersonal("gender", v)}
            options={["Male", "Female", "Other"]}
          />
          <FieldSelect
            icon={HeartPulse}
            label="MARITAL STATUS"
            value={personal.maritalStatus}
            onChange={(v) => setPersonal("maritalStatus", v)}
            options={["Single", "Married", "Other"]}
          />
          <FieldSelect
            icon={HeartPulse}
            label="BLOOD GROUP"
            value={personal.bloodGroup}
            onChange={(v) => setPersonal("bloodGroup", v)}
            options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
          />

          <Field icon={Mail} label="PERSONAL EMAIL" value={personal.personalEmail || personal.email} onChange={(v) => setPersonal("personalEmail", v)} />
          <Field icon={Mail} label="OFFICIAL EMAIL" value={personal.officialEmail} onChange={(v) => setPersonal("officialEmail", v)} />

          <Field icon={Phone} label="MOBILE NUMBER" value={personal.mobileNumber || personal.phone} onChange={(v) => setPersonal("mobileNumber", v)} />
          <Field icon={Phone} label="ALTERNATE NUMBER" value={personal.alternateContactNumber} onChange={(v) => setPersonal("alternateContactNumber", v)} />

          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldTextarea icon={Home} label="CURRENT ADDRESS" value={personal.currentAddress || personal.address} onChange={(v) => setPersonal("currentAddress", v)} />
            <FieldTextarea icon={Home} label="PERMANENT ADDRESS" value={personal.permanentAddress} onChange={(v) => setPersonal("permanentAddress", v)} />
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Job */}
        <BlockTitle icon={Briefcase} title="Job Information" subtitle="Work details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field icon={Briefcase} label="DESIGNATION" value={job.title} onChange={(v) => setJob("title", v)} placeholder="HR Manager" />
          <Field icon={Building2} label="DEPARTMENT" value={job.department} onChange={(v) => setJob("department", v)} placeholder="Human Resources" />
          <Field icon={User} label="REPORTING MANAGER" value={job.manager} onChange={(v) => setJob("manager", v)} placeholder="Manager name" />
          <Field icon={CalendarDays} label="DATE OF JOINING" type="date" value={job.joiningDate} onChange={(v) => setJob("joiningDate", v)} />
          <Field icon={MapPin} label="WORK LOCATION" value={job.location} onChange={(v) => setJob("location", v)} placeholder="Colombo / Chennai" />
          <Field icon={Briefcase} label="WORK MODE" value={job.workMode} onChange={(v) => setJob("workMode", v)} placeholder="Office / Hybrid / Remote" />
        </div>

        <div className="h-px bg-slate-200" />

        {/* Education */}
        <BlockTitle
          icon={GraduationCap}
          title="Education"
          subtitle="Qualifications"
          right={
            <button
              type="button"
              onClick={addEducation}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              <Plus size={14} /> Add
            </button>
          }
        />
        <div className="space-y-3">
          {education.map((row, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Qualification #{idx + 1}</p>
                <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                    <Trash2 size={14} /> Remove
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field icon={GraduationCap} label="QUALIFICATION" value={row.qualification} onChange={(v) => updateEducation(idx, "qualification", v)} />
                <Field icon={Building2} label="INSTITUTION" value={row.institution} onChange={(v) => updateEducation(idx, "institution", v)} />
                <Field icon={CalendarDays} label="YEAR OF PASSING" value={row.yearOfPassing} onChange={(v) => updateEducation(idx, "yearOfPassing", v)} />
                <Field icon={GraduationCap} label="SPECIALIZATION" value={row.specialization} onChange={(v) => updateEducation(idx, "specialization", v)} />
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Experience */}
        <BlockTitle
          icon={Building2}
          title="Experience"
          subtitle="Past work"
          right={
            <button
              type="button"
              onClick={addExperience}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              <Plus size={14} /> Add
            </button>
          }
        />
        <div className="space-y-3">
          {experience.map((row, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Experience #{idx + 1}</p>
                <button
                    type="button"
                    onClick={() => removeExperience(idx)}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                    <Trash2 size={14} /> Remove
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field icon={Building2} label="ORGANIZATION" value={row.organization} onChange={(v) => updateExperience(idx, "organization", v)} />
                <Field icon={Briefcase} label="DESIGNATION" value={row.designation} onChange={(v) => updateExperience(idx, "designation", v)} />
                <Field icon={CalendarDays} label="DURATION" value={row.duration} onChange={(v) => updateExperience(idx, "duration", v)} />
                <Field icon={Briefcase} label="REASON FOR LEAVING" value={row.reasonForLeaving} onChange={(v) => updateExperience(idx, "reasonForLeaving", v)} />
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Skills */}
        <BlockTitle icon={HeartPulse} title="Skills" subtitle="Skills & tools" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field icon={HeartPulse} label="PRIMARY SKILLS" value={skills.primarySkills} onChange={(v) => setSkills("primarySkills", v)} />
          <Field icon={HeartPulse} label="SECONDARY SKILLS" value={skills.secondarySkills} onChange={(v) => setSkills("secondarySkills", v)} />
          <div className="md:col-span-2">
            <FieldTextarea icon={HeartPulse} label="TOOLS / TECHNOLOGIES" value={skills.toolsTechnologies} onChange={(v) => setSkills("toolsTechnologies", v)} placeholder="Git, Docker, Figma..." />
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Bank */}
        <BlockTitle icon={CreditCard} title="Bank Details" subtitle="Payroll info" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field icon={User} label="ACCOUNT HOLDER NAME" value={bank.accountHolderName} onChange={(v) => setBank("accountHolderName", v)} />
          <Field icon={Building2} label="BANK NAME" value={bank.bankName} onChange={(v) => setBank("bankName", v)} />
          <Field icon={CreditCard} label="ACCOUNT NUMBER" value={bank.accountNumber} onChange={(v) => setBank("accountNumber", v)} />
          <Field icon={IdCard} label="IFSC CODE" value={bank.ifscCode} onChange={(v) => setBank("ifscCode", v)} />
          <Field icon={MapPin} label="BRANCH" value={bank.branch} onChange={(v) => setBank("branch", v)} />
        </div>

        <div className="h-px bg-slate-200" />

        {/* Emergency */}
        <BlockTitle
          icon={HeartPulse}
          title="Emergency Contacts"
          subtitle="At least one"
          right={
            <button
              type="button"
              onClick={addEmergency}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
            >
              <Plus size={14} /> Add
            </button>
          }
        />
        <div className="space-y-3">
          {emergencyContacts.map((c, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Contact #{idx + 1}</p>
                <button
                    type="button"
                    onClick={() => removeEmergency(idx)}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                    <Trash2 size={14} /> Remove
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field icon={User} label="NAME" value={c.name} onChange={(v) => updateEmergency(idx, "name", v)} />
                <Field icon={HeartPulse} label="RELATION" value={c.relation} onChange={(v) => updateEmergency(idx, "relation", v)} />
                <div className="md:col-span-2">
                    <Field icon={Phone} label="PHONE" value={c.phone} onChange={(v) => updateEmergency(idx, "phone", v)} />
                </div>
              </div>
            </div>
          ))}
          {emergencyContacts.length === 0 && (
            <div className="text-sm text-slate-500 italic p-2 border border-dashed rounded-xl text-center">No emergency contacts added.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
