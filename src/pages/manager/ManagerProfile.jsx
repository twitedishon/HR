
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  IdCard,
  Briefcase,
  Phone,
  Pencil,
  X,
  Camera,
  Mail,
  GraduationCap,
  Building2,
  HeartPulse,
  Home,
} from "lucide-react";
import DocumentManager from "../../components/DocumentManager.jsx";
import { getManagerSession } from "./managerData";


const seedManagerProfile = {
  name: "Priya Menon",
  id: "MGR-01",
  avatar: "https://i.pravatar.cc/150?img=32",

  personal: {
    dob: "1990-04-18",
    gender: "Female",
    maritalStatus: "Married",
    bloodGroup: "A+",
    personalEmail: "priya.menon@personalmail.com",
    officialEmail: "priya.menon@hrms.example.com",
    email: "priya.menon@hrms.example.com",
    mobileNumber: "+91 90000 14001",
    alternateContactNumber: "+91 90000 14002",
    currentAddress: "Bangalore, IN",
    permanentAddress: "Kochi, IN",
    address: "Bangalore, IN",
    phone: "+91 90000 14001",
  },

  job: {
    employeeId: "MGR-01",
    title: "Manager",
    department: "Product Team",
    employeeType: "Full-time",
    manager: "Admin Head",
    joiningDate: "12 Mar 2019",
    workMode: "Hybrid",
    location: "Bangalore, IN",
  },

  education: [
    {
      qualification: "MBA",
      institution: "IIM Bangalore",
      yearOfPassing: "2014",
      specialization: "Operations",
    },
  ],

  experience: [
    {
      organization: "Delta Systems",
      designation: "Team Lead",
      duration: "2014 - 2017",
      reasonForLeaving: "Career growth",
    },
    {
      organization: "Northwind Labs",
      designation: "Manager",
      duration: "2017 - Present",
      reasonForLeaving: "-",
    },
  ],

  skills: {
    primarySkills: "Team Leadership, Delivery Planning",
    secondarySkills: "Stakeholder Management, Hiring",
    toolsTechnologies: "Jira, Confluence, Slack",
  },

  bank: {
    accountHolderName: "Priya Menon",
    bankName: "ICICI Bank",
    accountNumber: "XXXXXX1188",
    ifscCode: "ICIC0004321",
    branch: "Bangalore",
  },

  emergencyContacts: [{ name: "Amit Menon", relation: "Spouse", phone: "+91 98888 14001" }],

  idProofs: [
    { type: "Aadhaar", number: "XXXX-XXXX-6543", status: "Verified" },
    { type: "PAN", number: "ABCDE6789K", status: "Verified" },
  ],
};

function buildProfileFromSession(session) {
  const team = session?.team ? `${session.team} Team` : seedManagerProfile.job.department;
  const title = session?.role === "approver" ? "Manager (Approver)" : "Manager";
  const name = session?.name || seedManagerProfile.name;
  const id = session?.id || seedManagerProfile.id;
  const email = session?.email || seedManagerProfile.personal.officialEmail;

  return {
    ...seedManagerProfile,
    name,
    id,
    personal: {
      ...(seedManagerProfile.personal || {}),
      officialEmail: email,
      email,
    },
    job: {
      ...(seedManagerProfile.job || {}),
      employeeId: id,
      title,
      department: team,
    },
  };
}

