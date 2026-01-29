// src/pages/admin/AdminProfile.jsx
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  Plus,
  Trash2,
  User,
  CalendarDays,
  CreditCard,
  Sparkles,
} from "lucide-react";
import DocumentManager from "../../components/DocumentManager.jsx";
import { supabase, isSupabaseConfigured } from "../../lib/supabaseClient";

/* ===================== SEED (Admin + Employee-like fields) ===================== */
const seedAdminProfile = {
  name: "",
  id: "",
  avatar: "",

  personal: {
    dob: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",

    personalEmail: "",
    officialEmail: "",
    email: "",

    mobileNumber: "",
    alternateContactNumber: "",

    currentAddress: "",
    permanentAddress: "",
    address: "",

    phone: "",
  },

  job: {
    employeeId: "",
    title: "",
    department: "",
    employeeType: "",
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
};

const AUTH_KEY = "HRMSS_AUTH_SESSION";
const PROFILE_CACHE_KEY = (key) => `hrmss.profile.cache.admin.${key || "unknown"}`;

function safeJsonParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function rowToAdminProfile(row, base = seedAdminProfile) {
  if (!row) return base;

  const emergencyContacts =
    row?.emergency_name || row?.emergency_contact_number
      ? [
        {
          name: row?.emergency_name || "",
          relation: row?.emergency_relationship || "",
          phone: row?.emergency_contact_number || "",
        },
      ]
      : base?.emergencyContacts || [];

  return {
    ...base,

    avatar: row?.avatar_url || row?.avatar || base?.avatar || "",
    name: row?.full_name || row?.fullName || row?.name || base?.name || "",
    id: row?.employee_id || row?.id || base?.id || "",
    role: row?.role || base?.role || "admin",

    personal: {
      ...(base?.personal || {}),
      dob: row?.dob || base?.personal?.dob || "",
      gender: row?.gender || base?.personal?.gender || "",
      maritalStatus: row?.marital_status || row?.maritalStatus || base?.personal?.maritalStatus || "",
      bloodGroup: row?.blood_group || row?.bloodGroup || base?.personal?.bloodGroup || "",

      personalEmail: row?.personal_email || row?.personalEmail || base?.personal?.personalEmail || "",
      officialEmail: row?.official_email || row?.officialEmail || base?.personal?.officialEmail || "",
      email: row?.official_email || row?.email || base?.personal?.email || "",

      mobileNumber: row?.mobile_number || row?.mobileNumber || base?.personal?.mobileNumber || "",
      alternateContactNumber:
        row?.alternate_contact_number || row?.alternateContactNumber || base?.personal?.alternateContactNumber || "",

      currentAddress: row?.current_address || row?.currentAddress || base?.personal?.currentAddress || "",
      permanentAddress: row?.permanent_address || row?.permanentAddress || base?.personal?.permanentAddress || "",
      address: row?.current_address || row?.address || base?.personal?.address || "",

      phone: row?.mobile_number || row?.phone || base?.personal?.phone || "",
    },

    job: {
      ...(base?.job || {}),
      employeeId: row?.employee_id || row?.employeeId || base?.job?.employeeId || "",
      location: row?.location || base?.job?.location || "",
      department: row?.department || base?.job?.department || "",
      title: row?.designation || row?.title || row?.role || base?.job?.title || "",
      manager: row?.reporting_manager || row?.manager || base?.job?.manager || "",
      joiningDate: row?.joining_date || row?.joiningDate || base?.job?.joiningDate || "",
      workMode: row?.work_mode || row?.workMode || base?.job?.workMode || "",
      employeeType: row?.employee_type || row?.employeeType || base?.job?.employeeType || "",
    },

    education: Array.isArray(row?.education) ? row.education : base?.education || [],
    experience: Array.isArray(row?.experience) ? row.experience : base?.experience || [],

    skills: {
      primarySkills: row?.primary_skills || row?.primarySkills || base?.skills?.primarySkills || "",
      secondarySkills: row?.secondary_skills || row?.secondarySkills || base?.skills?.secondarySkills || "",
      toolsTechnologies: row?.tools_technologies || row?.toolsTechnologies || base?.skills?.toolsTechnologies || "",
    },

    bank: {
      accountHolderName: row?.account_holder_name || row?.accountHolderName || base?.bank?.accountHolderName || "",
      bankName: row?.bank_name || row?.bankName || base?.bank?.bankName || "",
      accountNumber: row?.account_number || row?.accountNumber || base?.bank?.accountNumber || "",
      ifscCode: row?.ifsc_code || row?.ifscCode || base?.bank?.ifscCode || "",
      branch: row?.branch || base?.bank?.branch || "",
    },

    emergencyContacts,
    idProofs: row?.idProofs || base?.idProofs || [],
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

async function uploadAvatar({ folderKey, file }) {
  const cleanName = (file.name || "avatar").replace(/\s+/g, "-");
  const path = `profiles/${folderKey}/${Date.now()}-${cleanName}`;

  try {
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) throw upErr;
  } catch (err) {
    console.warn("Avatar upload skipped:", err?.message || err);
    return "";
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

export default function AdminProfile() {
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(seedAdminProfile);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [editProfile, setEditProfile] = useState(false);
  const [addEmergency, setAddEmergency] = useState(false);
  const [editEmergency, setEditEmergency] = useState(null);
  const [addId, setAddId] = useState(false);
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);

        const authCache = readAuthSession();
        // Prefer app-level auth cache (verify_login_json); Supabase auth may be empty for RPC logins
        const authUserIdFromCache =
          authCache?.user_id ||
          authCache?.id ||
          authCache?.identifier ||
          authCache?.employee_id ||
          authCache?.userId ||
          null;

        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user || null;

        const userId = authUserIdFromCache || user?.id || null;
        if (mounted) setUserId(userId);

        if (!userId) {
          if (mounted) setProfile(cachedProfile || seedAdminProfile);
          return;
        }

        if (!isSupabaseConfigured) {
          if (mounted) setProfile(cachedProfile || seedAdminProfile);
          return;
        }

        if (userId && isSupabaseConfigured) {
          const authEmail =
            authCache?.official_email ||
            authCache?.officialEmail ||
            authCache?.email ||
            null;

          // ✅ Special case: Approver employee - fetch from hrmss_employee_profiles first
          const isApproverEmployee =
            String(authEmail || "").trim().toLowerCase() === "haripriya@twite.ai";

          if (isApproverEmployee && authEmail) {
            const { data: empProfileRow, error: empProfileErr } = await supabase
              .from("hrmss_employee_profiles")
              .select("*")
              .or(`official_email.ilike.${authEmail},personal_email.ilike.${authEmail}`)
              .maybeSingle();

            if (!empProfileErr && empProfileRow && mounted) {
              const next = rowToAdminProfile(empProfileRow, seedAdminProfile);
              const cacheKey = PROFILE_CACHE_KEY(userId);
              localStorage.setItem(cacheKey, JSON.stringify(next));
              setProfile(next);
              return; // Successfully loaded approver profile
            }
          }

          const orFilters = [
            `user_id.eq.${userId}`,
            `employee_id.eq.${userId}`,
            authEmail ? `email.ilike.${authEmail}` : null,
            authEmail ? `official_email.ilike.${authEmail}` : null,
          ]
            .filter(Boolean)
            .join(",");

          const { data: row, error } = await supabase
            .from("hrmss_profiles")
            .select("*")
            .or(orFilters || `user_id.eq.${userId}`)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) throw error;

          if (mounted && row) {
            const next = rowToAdminProfile(row, seedAdminProfile);
            const cacheKey = PROFILE_CACHE_KEY(userId);
            localStorage.setItem(cacheKey, JSON.stringify(next));
            setProfile(next);
          } else if (mounted) {
            // Fallback: try hrmss_employees using employee_id/email
            const { data: empRow, error: empErr } = await supabase
              .from("hrmss_employees")
              .select("*")
              .or(
                [
                  `employee_id.eq.${userId}`,
                  authEmail ? `email.ilike.${authEmail}` : null,
                ]
                  .filter(Boolean)
                  .join(",")
              )
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (empErr) {
              console.error("Employee fallback fetch error:", empErr);
            }

            if (empRow) {
              const next = rowToAdminProfile(empRow, seedAdminProfile);
              const cacheKey = PROFILE_CACHE_KEY(userId);
              localStorage.setItem(cacheKey, JSON.stringify(next));
              setProfile(next);
            } else {
              // Profile missing in DB -> Redirect to sign-in setup
              const authCache = readAuthSession();
              const role = authCache?.role || authCache?.loginRole || "admin";
              navigate("/sign-in", {
                replace: true,
                state: {
                  role,
                  redirectTo: location.pathname,
                },
              });
            }
          }
        }
      } catch (e) {
        // if fetch fails -> keep seed
        if (mounted) setProfile(seedAdminProfile);
        console.error("AdminProfile load error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleProfileSave = async (updated) => {
    setSaveError("");
    setSavingProfile(true);
    try {
      // 1) Update UI immediately
      setProfile(updated);

      // 2) Cache to local storage
      const authCache = readAuthSession();
      const authUserIdFromCache =
        authCache?.user_id ||
        authCache?.id ||
        authCache?.identifier ||
        authCache?.employee_id ||
        authCache?.userId ||
        null;

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user || null;
      const actualUserId = authUserIdFromCache || user?.id || userId || null;

      if (actualUserId) {
        localStorage.setItem(PROFILE_CACHE_KEY(actualUserId), JSON.stringify(updated));
      }

      if (!actualUserId || !isSupabaseConfigured) return true;

      const emergency = Array.isArray(updated.emergencyContacts)
        ? updated.emergencyContacts[0]
        : null;

      const payload = {
        user_id: actualUserId,
        role: updated.role || profile.role || "admin",
        full_name: updated.name || null,
        employee_id: updated.job?.employeeId || updated.id || null,
        avatar_url: updated.avatar || null,

        dob: updated.personal?.dob || null,
        gender: updated.personal?.gender || null,
        marital_status: updated.personal?.maritalStatus || null,
        blood_group: updated.personal?.bloodGroup || null,

        personal_email: updated.personal?.personalEmail || updated.personal?.email || null,
        official_email: updated.personal?.officialEmail || null,
        mobile_number: updated.personal?.mobileNumber || updated.personal?.phone || null,
        alternate_contact_number: updated.personal?.alternateContactNumber || null,

        current_address: updated.personal?.currentAddress || updated.personal?.address || null,
        permanent_address: updated.personal?.permanentAddress || null,

        location: updated.job?.location || null,
        department: updated.job?.department || null,
        designation: updated.job?.title || null,
        reporting_manager: updated.job?.manager || null,
        joining_date: updated.job?.joiningDate || null,
        work_mode: updated.job?.workMode || null,

        primary_skills: updated.skills?.primarySkills || null,
        secondary_skills: updated.skills?.secondarySkills || null,
        tools_technologies: updated.skills?.toolsTechnologies || null,

        account_holder_name: updated.bank?.accountHolderName || null,
        bank_name: updated.bank?.bankName || null,
        account_number: updated.bank?.accountNumber || null,
        ifsc_code: updated.bank?.ifscCode || null,
        branch: updated.bank?.branch || null,

        emergency_name: emergency?.name || null,
        emergency_relationship: emergency?.relation || null,
        emergency_contact_number: emergency?.phone || null,

        education: Array.isArray(updated.education) ? updated.education : null,
        experience: Array.isArray(updated.experience) ? updated.experience : null,

        profile_completed: true,
      };

      // ✅ Special case: Approver employee - save to hrmss_employee_profiles
      const authEmail = authCache?.official_email || authCache?.officialEmail || authCache?.email || "";
      const isApproverEmployee = String(authEmail).trim().toLowerCase() === "haripriya@twite.ai";

      if (isApproverEmployee) {
        const empPayload = {
          employee_id: updated.job?.employeeId || updated.id || null,
          profile_key: updated.job?.employeeId || authEmail,
          profile_completed: true,
          full_name: updated.name || null,
          dob: updated.personal?.dob || null,
          gender: updated.personal?.gender || null,
          marital_status: updated.personal?.maritalStatus || null,
          blood_group: updated.personal?.bloodGroup || null,
          personal_email: updated.personal?.personalEmail || null,
          official_email: updated.personal?.officialEmail || authEmail || null,
          mobile_number: updated.personal?.mobileNumber || null,
          alternate_contact_number: updated.personal?.alternateContactNumber || null,
          current_address: updated.personal?.currentAddress || null,
          permanent_address: updated.personal?.permanentAddress || null,
          education: Array.isArray(updated.education) ? updated.education : [],
          experience: Array.isArray(updated.experience) ? updated.experience : [],
          primary_skills: updated.skills?.primarySkills || null,
          secondary_skills: updated.skills?.secondarySkills || null,
          tools_technologies: updated.skills?.toolsTechnologies || null,
          account_holder_name: updated.bank?.accountHolderName || null,
          bank_name: updated.bank?.bankName || null,
          account_number: updated.bank?.accountNumber || null,
          ifsc_code: updated.bank?.ifscCode || null,
          branch: updated.bank?.branch || null,
          emergency_name: emergency?.name || null,
          emergency_relationship: emergency?.relation || null,
          emergency_contact_number: emergency?.phone || null,
          location: updated.job?.location || null,
          avatar_url: updated.avatar || null,
        };

        const { error } = await supabase
          .from("hrmss_employee_profiles")
          .upsert(empPayload, { onConflict: "official_email" });
        if (error) throw error;
        return true;
      }

      const { error } = await supabase.from("hrmss_profiles").upsert(payload, {
        onConflict: "user_id",
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error("Profile save error:", e);
      setSaveError(e.message || "Failed to save profile");
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const { name, id, personal, job, emergencyContacts, idProofs, avatar } = profile;

  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const skills = profile.skills || {};
  const bank = profile.bank || {};

  /* ---------- IMAGE CHANGE ---------- */
  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaveError("");

    const previewUrl = URL.createObjectURL(file);
    setProfile((p) => ({ ...p, avatar: previewUrl }));

    const authCache = readAuthSession();
    const cacheKeySource =
      userId || authCache?.id || authCache?.email || authCache?.identifier || "";
    const cacheKey = cacheKeySource ? PROFILE_CACHE_KEY(cacheKeySource) : "";

    const saveLocalAvatar = async (dataUrl) => {
      setProfile((p) => {
        const next = { ...p, avatar: dataUrl };
        if (cacheKey) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(next));
          } catch { }
        }
        return next;
      });
    };

    try {
      if (isSupabaseConfigured && userId) {
        const publicUrl = await uploadAvatar({ folderKey: userId, file });
        if (publicUrl) {
          const next = { ...profile, avatar: publicUrl };
          await handleProfileSave(next);

          try {
            URL.revokeObjectURL(previewUrl);
          } catch { }
          return;
        }
      }

      const dataUrl = await fileToDataUrl(file);
      await saveLocalAvatar(dataUrl);

      try {
        URL.revokeObjectURL(previewUrl);
      } catch { }
    } catch (err) {
      console.error("Avatar update failed:", err);
      setSaveError(err?.message || "Failed to update avatar");
      try {
        const dataUrl = await fileToDataUrl(file);
        await saveLocalAvatar(dataUrl);
      } catch { }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Admin Console
          </p>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-sm text-slate-500">
            Manage your admin profile information
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEditProfile(true)}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 transition-all active:scale-[0.99]"
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
              alt="Admin"
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
          <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
          <p className="text-sm text-slate-500">
            {job?.title} • {job?.department}
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
              <Detail label="DOB" value={personal?.dob} />

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

          {/* JOB INFORMATION */}
          <SectionCard title="Job Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="ADMIN ID" value={job?.employeeId} />
              <Detail label="DEPARTMENT" value={job?.department} />
              <Detail label="ROLE / DESIGNATION" value={job?.title} />
              <Detail label="EMPLOYEE TYPE" value={job?.employeeType} />
              <Detail label="REPORTING MANAGER" value={job?.manager} />
              <Detail label="DATE OF JOINING" value={job?.joiningDate} />
              <Detail label="WORK MODE" value={job?.workMode} />
              <Detail label="WORK LOCATION" value={job?.location} />
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
                      <Detail
                        label="DURATION"
                        value={
                          ex.duration ||
                          (ex.fromDate ? `${ex.fromDate} - ${ex.isPresent ? "Present" : (ex.toDate || "Present")}` : "-")
                        }
                      />
                      <Detail label="REASON FOR LEAVING" value={ex.reasonForLeaving} />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyHint icon={Briefcase} text="No experience details added yet." />
              )}
            </div>
          </SectionCard>

          {/* SKILLS */}
          <SectionCard title="Skills & Expertise">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 pt-4">
              <Detail label="PRIMARY SKILLS" value={skills.primarySkills} />
              <Detail label="SECONDARY SKILLS" value={skills.secondarySkills} />
              <Detail label="TOOLS / TECHNOLOGIES" value={skills.toolsTechnologies} full />
            </div>
          </SectionCard>

          {/* BANK */}
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

        {/* RIGHT */}
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
        subtitle="Upload and access your admin documents"
        accent="blue"
        role="admin"
      />


      <Divider label="End of Profile" />

      {editProfile && (
        <EditProfileModal
          profile={profile}
          onSave={handleProfileSave}
          saving={savingProfile}
          error={saveError}
          onClose={() => setEditProfile(false)}
        />
      )}

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

/* ===================== LOCAL UI COMPONENTS ===================== */
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

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b flex justify-between items-center gap-3 shrink-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border p-1 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">{children}</div>

        {footer ? (
          <div className="p-5 border-t bg-slate-50 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        ) : null}
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

/* ===================== MODALS ===================== */
function EditProfileModal({ profile, onSave, saving, error, onClose }) {
  const [f, setF] = useState(profile);
  const [localError, setLocalError] = useState("");

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
      return { ...p, education: next.length ? next : [] };
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
      return { ...p, experience: next.length ? next : [] };
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
      const next = (Array.isArray(p.emergencyContacts) ? p.emergencyContacts : []).filter((_, i) => i !== idx);
      return { ...p, emergencyContacts: next.length ? next : [] };
    });
  };

  const footer = (
    <>
      <button className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-100" onClick={onClose} disabled={saving}>
        Cancel
      </button>
      <button
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
        disabled={saving}
        onClick={async () => {
          setLocalError("");
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
          const ok = await onSave(next);
          if (ok) onClose();
          else setLocalError("Could not save. Please try again.");
        }}
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </>
  );

  return (
    <Modal title="Edit Admin Profile" onClose={onClose} footer={footer}>
      {(error || localError) && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs p-2">
          {error || localError}
        </div>
      )}

      <div className="space-y-8">
        {/* Personal */}
        <BlockTitle icon={User} title="Personal Details" subtitle="Identity & contact" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field icon={User} label="FULL NAME" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
          <Field icon={CalendarDays} label="DOB" value={personal.dob} onChange={(v) => setPersonal("dob", v)} />
          <Field icon={User} label="GENDER" value={personal.gender} onChange={(v) => setPersonal("gender", v)} />
          <Field
            icon={User}
            label="MARITAL STATUS"
            value={personal.maritalStatus}
            onChange={(v) => setPersonal("maritalStatus", v)}
          />
          <Field
            icon={HeartPulse}
            label="BLOOD GROUP"
            value={personal.bloodGroup}
            onChange={(v) => setPersonal("bloodGroup", v)}
          />
          <Field
            icon={Mail}
            label="PERSONAL EMAIL"
            value={personal.personalEmail}
            onChange={(v) => setPersonal("personalEmail", v)}
          />
          <Field
            icon={Mail}
            label="OFFICIAL EMAIL"
            value={personal.officialEmail || personal.email}
            onChange={(v) => setPersonal("officialEmail", v)}
          />
          <Field
            icon={Phone}
            label="MOBILE NUMBER"
            value={personal.mobileNumber || personal.phone}
            onChange={(v) => {
              setPersonal("mobileNumber", v);
              setPersonal("phone", v);
            }}
          />
          <Field
            icon={Phone}
            label="ALTERNATE NUMBER"
            value={personal.alternateContactNumber}
            onChange={(v) => setPersonal("alternateContactNumber", v)}
          />
          <div className="md:col-span-2">
            <Field
              icon={Home}
              label="CURRENT ADDRESS"
              value={personal.currentAddress || personal.address}
              onChange={(v) => {
                setPersonal("currentAddress", v);
                setPersonal("address", v);
              }}
            />
          </div>
          <div className="md:col-span-2">
            <Field
              icon={Home}
              label="PERMANENT ADDRESS"
              value={personal.permanentAddress}
              onChange={(v) => setPersonal("permanentAddress", v)}
            />
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Job */}
        <BlockTitle icon={Briefcase} title="Job Information" subtitle="Admin details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            icon={IdCard}
            label="ADMIN ID"
            value={job.employeeId || f.id}
            onChange={(v) => {
              setJob("employeeId", v);
              setF({ ...f, id: v });
            }}
          />
          <Field icon={Building2} label="DEPARTMENT" value={job.department} onChange={(v) => setJob("department", v)} />
          <Field icon={Briefcase} label="ROLE / DESIGNATION" value={job.title} onChange={(v) => setJob("title", v)} />
          <Field
            icon={Briefcase}
            label="EMPLOYEE TYPE"
            value={job.employeeType}
            onChange={(v) => setJob("employeeType", v)}
          />
          <Field icon={User} label="REPORTING MANAGER" value={job.manager} onChange={(v) => setJob("manager", v)} />
          <Field
            icon={CalendarDays}
            label="DATE OF JOINING"
            value={job.joiningDate}
            onChange={(v) => setJob("joiningDate", v)}
          />
          <Field icon={Sparkles} label="WORK MODE" value={job.workMode} onChange={(v) => setJob("workMode", v)} />
          <Field icon={MapPin} label="WORK LOCATION" value={job.location} onChange={(v) => setJob("location", v)} />
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
                <p className="text-sm font-bold text-slate-900">Education #{idx + 1}</p>
                <button
                  type="button"
                  onClick={() => removeEducation(idx)}
                  className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={14} /> Remove
                </button>
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
          {education.length === 0 && (
            <div className="text-sm text-slate-500 italic p-2 border border-dashed rounded-xl text-center">
              No education details added.
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* Experience */}
        <BlockTitle
          icon={Building2}
          title="Experience"
          subtitle="Past roles"
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
          {experience.length === 0 && (
            <div className="text-sm text-slate-500 italic p-2 border border-dashed rounded-xl text-center">
              No experience details added.
            </div>
          )}
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
              placeholder="Git, Docker, Nginx..."
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
          <Field icon={Building2} label="BANK NAME" value={bank.bankName} onChange={(v) => setBank("bankName", v)} />
          <Field
            icon={CreditCard}
            label="ACCOUNT NUMBER"
            value={bank.accountNumber}
            onChange={(v) => setBank("accountNumber", v)}
          />
          <Field icon={IdCard} label="IFSC CODE" value={bank.ifscCode} onChange={(v) => setBank("ifscCode", v)} />
          <Field icon={MapPin} label="BRANCH" value={bank.branch} onChange={(v) => setBank("branch", v)} />
        </div>

        <div className="h-px bg-slate-200" />

        {/* Emergency */}
        <BlockTitle
          icon={HeartPulse}
          title="Emergency Contacts"
          subtitle="Add at least one"
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
                <Field
                  icon={HeartPulse}
                  label="RELATION"
                  value={c.relation}
                  onChange={(v) => updateEmergency(idx, "relation", v)}
                />
                <div className="md:col-span-2">
                  <Field icon={Phone} label="PHONE" value={c.phone} onChange={(v) => updateEmergency(idx, "phone", v)} />
                </div>
              </div>
            </div>
          ))}
          {emergencyContacts.length === 0 && (
            <div className="text-sm text-slate-500 italic p-2 border border-dashed rounded-xl text-center">
              No emergency contacts added.
            </div>
          )}
        </div>
      </div>
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
        className="rounded-xl bg-blue-600 px-4 py-2 text-white w-full"
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
        className="rounded-xl bg-blue-600 px-4 py-2 text-white w-full"
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
