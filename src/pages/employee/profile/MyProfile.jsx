import { useEffect, useMemo, useState } from "react";
import { Badge, Divider, SectionCard } from "../shared/ui.jsx";
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
  CreditCard,
  HeartPulse,
  Home,
  Plus,
  Trash2,
  User,
  CalendarDays,
} from "lucide-react";

import { supabase, isSupabaseConfigured } from "../../../lib/supabaseClient";
import DocumentManager from "../../../components/DocumentManager.jsx";
import { formatDDMMYYYY } from "../../../lib/dateUtils";

/**
 * ✅ IMPORTANT:
 * EmployeeSignIn.jsx stores cache like:
 *   hrmss.profile.cache.employee.<employee_id>
 */
const AUTH_KEY = "HRMSS_AUTH_SESSION";
const PROFILE_CACHE_KEY = (role, key) =>
  `hrmss.profile.cache.${role}.${key || "unknown"}`;

// (optional legacy key fallback - keep if already used previously)
const LEGACY_LS_KEY = "hrmss.employee.signin";

/* ========================= Helpers ========================= */

const createEmptyProfile = () => ({
  name: "",
  id: "",
  avatar: "",
  personal: {
    dob: "",
    email: "",
    phone: "",
    address: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",
    personalEmail: "",
    officialEmail: "",
    mobileNumber: "",
    alternateContactNumber: "",
    currentAddress: "",
    permanentAddress: "",
  },
  job: {
    employeeId: "",
    title: "",
    department: "",
    manager: "",
    joiningDate: "",
    workMode: "",
    location: "",
  },
  education: [],
  experience: [],
  skills: {
    primarySkills: "",
    secondarySkills: "",
    toolsTechnologies: "",
  },
  bank: {
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    branch: "",
  },
  emergencyContacts: [],
  idProofs: [],
});

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readEmployeeIdFromAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  const s = safeJsonParse(raw);
  const empId = (s?.employee_id || s?.identifier || s?.id || "").trim();
  return empId || "";
}

const isDmy = (value) => /^\d{2}\/\d{2}\/\d{4}$/.test(value);

const formatDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (isDmy(raw)) return raw;
  const formatted = formatDDMMYYYY(raw);
  return formatted === "-" ? raw : formatted;
};

function mapDbRowToSaved(row, empId) {
  if (!row) return null;

  return {
    employeeId: row.employee_id || empId || "",
    designation: row.designation || row.role || "",
    department: row.department || "",
    manager: row.manager || row.reporting_manager || "",
    reporting_manager: row.reporting_manager || "",
    joining_date: row.joining_date || row.join_date || "",
    work_mode: row.work_mode || "",
    fullName: row.full_name || "",
    dob: row.dob || "",
    gender: row.gender || "",
    maritalStatus: row.marital_status || "",
    bloodGroup: row.blood_group || "",

    personalEmail: row.personal_email || "",
    officialEmail: row.official_email || "",
    mobileNumber: row.mobile_number || "",
    alternateContactNumber: row.alternate_contact_number || "",

    currentAddress: row.current_address || "",
    permanentAddress: row.permanent_address || "",

    education: Array.isArray(row.education) ? row.education : [],
    experience: Array.isArray(row.experience) ? row.experience : [],

    primarySkills: row.primary_skills || "",
    secondarySkills: row.secondary_skills || "",
    toolsTechnologies: row.tools_technologies || "",

    accountHolderName: row.account_holder_name || "",
    bankName: row.bank_name || "",
    accountNumber: row.account_number || "",
    ifscCode: row.ifsc_code || "",
    branch: row.branch || "",

    emergencyName: row.emergency_name || "",
    emergencyRelationship: row.emergency_relationship || "",
    emergencyContactNumber: row.emergency_contact_number || "",

    location: row.location || "",
    avatar: row.avatar_url || "",
  };
}