export default function ManagerProfile() {
  const navigate = useNavigate();
  const session = getManagerSession();
  const [profile, setProfile] = useState(() => buildProfileFromSession(session));

  const [addEmergency, setAddEmergency] = useState(false);
  const [editEmergency, setEditEmergency] = useState(null);
  const [addId, setAddId] = useState(false);
  const [editId, setEditId] = useState(null);

  const { name, id, personal, job, emergencyContacts, idProofs, avatar } = profile;
  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const skills = profile.skills || {};
  const bank = profile.bank || {};

  const changeAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfile({ ...profile, avatar: URL.createObjectURL(file) });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Manager Workspace</p>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500">Manage your manager profile information</p>
        </div>

        <button

          onClick={() => navigate("edit")}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 transition-all active:scale-95"
        >
          <Pencil size={16} /> Edit Profile
        </button>
      </div>


      <div className="rounded-2xl border bg-white p-6 flex gap-6 items-center">
        <div className="relative">
          {avatar ? (
            <img src={avatar} className="h-28 w-28 rounded-full border object-cover" alt="Manager" />
          ) : (
            <div className="h-28 w-28 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
              <div className="text-center">
                <Camera size={18} className="mx-auto text-slate-500" />
                <p className="mt-1 text-xs font-semibold text-slate-600">Add Photo</p>
              </div>
            </div>
          )}

          <label className="absolute bottom-1 right-1 bg-white p-1 rounded-full shadow cursor-pointer">
            <Camera size={16} />
            <input hidden type="file" accept="image/*" onChange={changeAvatar} />
          </label>
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
          <p className="text-sm text-slate-500">
            {job?.title} - {job?.department}
          </p>

          <div className="flex gap-2 mt-3 flex-wrap">
            <Badge tone="neutral">
              <IdCard size={14} /> {id || "-"}
            </Badge>
            <Badge tone="info">
              <MapPin size={14} /> {job?.location || "-"}
            </Badge>
            <Badge tone="success">
              <Briefcase size={14} /> {job?.workMode || "-"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Personal Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="FULL NAME" value={name} />
              <Detail label="DOB" value={personal?.dob} />
              <Detail label="GENDER" value={personal?.gender} />
              <Detail label="MARITAL STATUS" value={personal?.maritalStatus} />
              <Detail label="BLOOD GROUP" value={personal?.bloodGroup} />
              <Detail label="PERSONAL EMAIL" value={personal?.personalEmail || personal?.email} />
              <Detail label="OFFICIAL EMAIL" value={personal?.officialEmail} />
              <Detail label="MOBILE NUMBER" value={personal?.mobileNumber || personal?.phone} />
              <Detail label="ALTERNATE NUMBER" value={personal?.alternateContactNumber} />
              <Detail label="CURRENT ADDRESS" value={personal?.currentAddress || personal?.address} full />
              <Detail label="PERMANENT ADDRESS" value={personal?.permanentAddress} full />
            </div>
          </SectionCard>

          <SectionCard title="Job Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="MANAGER ID" value={job?.employeeId} />
              <Detail label="DEPARTMENT" value={job?.department} />
              <Detail label="ROLE / DESIGNATION" value={job?.title} />
              <Detail label="EMPLOYEE TYPE" value={job?.employeeType} />
              <Detail label="REPORTING MANAGER" value={job?.manager} />
              <Detail label="DATE OF JOINING" value={job?.joiningDate} />
              <Detail label="WORK MODE" value={job?.workMode} />
              <Detail label="WORK LOCATION" value={job?.location} />
            </div>
          </SectionCard>

          <SectionCard title="Educational Qualifications">
            <div className="pt-4 space-y-3">
              {education.length ? (
                education.map((e, i) => (
                  <div key={i} className="rounded-xl border bg-white p-4">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                      <GraduationCap size={16} className="text-slate-600" />
                      Qualification #{i + 1}
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                      <Detail label="QUALIFICATION" value={e.qualification} />
                      <Detail label="INSTITUTION / UNIVERSITY" value={e.institution} />
                      <Detail label="YEAR OF PASSING" value={e.yearOfPassing} />
                      <Detail label="SPECIALIZATION" value={e.specialization} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyHint icon={GraduationCap} text="No education details added yet." />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Professional Experience">
            <div className="pt-4 space-y-3">
              {experience.length ? (
                experience.map((ex, i) => (
                  <div key={i} className="rounded-xl border bg-white p-4">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold">
                      <Building2 size={16} className="text-slate-600" />
                      Experience #{i + 1}
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
                      <Detail label="ORGANIZATION" value={ex.organization} />
                      <Detail label="DESIGNATION" value={ex.designation} />
                      <Detail label="DURATION" value={ex.duration} />
                      <Detail label="REASON FOR LEAVING" value={ex.reasonForLeaving} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyHint icon={Briefcase} text="No experience details added yet." />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Skills & Expertise">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="PRIMARY SKILLS" value={skills.primarySkills} />
              <Detail label="SECONDARY SKILLS" value={skills.secondarySkills} />
              <Detail label="TOOLS / TECHNOLOGIES" value={skills.toolsTechnologies} full />
            </div>
          </SectionCard>

          <SectionCard title="Bank & Payroll Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="ACCOUNT HOLDER NAME" value={bank.accountHolderName} />
              <Detail label="BANK NAME" value={bank.bankName} />
              <Detail label="ACCOUNT NUMBER" value={bank.accountNumber} />
              <Detail label="IFSC CODE" value={bank.ifscCode} />
              <Detail label="BRANCH" value={bank.branch} />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Emergency Contact"
            action={
              <button onClick={() => setAddEmergency(true)} className="text-blue-600 text-sm">
                + Add
              </button>
            }
          >
            {emergencyContacts?.length ? (
              emergencyContacts.map((c, i) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.relation}</p>
                  <p className="text-sm flex gap-1 items-center mt-1">
                    <Phone size={14} /> {c.phone}
                  </p>
                  <button onClick={() => setEditEmergency(i)} className="text-xs text-blue-600 mt-2">
                    Edit
                  </button>
                </div>
              ))
            ) : (
              <EmptyHint icon={HeartPulse} text="No emergency contacts added yet." />
            )}
          </SectionCard>

          <SectionCard
            title="ID Proofs"
            action={
              <button onClick={() => setAddId(true)} className="text-blue-600 text-sm">
                Upload
              </button>
            }
          >
            {idProofs?.length ? (
              idProofs.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                  <div>
                    <p className="font-medium">{d.type}</p>
                    <p className="text-xs text-slate-600">{d.number}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={d.status === "Verified" ? "success" : "warning"}>{d.status}</Badge>
                    <button onClick={() => setEditId(i)} className="block text-xs text-blue-600 mt-2">
                      Edit
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyHint icon={IdCard} text="No ID proofs uploaded yet." />
            )}
          </SectionCard>

          <SectionCard title="Quick Contact">
            <div className="space-y-3 pt-2">
              <QuickRow icon={Mail} label="Personal Email" value={personal?.personalEmail || personal?.email} />
              <QuickRow icon={Mail} label="Official Email" value={personal?.officialEmail} />
              <QuickRow icon={Phone} label="Mobile" value={personal?.mobileNumber || personal?.phone} />
              <QuickRow icon={Phone} label="Alternate" value={personal?.alternateContactNumber} />
              <QuickRow icon={Home} label="Current Address" value={personal?.currentAddress || personal?.address} />
              <QuickRow icon={MapPin} label="Work Location" value={job?.location} />
            </div>
          </SectionCard>
        </div>
      </div>

      <DocumentManager
        title="My Documents"
        subtitle="Upload and access your manager documents from your profile"
        accent="indigo"

        role="manager"
      />

      <Divider label="End of Profile" />


      {(addEmergency || editEmergency !== null) && (
        <EmergencyModal
          profile={profile}
          setProfile={setProfile}
          index={editEmergency}
          onClose={() => {
            setAddEmergency(false);
            setEditEmergency(null);
          }}
        />
      )}

      {(addId || editId !== null) && (
        <IdModal
          profile={profile}
          setProfile={setProfile}
          index={editId}
          onClose={() => {
            setAddId(false);
            setEditId(null);
          }}
        />
      )}
    </div>
  );
}

function cn(...a) {
  return a.filter(Boolean).join(" ");
}

function Badge({ tone = "neutral", children }) {
  const map = {
    neutral: "bg-slate-100 text-slate-800 border-slate-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        map[tone] || map.neutral
      )}
    >
      {children}
    </span>
  );
}

function Divider({ label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px bg-slate-200 flex-1" />
      <span className="text-xs text-slate-500">{label}</span>
      <div className="h-px bg-slate-200 flex-1" />
    </div>
  );
}

function SectionCard({ title, subtitle, action, children }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Detail({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function QuickRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 rounded-lg border bg-white p-1.5">
        <Icon size={14} className="text-slate-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{value || "-"}</p>
      </div>
    </div>
  );
}

function EmptyHint({ icon: Icon, text }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600 flex items-center gap-2">
      <Icon size={16} className="text-slate-500" />
      <span>{text}</span>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-50">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EditProfileModal({ profile, setProfile, onClose }) {
  const [f, setF] = useState(profile);

  return (
    <Modal title="Edit Profile" onClose={onClose}>
      <input
        className="w-full rounded-xl border p-2"
        placeholder="Full Name"
        value={f.name || ""}
        onChange={(e) => setF({ ...f, name: e.target.value })}
      />

      <input
        className="w-full rounded-xl border p-2"
        placeholder="DOB"
        value={f.personal?.dob || ""}
        onChange={(e) => setF({ ...f, personal: { ...(f.personal || {}), dob: e.target.value } })}
      />

      <input
        className="w-full rounded-xl border p-2"
        placeholder="Official Email"
        value={f.personal?.officialEmail || f.personal?.email || ""}
        onChange={(e) =>
          setF({
            ...f,
            personal: { ...(f.personal || {}), officialEmail: e.target.value, email: e.target.value },
          })
        }
      />

      <input
        className="w-full rounded-xl border p-2"
        placeholder="Mobile Number"
        value={f.personal?.mobileNumber || f.personal?.phone || ""}
        onChange={(e) =>
          setF({
            ...f,
            personal: { ...(f.personal || {}), mobileNumber: e.target.value, phone: e.target.value },
          })
        }
      />

      <input
        className="w-full rounded-xl border p-2"
        placeholder="Current Address"
        value={f.personal?.currentAddress || f.personal?.address || ""}
        onChange={(e) =>
          setF({
            ...f,
            personal: { ...(f.personal || {}), currentAddress: e.target.value, address: e.target.value },
          })
        }
      />

      <button
        className="rounded-xl bg-indigo-600 px-4 py-2 text-white w-full"
        onClick={() => {
          setProfile(f);
          onClose();
        }}
      >
        Save
      </button>
    </Modal>
  );
}

function EmergencyModal({ profile, setProfile, index, onClose }) {
  const data = index !== null ? profile.emergencyContacts[index] : { name: "", relation: "", phone: "" };
  const [f, setF] = useState(data);

  return (
    <Modal title="Emergency Contact" onClose={onClose}>
      {["name", "relation", "phone"].map((k) => (
        <input
          key={k}
          className="w-full rounded-xl border p-2"
          placeholder={k}
          value={f[k] || ""}
          onChange={(e) => setF({ ...f, [k]: e.target.value })}
        />
      ))}

      <button
        className="rounded-xl bg-indigo-600 px-4 py-2 text-white w-full"
        onClick={() => {
          const list = [...(profile.emergencyContacts || [])];
          index !== null ? (list[index] = f) : list.push(f);
          setProfile({ ...profile, emergencyContacts: list });
          onClose();
        }}
      >
        Save
      </button>
    </Modal>
  );
}

function IdModal({ profile, setProfile, index, onClose }) {
  const data = index !== null ? profile.idProofs[index] : { type: "", number: "", status: "Pending" };
  const [f, setF] = useState(data);

  return (
    <Modal title="ID Proof" onClose={onClose}>
      <input
        className="w-full rounded-xl border p-2"
        placeholder="ID Type"
        value={f.type || ""}
        onChange={(e) => setF({ ...f, type: e.target.value })}
      />
      <input
        className="w-full rounded-xl border p-2"
        placeholder="ID Number"
        value={f.number || ""}
        onChange={(e) => setF({ ...f, number: e.target.value })}
      />

      <button
        className="rounded-xl bg-indigo-600 px-4 py-2 text-white w-full"
        onClick={() => {
          const list = [...(profile.idProofs || [])];
          index !== null ? (list[index] = f) : list.push(f);
          setProfile({ ...profile, idProofs: list });
          onClose();
        }}
      >
        Save
      </button>
    </Modal>
  );
}
