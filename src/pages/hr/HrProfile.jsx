import { useEffect, useState } from "react";
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
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";
import DocumentManager from "../../components/DocumentManager.jsx";
import EditProfileModal from "./HrEditModal.jsx";
import { formatDDMMYYYY } from "../../lib/dateUtils";

/* ========================================================= */
/* ======================= HELPERS ========================= */
/* ========================================================= */

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const HR_CACHE_KEY = (userId) => `hrmss.profile.cache.hr.${userId || "unknown"}`;

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readAuth() {
  const s = safeJsonParse(localStorage.getItem(AUTH_KEY)) || {};
  const userId = String(s.user_id || s.id || s.userId || "").trim();
  const email = String(s.email || s.identifier || "").trim();
  const fullName = String(s.full_name || s.fullName || s.name || "").trim();
  return { userId, email, fullName };
}

const isDmy = (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);

const formatDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (isDmy(raw)) return raw;
  const formatted = formatDDMMYYYY(raw);
  return formatted === "-" ? raw : formatted;
};

function mapDbToProfile(data, fallback = {}) {
  if (!data) return null;

  return {
    name: data.full_name || fallback.fullName || "",
    id: data.employee_id || fallback.userId || "",
    avatar: data.avatar_url || "",

    personal: {
      dob: data.dob || "",
      gender: data.gender || "",
      maritalStatus: data.marital_status || "",
      bloodGroup: data.blood_group || "",
      personalEmail: data.personal_email || data.email || fallback.email || "",
      officialEmail: data.official_email || "",
      mobileNumber: data.mobile_number || data.phone || "",
      alternateContactNumber: data.alternate_contact_number || "",
      currentAddress: data.current_address || "",
      permanentAddress: data.permanent_address || "",
    },

    job: {
      employeeId: data.employee_id || fallback.userId || "",
      title: data.designation || "HR",
      department: data.department || "Human Resources",
      location: data.location || "",
      workMode: data.work_mode || "Office",
    },

    education: Array.isArray(data.education) ? data.education : [],
    experience: Array.isArray(data.experience) ? data.experience : [],

    skills: {
      primarySkills: data.primary_skills || "",
      secondarySkills: data.secondary_skills || "",
      toolsTechnologies: data.tools_technologies || "",
    },

    bank: {
      accountHolderName: data.account_holder_name || "",
      bankName: data.bank_name || "",
      accountNumber: data.account_number || "",
      ifscCode: data.ifsc_code || "",
      branch: data.branch || "",
    },

    emergencyContacts: data.emergency_name
      ? [
        {
          name: data.emergency_name || "",
          relation: data.emergency_relationship || "",
          phone: data.emergency_contact_number || "",
        },
      ]
      : [],

    idProofs: [],

    // keep uid for save
    __userId: String(data.user_id || fallback.userId || "").trim(),
  };
}

function profileToDbPayload(profile, userId, fallback = {}) {
  const p = profile || {};
  const personal = p.personal || {};
  const job = p.job || {};
  const skills = p.skills || {};
  const bank = p.bank || {};
  const e0 =
    Array.isArray(p.emergencyContacts) && p.emergencyContacts.length
      ? p.emergencyContacts[0]
      : null;

  return {
    user_id: userId,
    // if your table has role column you can keep this,
    // if not existing, remove the next line.
    role: "hr",

    full_name: p.name || fallback.fullName || null,
    email: personal.personalEmail || fallback.email || null,
    phone: personal.mobileNumber || null,

    employee_id: p.id || job.employeeId || userId || null,
    avatar_url: p.avatar || null,

    dob: personal.dob || null,
    gender: personal.gender || null,
    marital_status: personal.maritalStatus || null,
    blood_group: personal.bloodGroup || null,

    personal_email: personal.personalEmail || null,
    official_email: personal.officialEmail || null,
    mobile_number: personal.mobileNumber || null,
    alternate_contact_number: personal.alternateContactNumber || null,

    current_address: personal.currentAddress || null,
    permanent_address: personal.permanentAddress || null,

    location: job.location || null,
    department: job.department || null,
    designation: job.title || null,
    work_mode: job.workMode || null,

    education: Array.isArray(p.education) ? p.education : [],
    experience: Array.isArray(p.experience) ? p.experience : [],

    primary_skills: skills.primarySkills || null,
    secondary_skills: skills.secondarySkills || null,
    tools_technologies: skills.toolsTechnologies || null,

    account_holder_name: bank.accountHolderName || null,
    bank_name: bank.bankName || null,
    account_number: bank.accountNumber || null,
    ifsc_code: bank.ifscCode || null,
    branch: bank.branch || null,

    emergency_name: e0?.name || null,
    emergency_relationship: e0?.relation || null,
    emergency_contact_number: e0?.phone || null,

    profile_completed: true,
    updated_at: new Date().toISOString(),
  };
}