function mergeSeedWithSaved(base, saved) {
  if (!saved) return base;

  const mergedEmergency =
    Array.isArray(base?.emergencyContacts) && base.emergencyContacts.length
      ? base.emergencyContacts
      : saved?.emergencyName || saved?.emergencyContactNumber
      ? [
          {
            name: saved.emergencyName || "",
            relation: saved.emergencyRelationship || "",
            phone: saved.emergencyContactNumber || "",
          },
        ]
      : base?.emergencyContacts || [];

  return {
    ...base,

    avatar: saved.avatar || base?.avatar || "",
    name: saved.fullName || base?.name || "",
    id: saved.employeeId || base?.id || "",

    personal: {
      ...(base?.personal || {}),
      dob: saved.dob || base?.personal?.dob || "",
      email: saved.personalEmail || base?.personal?.email || "",
      phone: saved.mobileNumber || base?.personal?.phone || "",
      address: saved.currentAddress || base?.personal?.address || "",

      gender: saved.gender || base?.personal?.gender || "",
      maritalStatus: saved.maritalStatus || "",
      bloodGroup: saved.bloodGroup || "",

      personalEmail: saved.personalEmail || "",
      officialEmail: saved.officialEmail || "",
      mobileNumber: saved.mobileNumber || "",
      alternateContactNumber: saved.alternateContactNumber || "",

      currentAddress: saved.currentAddress || "",
      permanentAddress: saved.permanentAddress || "",
    },

    job: {
      ...(base?.job || {}),
      employeeId: saved.employeeId || base?.job?.employeeId || "",
      title: saved.designation || saved.role || base?.job?.title || "",
      department: saved.department || base?.job?.department || "",
      manager: saved.manager || saved.reporting_manager || base?.job?.manager || "",
      joiningDate: saved.joining_date || saved.joiningDate || base?.job?.joiningDate || "",
      workMode: saved.work_mode || saved.workMode || base?.job?.workMode || "",
      location: saved.location || base?.job?.location || "",
    },

    education: Array.isArray(saved.education)
      ? saved.education
      : base?.education || [],
    experience: Array.isArray(saved.experience)
      ? saved.experience
      : base?.experience || [],

    skills: {
      primarySkills: saved.primarySkills || base?.skills?.primarySkills || "",
      secondarySkills:
        saved.secondarySkills || base?.skills?.secondarySkills || "",
      toolsTechnologies:
        saved.toolsTechnologies || base?.skills?.toolsTechnologies || "",
    },

    bank: {
      accountHolderName:
        saved.accountHolderName || base?.bank?.accountHolderName || "",
      bankName: saved.bankName || base?.bank?.bankName || "",
      accountNumber: saved.accountNumber || base?.bank?.accountNumber || "",
      ifscCode: saved.ifscCode || base?.bank?.ifscCode || "",
      branch: saved.branch || base?.bank?.branch || "",
    },

    emergencyContacts: mergedEmergency,
  };
}

function profileToSaved(profile) {
  const p = profile || {};
  const personal = p.personal || {};
  const job = p.job || {};
  const skills = p.skills || {};
  const bank = p.bank || {};

  const firstEmergency =
    Array.isArray(p.emergencyContacts) && p.emergencyContacts.length
      ? p.emergencyContacts[0]
      : null;

  return {
    employeeId: p.id || job.employeeId || "",
    designation: job.title || "",
    department: job.department || "",
    reporting_manager: job.manager || "",
    joining_date: job.joiningDate || "",
    work_mode: job.workMode || "",
    fullName: p.name || "",
    dob: personal.dob || "",
    gender: personal.gender || "",
    maritalStatus: personal.maritalStatus || "",
    bloodGroup: personal.bloodGroup || "",

    personalEmail: personal.personalEmail || personal.email || "",
    officialEmail: personal.officialEmail || "",
    mobileNumber: personal.mobileNumber || personal.phone || "",
    alternateContactNumber: personal.alternateContactNumber || "",

    currentAddress: personal.currentAddress || personal.address || "",
    permanentAddress: personal.permanentAddress || "",

    education: Array.isArray(p.education) ? p.education : [],
    experience: Array.isArray(p.experience) ? p.experience : [],

    primarySkills: skills.primarySkills || "",
    secondarySkills: skills.secondarySkills || "",
    toolsTechnologies: skills.toolsTechnologies || "",

    accountHolderName: bank.accountHolderName || "",
    bankName: bank.bankName || "",
    accountNumber: bank.accountNumber || "",
    ifscCode: bank.ifscCode || "",
    branch: bank.branch || "",

    emergencyName: firstEmergency?.name || "",
    emergencyRelationship: firstEmergency?.relation || "",
    emergencyContactNumber: firstEmergency?.phone || "",

    location: job.location || "",
    avatar: p.avatar || "",
  };
}

function savedToDbPayload(saved) {
  const empId = String(saved?.employeeId || "").trim();

  return {
    employee_id: empId,
    profile_key: empId,

    full_name: saved.fullName || null,
    dob: saved.dob || null,
    gender: saved.gender || null,
    marital_status: saved.maritalStatus || null,
    blood_group: saved.bloodGroup || null,

    personal_email: saved.personalEmail || null,
    official_email: saved.officialEmail || null,
    mobile_number: saved.mobileNumber || null,
    alternate_contact_number: saved.alternateContactNumber || null,

    current_address: saved.currentAddress || null,
    permanent_address: saved.permanentAddress || null,

    education: Array.isArray(saved.education) ? saved.education : [],
    experience: Array.isArray(saved.experience) ? saved.experience : [],

    primary_skills: saved.primarySkills || null,
    secondary_skills: saved.secondarySkills || null,
    tools_technologies: saved.toolsTechnologies || null,

    account_holder_name: saved.accountHolderName || null,
    bank_name: saved.bankName || null,
    account_number: saved.accountNumber || null,
    ifsc_code: saved.ifscCode || null,
    branch: saved.branch || null,

    emergency_name: saved.emergencyName || null,
    emergency_relationship: saved.emergencyRelationship || null,
    emergency_contact_number: saved.emergencyContactNumber || null,

    location: saved.location || null,
    avatar_url: saved.avatar || null,

    // ✅ mark completed (optional but recommended)
    profile_completed: true,
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

// ✅ employee uses employeeId as "folder"
async function uploadAvatar({ folderKey, file }) {
  const cleanName = (file.name || "avatar").replace(/\s+/g, "-");
  const path = `profiles/${folderKey}/${Date.now()}-${cleanName}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

/* ========================= Component ========================= */

export default function MyProfile() {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [profile, setProfile] = useState(() => createEmptyProfile());

  // modals
  const [editProfile, setEditProfile] = useState(false);
  const [addEmergency, setAddEmergency] = useState(false);
  const [editEmergency, setEditEmergency] = useState(null);
  const [addId, setAddId] = useState(false);
  const [editId, setEditId] = useState(null);

  // ✅ LOAD FROM localStorage OR DB (Sign-In data)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setLoadErr("");

        const base = createEmptyProfile();

        const empId = readEmployeeIdFromAuth();
        if (!empId) {
          if (mounted) {
            setProfile(base);
            setLoadErr("Employee ID missing. Please sign in again.");
          }
          return;
        }

        const cacheKey = PROFILE_CACHE_KEY("employee", empId);

        if (!isSupabaseConfigured) {
          const savedLS = safeJsonParse(localStorage.getItem(cacheKey));
          if (savedLS && (!savedLS.employeeId || savedLS.employeeId === empId)) {
            const merged = mergeSeedWithSaved(base, savedLS);
            if (mounted) setProfile(merged);
            return;
          }

          const legacy = safeJsonParse(localStorage.getItem(LEGACY_LS_KEY));
          const legacyId = String(
            legacy?.employeeId || legacy?.employee_id || legacy?.id || ""
          ).trim();
          if (legacy && legacyId === empId) {
            const merged = mergeSeedWithSaved(base, legacy);
            if (mounted) setProfile(merged);
            localStorage.setItem(cacheKey, JSON.stringify(legacy));
            return;
          }

          if (mounted) {
            setProfile(base);
            setLoadErr(
              "Supabase env missing. Unable to load employee profile from DB."
            );
          }
          return;
        }

        const [profileRes, jobRes] = await Promise.all([
          supabase
            .from("hrmss_employee_profiles")
            .select("*")
            .eq("employee_id", empId)
            .maybeSingle(),
          supabase
            .from("hrmss_profiles")
            .select(
              "employee_id, designation, department, work_mode, joining_date, reporting_manager, location, full_name"
            )
            .eq("employee_id", empId)
            .maybeSingle(),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (jobRes.error && jobRes.error.code !== "PGRST116") throw jobRes.error;

        if (profileRes.data || jobRes.data) {
          const savedFromDb = mapDbRowToSaved(
            { ...(profileRes.data || {}), ...(jobRes.data || {}) },
            empId
          );
          const cached = safeJsonParse(localStorage.getItem(cacheKey));
          const cachedId = String(
            cached?.employeeId || cached?.employee_id || cached?.id || ""
          ).trim();
          const cachedAvatar = cached?.avatar || "";
          if (!savedFromDb.avatar && cachedAvatar && (!cachedId || cachedId === empId)) {
            savedFromDb.avatar = cachedAvatar;
          }
          // Cache into localStorage (same key as Sign-In)
          localStorage.setItem(cacheKey, JSON.stringify(savedFromDb));
          const merged = mergeSeedWithSaved(base, savedFromDb);
          if (mounted) setProfile(merged);
        } else if (mounted) {
          setProfile(base);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setLoadErr(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Derived fields
  const { name, id, personal, job, emergencyContacts, idProofs, avatar } =
    profile;
  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const skills = profile.skills || {};
  const bank = profile.bank || {};

  // ✅ Persist helper: localStorage + DB
  const persistProfile = async (nextProfile) => {
    setProfile(nextProfile);

    const saved = profileToSaved(nextProfile);
    const empId = String(saved.employeeId || readEmployeeIdFromAuth() || "").trim();

    // write cache (same as Sign-In)
    if (empId) {
      localStorage.setItem(
        PROFILE_CACHE_KEY("employee", empId),
        JSON.stringify(saved)
      );
    }
    // (optional legacy write)
    localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(saved));

    // DB upsert
    if (empId && isSupabaseConfigured) {
      try {
        const payload = savedToDbPayload({ ...saved, employeeId: empId });
        const { error } = await supabase
          .from("hrmss_employee_profiles")
          .upsert(payload, { onConflict: "employee_id" });

        if (error) throw error;
      } catch (e) {
        console.error(e);
        setLoadErr(e?.message || "Failed to save profile to DB");
      }
    }
  };

  /* ---------- IMAGE CHANGE ---------- */
  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const empId = readEmployeeIdFromAuth() || id || "";

    // show instantly (preview)
    const previewUrl = URL.createObjectURL(file);
    const previewProfile = { ...profile, avatar: previewUrl };
    setProfile(previewProfile);

    const saveLocalAvatar = async (dataUrl) => {
      const nextProfile = { ...profile, avatar: dataUrl };
      setProfile(nextProfile);
      const saved = profileToSaved(nextProfile);
      try {
        localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(saved));
        if (empId) {
          localStorage.setItem(
            PROFILE_CACHE_KEY("employee", empId),
            JSON.stringify(saved)
          );
        }
      } catch {}
    };

    try {
      // if supabase configured -> upload and store public url
      if (isSupabaseConfigured && empId) {
        const publicUrl = await uploadAvatar({ folderKey: empId, file });
        if (publicUrl) {
          const next = { ...profile, avatar: publicUrl };
          await persistProfile(next);

          try {
            URL.revokeObjectURL(previewUrl);
          } catch {}
          return;
        }
      }

      // fallback: store data URL so it survives refresh
      const dataUrl = await fileToDataUrl(file);
      await saveLocalAvatar(dataUrl);

      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    } catch (err) {
      console.error(err);
      setLoadErr(err?.message || "Avatar upload failed");
      try {
        const dataUrl = await fileToDataUrl(file);
        await saveLocalAvatar(dataUrl);
      } catch {}
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="rounded-2xl border bg-white px-5 py-4 shadow-sm text-sm font-semibold text-slate-700">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ERROR (if any) */}
      {loadErr ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {loadErr}
        </div>
      ) : null}

      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500">
            Manage your personal information
          </p>
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
              alt="Profile"
            />
          ) : (
            <div className="h-28 w-28 rounded-full border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
              <div className="text-center">
                <Camera size={18} className="mx-auto text-slate-500" />
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  Add Photo
                </p>
              </div>
            </div>
          )}

          <label className="absolute bottom-1 right-1 bg-white p-1 rounded-full shadow cursor-pointer">
            <Camera size={16} />
            <input hidden type="file" accept="image/*" onChange={changeAvatar} />
          </label>
        </div>

        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">{name || "-"}</h2>
          <p className="text-sm text-slate-500">
            {job?.title || "-"} • {job?.department || "-"}
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

      {/* GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* PERSONAL DETAILS */}
          <SectionCard title="Personal Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="FULL NAME" value={name} />
              <Detail label="DOB" value={formatDateValue(personal?.dob)} />
              <Detail label="GENDER" value={personal?.gender} />
              <Detail label="MARITAL STATUS" value={personal?.maritalStatus} />
              <Detail label="BLOOD GROUP" value={personal?.bloodGroup} />
              <Detail
                label="PERSONAL EMAIL"
                value={personal?.personalEmail || personal?.email}
              />
              <Detail label="OFFICIAL EMAIL" value={personal?.officialEmail} />
              <Detail
                label="MOBILE NUMBER"
                value={personal?.mobileNumber || personal?.phone}
              />
              <Detail
                label="ALTERNATE NUMBER"
                value={personal?.alternateContactNumber}
              />
              <Detail
                label="CURRENT ADDRESS"
                value={personal?.currentAddress || personal?.address}
                full
              />
              <Detail
                label="PERMANENT ADDRESS"
                value={personal?.permanentAddress}
                full
              />
            </div>
          </SectionCard>

          {/* EDUCATION */}
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
                      <Detail
                        label="INSTITUTION / UNIVERSITY"
                        value={e.institution}
                      />
                      <Detail label="YEAR OF PASSING" value={e.yearOfPassing} />
                      <Detail
                        label="SPECIALIZATION"
                        value={e.specialization}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyHint
                  icon={GraduationCap}
                  text="No education details added yet."
                />
              )}
            </div>
          </SectionCard>

          {/* EXPERIENCE */}
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
                      <Detail
                        label="REASON FOR LEAVING"
                        value={ex.reasonForLeaving}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyHint
                  icon={Briefcase}
                  text="No experience details added yet."
                />
              )}
            </div>
          </SectionCard>

          {/* SKILLS */}
          <SectionCard title="Skills & Expertise">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="PRIMARY SKILLS" value={skills.primarySkills} />
              <Detail label="SECONDARY SKILLS" value={skills.secondarySkills} />
              <Detail
                label="TOOLS / TECHNOLOGIES"
                value={skills.toolsTechnologies}
                full
              />
            </div>
          </SectionCard>

          {/* BANK & PAYROLL */}
          <SectionCard title="Bank & Payroll Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail
                label="ACCOUNT HOLDER NAME"
                value={bank.accountHolderName}
              />
              <Detail label="BANK NAME" value={bank.bankName} />
              <Detail label="ACCOUNT NUMBER" value={bank.accountNumber} />
              <Detail label="IFSC CODE" value={bank.ifscCode} />
              <Detail label="BRANCH" value={bank.branch} />
              <Detail label="WORK LOCATION" value={job?.location} />
            </div>
          </SectionCard>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* EMERGENCY CONTACT */}
          <SectionCard
            title="Emergency Contact"
            action={
              <button
                onClick={() => setAddEmergency(true)}
                className="text-blue-600 text-sm"
              >
                + Add
              </button>
            }
          >
            {emergencyContacts?.length ? (
              emergencyContacts.map((c, i) => (
                <div key={i} className="rounded-xl border p-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.relation}</p>
                  <p className="text-sm flex gap-1">
                    <Phone size={14} /> {c.phone}
                  </p>
                  <button
                    onClick={() => setEditEmergency(i)}
                    className="text-xs text-blue-600 mt-1"
                  >
                    Edit
                  </button>
                </div>
              ))
            ) : (
              <EmptyHint
                icon={HeartPulse}
                text="No emergency contacts added yet."
              />
            )}
          </SectionCard>

          {/* QUICK CONTACT */}
          <SectionCard title="Quick Contact">
            <div className="space-y-3 pt-2">
              <QuickRow
                icon={Mail}
                label="Personal Email"
                value={personal?.personalEmail || personal?.email}
              />
              <QuickRow
                icon={Mail}
                label="Official Email"
                value={personal?.officialEmail}
              />
              <QuickRow
                icon={Phone}
                label="Mobile"
                value={personal?.mobileNumber || personal?.phone}
              />
              <QuickRow
                icon={Phone}
                label="Alternate"
                value={personal?.alternateContactNumber}
              />
              <QuickRow
                icon={Home}
                label="Current Address"
                value={personal?.currentAddress || personal?.address}
              />
              <QuickRow
                icon={MapPin}
                label="Work Location"
                value={job?.location}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <Divider label="End of Profile" />

      <DocumentManager
        title="My Documents"
        subtitle="Upload and view your documents directly from your profile"
        accent="blue"
        role="employee"
      />

      {/* MODALS */}
      {editProfile && (
        <EditProfileModal
          profile={profile}
          onSave={(next) => persistProfile(next)}
          onClose={() => setEditProfile(false)}
        />
      )}

      {(addEmergency || editEmergency !== null) && (
        <EmergencyModal
          profile={profile}
          index={editEmergency}
          onSave={(next) => persistProfile(next)}
          onClose={() => {
            setAddEmergency(false);
            setEditEmergency(null);
          }}
        />
      )}

      {(addId || editId !== null) && (
        <IdModal
          profile={profile}
          index={editId}
          onSave={(next) => persistProfile(next)}
          onClose={() => {
            setAddId(false);
            setEditId(null);
          }}
        />
      )}
    </div>
  );
}

/* ===================== UI HELPERS ===================== */

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

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-xl">
        <div className="p-5 border-b flex justify-between items-center gap-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg border p-1 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 max-h-[75vh] overflow-auto">{children}</div>

        <div className="p-5 border-t bg-slate-50 flex items-center justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100">
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
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100">
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
      <div className="flex items-start gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-blue-100">
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

/* ===================== EDIT PROFILE MODAL (FULL) ===================== */

function EditProfileModal({ profile, onSave, onClose }) {
  const [f, setF] = useState(profile);

  const personal = f.personal || {};
  const job = f.job || {};
  const skills = f.skills || {};
  const bank = f.bank || {};

  const education = Array.isArray(f.education) ? f.education : [];
  const experience = Array.isArray(f.experience) ? f.experience : [];
  const emergencyContacts = Array.isArray(f.emergencyContacts) ? f.emergencyContacts : [];

  const setPersonal = (k, v) => setF((p) => ({ ...p, personal: { ...(p.personal || {}), [k]: v } }));
  const setJob = (k, v) => setF((p) => ({ ...p, job: { ...(p.job || {}), [k]: v } }));
  const setSkills = (k, v) => setF((p) => ({ ...p, skills: { ...(p.skills || {}), [k]: v } }));
  const setBank = (k, v) => setF((p) => ({ ...p, bank: { ...(p.bank || {}), [k]: v } }));

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
      <button
        className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100"
        onClick={onClose}
      >
        Cancel
      </button>
      <button
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        onClick={() => {
          // keep mapping consistent with your profileToSaved()
          const next = {
            ...f,
            // Ensure top-level id + name present
            id: f.id || job.employeeId || "",
            name: f.name || "",
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
    <Modal title="Edit Profile" onClose={onClose} footer={footer}>
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
              // keep both
              setF((p) => ({ ...p, id: v, job: { ...(p.job || {}), employeeId: v } }));
            }}
            placeholder="EMP-001"
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
          <Field icon={Briefcase} label="DESIGNATION" value={job.title} onChange={(v) => setJob("title", v)} placeholder="Software Engineer" />
          <Field icon={Building2} label="DEPARTMENT" value={job.department} onChange={(v) => setJob("department", v)} placeholder="IT" />
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
          {(education.length ? education : []).map((row, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Qualification #{idx + 1}</p>
                {education.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeEducation(idx)}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  icon={GraduationCap}
                  label="QUALIFICATION"
                  value={row.qualification}
                  onChange={(v) => updateEducation(idx, "qualification", v)}
                />
                <Field
                  icon={Building2}
                  label="INSTITUTION"
                  value={row.institution}
                  onChange={(v) => updateEducation(idx, "institution", v)}
                />
                <Field
                  icon={CalendarDays}
                  label="YEAR OF PASSING"
                  value={row.yearOfPassing}
                  onChange={(v) => updateEducation(idx, "yearOfPassing", v)}
                />
                <Field
                  icon={GraduationCap}
                  label="SPECIALIZATION"
                  value={row.specialization}
                  onChange={(v) => updateEducation(idx, "specialization", v)}
                />
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
          {(experience.length ? experience : []).map((row, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Experience #{idx + 1}</p>
                {experience.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeExperience(idx)}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  icon={Building2}
                  label="ORGANIZATION"
                  value={row.organization}
                  onChange={(v) => updateExperience(idx, "organization", v)}
                />
                <Field
                  icon={Briefcase}
                  label="DESIGNATION"
                  value={row.designation}
                  onChange={(v) => updateExperience(idx, "designation", v)}
                />
                <Field
                  icon={CalendarDays}
                  label="DURATION"
                  value={row.duration}
                  onChange={(v) => updateExperience(idx, "duration", v)}
                />
                <Field
                  icon={Briefcase}
                  label="REASON FOR LEAVING"
                  value={row.reasonForLeaving}
                  onChange={(v) => updateExperience(idx, "reasonForLeaving", v)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Skills */}
        <BlockTitle icon={HeartPulse} title="Skills" subtitle="Skills & tools" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            icon={HeartPulse}
            label="PRIMARY SKILLS"
            value={skills.primarySkills}
            onChange={(v) => setSkills("primarySkills", v)}
          />
          <Field
            icon={HeartPulse}
            label="SECONDARY SKILLS"
            value={skills.secondarySkills}
            onChange={(v) => setSkills("secondarySkills", v)}
          />
          <div className="md:col-span-2">
            <FieldTextarea
              icon={HeartPulse}
              label="TOOLS / TECHNOLOGIES"
              value={skills.toolsTechnologies}
              onChange={(v) => setSkills("toolsTechnologies", v)}
              placeholder="Git, Docker, Figma..."
            />
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Bank */}
        <BlockTitle icon={CreditCard} title="Bank Details" subtitle="Payroll info" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            icon={User}
            label="ACCOUNT HOLDER NAME"
            value={bank.accountHolderName}
            onChange={(v) => setBank("accountHolderName", v)}
          />
          <Field
            icon={Building2}
            label="BANK NAME"
            value={bank.bankName}
            onChange={(v) => setBank("bankName", v)}
          />
          <Field
            icon={CreditCard}
            label="ACCOUNT NUMBER"
            value={bank.accountNumber}
            onChange={(v) => setBank("accountNumber", v)}
          />
          <Field
            icon={IdCard}
            label="IFSC CODE"
            value={bank.ifscCode}
            onChange={(v) => setBank("ifscCode", v)}
          />
          <Field
            icon={MapPin}
            label="BRANCH"
            value={bank.branch}
            onChange={(v) => setBank("branch", v)}
          />
        </div>

        <div className="h-px bg-slate-200" />

        {/* Emergency (optional inside edit modal) */}
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
          {(emergencyContacts.length ? emergencyContacts : []).map((c, idx) => (
            <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-slate-900">Contact #{idx + 1}</p>
                {emergencyContacts.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeEmergency(idx)}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  icon={User}
                  label="NAME"
                  value={c.name}
                  onChange={(v) => updateEmergency(idx, "name", v)}
                />
                <Field
                  icon={HeartPulse}
                  label="RELATION"
                  value={c.relation}
                  onChange={(v) => updateEmergency(idx, "relation", v)}
                />
                <div className="md:col-span-2">
                  <Field
                    icon={Phone}
                    label="PHONE"
                    value={c.phone}
                    onChange={(v) => updateEmergency(idx, "phone", v)}
                  />
                </div>
              </div>
            </div>
          ))}

          {!emergencyContacts.length ? (
            <EmptyHint icon={HeartPulse} text="No emergency contacts added yet." />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/* ===================== EMERGENCY MODAL ===================== */

function EmergencyModal({ profile, index, onSave, onClose }) {
  const data =
    index !== null
      ? profile.emergencyContacts[index]
      : { name: "", relation: "", phone: "" };

  const [f, setF] = useState(data);

  return (
    <Modal
      title="Emergency Contact"
      onClose={onClose}
      footer={
        <>
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() => {
              const list = [...(profile.emergencyContacts || [])];
              index !== null ? (list[index] = f) : list.push(f);
              onSave({ ...profile, emergencyContacts: list });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      {["name", "relation", "phone"].map((k) => (
        <input
          key={k}
          className="w-full rounded-xl border p-2 mb-2"
          placeholder={k}
          value={f[k] || ""}
          onChange={(e) => setF({ ...f, [k]: e.target.value })}
        />
      ))}
    </Modal>
  );
}

/* ===================== ID PROOF MODAL ===================== */

function IdModal({ profile, index, onSave, onClose }) {
  const data =
    index !== null
      ? profile.idProofs[index]
      : { type: "", number: "", status: "Pending" };

  const [f, setF] = useState(data);

  return (
    <Modal
      title="ID Proof"
      onClose={onClose}
      footer={
        <>
          <button className="rounded-xl border px-4 py-2 text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() => {
              const list = [...(profile.idProofs || [])];
              index !== null ? (list[index] = f) : list.push(f);
              onSave({ ...profile, idProofs: list });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <input
        className="w-full rounded-xl border p-2 mb-2"
        placeholder="ID Type"
        value={f.type || ""}
        onChange={(e) => setF({ ...f, type: e.target.value })}
      />
      <input
        className="w-full rounded-xl border p-2 mb-2"
        placeholder="ID Number"
        value={f.number || ""}
        onChange={(e) => setF({ ...f, number: e.target.value })}
      />
    </Modal>
  );
}