// ? upload helper shared with other areas (keeping bucket names in sync)
async function uploadAvatar({ folderKey, file }) {
  if (!file) return "";
  const cleanName = (file.name || "avatar").replace(/\s+/g, "-");
  const path = `profiles/${folderKey}/${Date.now()}-${cleanName}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

/* ========================================================= */
/* ======================= MAIN ============================ */
/* ========================================================= */

export default function HrProfile() {
  const auth = readAuth();
  const cacheKey = HR_CACHE_KEY(auth.userId);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [editProfile, setEditProfile] = useState(false);

  /* ================= FETCH HR PROFILE ================= */
  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        setErr("");
        setLoading(true);

        const { userId } = auth;
        if (!userId) {
          setErr("HR session not found. Please login again.");
          setProfile(null);
          return;
        }

        // ✅ 1) cache first (Sign-In page save pannina details)
        const cached = safeJsonParse(localStorage.getItem(cacheKey));
        if (cached && mounted) {
          setProfile(cached);
        }

        // ✅ 2) DB load
        if (!isSupabaseConfigured) {
          if (!cached) setErr("Supabase env missing. Showing cached/local data only.");
          if (!cached && mounted) setProfile(null);
          return;
        }

        const { data, error } = await supabase
          .from("hrmss_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(); // ✅ no row -> data=null, error=null

        if (error) throw error;

        // ✅ row exists
        if (data) {
          const mapped = mapDbToProfile(data, auth);
          localStorage.setItem(cacheKey, JSON.stringify(mapped));
          if (mounted) setProfile(mapped);
          return;
        }

        // ✅ 3) row NOT exists -> auto create (so "HR Profile not found" never shows)
        const minimal = {
          name: auth.fullName || "HR",
          id: userId,
          avatar: "",
          personal: {
            dob: "",
            gender: "",
            maritalStatus: "",
            bloodGroup: "",
            personalEmail: auth.email || "",
            officialEmail: "",
            mobileNumber: "",
            alternateContactNumber: "",
            currentAddress: "",
            permanentAddress: "",
          },
          job: {
            employeeId: userId,
            title: "HR",
            department: "Human Resources",
            location: "",
            workMode: "Office",
          },
          education: [],
          experience: [],
          skills: { primarySkills: "", secondarySkills: "", toolsTechnologies: "" },
          bank: { accountHolderName: "", bankName: "", accountNumber: "", ifscCode: "", branch: "" },
          emergencyContacts: [],
          idProofs: [],
          __userId: userId,
        };

        const payload = profileToDbPayload(minimal, userId, auth);

        // ⚠️ if your table doesn't have role column, remove role from payload above
        const { error: upErr } = await supabase
          .from("hrmss_profiles")
          .upsert(payload, { onConflict: "user_id" });

        if (upErr) throw upErr;

        localStorage.setItem(cacheKey, JSON.stringify(minimal));
        if (mounted) setProfile(minimal);
      } catch (e) {
        console.error("HR profile load error:", e);
        if (mounted) setErr(e?.message || "Failed to load HR profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ================= SAVE (cache + DB) ================= */
  const persistProfile = async (next) => {
    setProfile(next);
    localStorage.setItem(cacheKey, JSON.stringify(next));

    if (!isSupabaseConfigured) return;

    try {
      const userId = auth.userId;
      if (!userId) return;

      const payload = profileToDbPayload(next, userId, auth);

      const { error } = await supabase
        .from("hrmss_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;
    } catch (e) {
      console.error(e);
      setErr(e?.message || "Failed to save profile");
    }
  };

  /* ================= UI STATES ================= */

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500 font-semibold">
        Loading HR Profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-10 text-center text-rose-600 font-semibold">
        HR Profile not found
      </div>
    );
  }

  const {
    name,
    id,
    personal,
    job,
    education,
    experience,
    skills,
    bank,
    emergencyContacts,
    avatar,
  } = profile;

  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!profile) return;

    const previewUrl = URL.createObjectURL(file);
    setProfile((prev) => ({ ...prev, avatar: previewUrl }));

    setAvatarUploading(true);
    try {
      const userId = auth.userId || profile?.__userId || id || "hr";
      const avatarUrl = isSupabaseConfigured
        ? await uploadAvatar({ folderKey: userId, file })
        : previewUrl;

      const nextProfile = { ...profile, avatar: avatarUrl };
      await persistProfile(nextProfile);
    } catch (uploadErr) {
      console.error("Avatar upload failed:", uploadErr);
      setErr(uploadErr?.message || "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      if (isSupabaseConfigured) {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  return (
    <div className="space-y-6">
      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      ) : null}

      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>

          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>

        </div>

        <button
          onClick={() => setEditProfile(true)}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
        >
          <Pencil size={16} /> Edit Profile
        </button>
      </div>

      {/* PROFILE SUMMARY */}
      <div className="rounded-2xl border bg-white p-6 flex gap-6 items-center">
        <div className="relative">
          {avatar ? (
            <img
              src={avatar}
              className="h-28 w-28 rounded-full border object-cover"
              alt="HR"
            />
          ) : (
            <div className="h-28 w-28 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
              <Camera size={18} className="text-slate-500" />
            </div>
          )}
          <label className="absolute bottom-1 right-1 bg-white p-1 rounded-full shadow cursor-pointer">
            {avatarUploading ? (
              <span className="text-[11px] text-slate-500">Uploading...</span>
            ) : (
              <Camera size={16} />
            )}
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={changeAvatar}
              disabled={avatarUploading}
            />
          </label>
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">{name || "-"}</h2>
          <p className="text-sm text-slate-500">
            {job?.title || "HR"} – {job?.department || "Human Resources"}
          </p>

          <div className="flex gap-2 mt-3 flex-wrap">
            <Badge>
              <IdCard size={14} /> {id || "-"}
            </Badge>
            <Badge>
              <MapPin size={14} /> {job?.location || "-"}
            </Badge>
            <Badge>
              <Briefcase size={14} /> {job?.workMode || "-"}
            </Badge>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Personal Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <Detail label="FULL NAME" value={name} />
              <Detail label="DOB" value={formatDateValue(personal?.dob)} />
              <Detail label="GENDER" value={personal?.gender} />
              <Detail label="MARITAL STATUS" value={personal?.maritalStatus} />
              <Detail label="BLOOD GROUP" value={personal?.bloodGroup} />
              <Detail label="PERSONAL EMAIL" value={personal?.personalEmail} />
              <Detail label="OFFICIAL EMAIL" value={personal?.officialEmail} />
              <Detail label="MOBILE NUMBER" value={personal?.mobileNumber} />
              <Detail
                label="ALTERNATE NUMBER"
                value={personal?.alternateContactNumber}
              />
              <Detail
                label="CURRENT ADDRESS"
                value={personal?.currentAddress}
                full
              />
              <Detail
                label="PERMANENT ADDRESS"
                value={personal?.permanentAddress}
                full
              />
            </div>
          </SectionCard>

          <SectionCard title="Educational Qualifications">
            <div className="pt-4 space-y-3">
              {education?.length ? (
                education.map((e, i) => (
                  <CardBlock
                    key={i}
                    title={`Qualification #${i + 1}`}
                    icon={GraduationCap}
                  >
                    <Detail label="QUALIFICATION" value={e.qualification} />
                    <Detail label="INSTITUTION" value={e.institution} />
                    <Detail label="YEAR" value={e.yearOfPassing} />
                    <Detail label="SPECIALIZATION" value={e.specialization} />
                  </CardBlock>
                ))
              ) : (
                <EmptyHint icon={GraduationCap} text="No education details" />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Professional Experience">
            <div className="pt-4 space-y-3">
              {experience?.length ? (
                experience.map((e, i) => (
                  <CardBlock
                    key={i}
                    title={`Experience #${i + 1}`}
                    icon={Building2}
                  >
                    <Detail label="ORGANIZATION" value={e.organization} />
                    <Detail label="DESIGNATION" value={e.designation} />
                    <Detail label="DURATION" value={e.duration} />
                    <Detail label="REASON" value={e.reasonForLeaving} />
                  </CardBlock>
                ))
              ) : (
                <EmptyHint icon={Briefcase} text="No experience details" />
              )}
            </div>
          </SectionCard>

          <SectionCard title="Skills & Expertise">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <Detail label="PRIMARY SKILLS" value={skills?.primarySkills} />
              <Detail label="SECONDARY SKILLS" value={skills?.secondarySkills} />
              <Detail
                label="TOOLS / TECHNOLOGIES"
                value={skills?.toolsTechnologies}
                full
              />
            </div>
          </SectionCard>

          <SectionCard title="Bank & Payroll Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <Detail label="ACCOUNT HOLDER" value={bank?.accountHolderName} />
              <Detail label="BANK NAME" value={bank?.bankName} />
              <Detail label="ACCOUNT NUMBER" value={bank?.accountNumber} />
              <Detail label="IFSC" value={bank?.ifscCode} />
              <Detail label="BRANCH" value={bank?.branch} />
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <SectionCard title="Emergency Contact">
            {emergencyContacts?.length ? (
              emergencyContacts.map((c, i) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.relation}</p>
                  <p className="text-sm flex gap-1 items-center">
                    <Phone size={14} /> {c.phone}
                  </p>
                </div>
              ))
            ) : (
              <EmptyHint icon={HeartPulse} text="No emergency contacts" />
            )}
          </SectionCard>
        </div>
      </div>

      <DocumentManager
        title="My Documents"
        subtitle="Upload and manage HR documents"
        accent="purple"
      />

      {editProfile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditProfile(false)}
          onSave={async (next) => {
            await persistProfile(next);
            setEditProfile(false);
          }}
        />
      )}
    </div>
  );
}

/* ========================================================= */
/* ===================== UI HELPERS ======================== */
/* ========================================================= */

function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold bg-slate-100">
      {children}
    </span>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      {children}
    </div>
  );
}

function Detail({ label, value, full }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value || "-"}</p>
    </div>
  );
}

function CardBlock({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold">
        <Icon size={16} /> {title}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function EmptyHint({ icon: Icon, text }) {
  return (
    <div className="flex items-center gap-2 text-slate-500 text-sm">
      <Icon size={16} /> {text}
    </div>
  );
}
