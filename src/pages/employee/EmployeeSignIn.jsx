// ✅ src/pages/employee/EmployeeSignIn.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Camera,
  Save,
  IdCard,
  User,
  Mail,
  Phone,
  CalendarDays,
  MapPin,
  Home,
  ShieldCheck,
  ArrowLeft,
  Sparkles,
  ImagePlus,
  Plus,
  Trash2,
  Building2,
  GraduationCap,
  Briefcase,
  CreditCard,
  HeartPulse,
  ChevronDown,
} from "lucide-react";

import { supabase } from "../../lib/supabaseClient";

import Preloader from "../../components/Preloader";

/* ===================== CONFIG ===================== */

const ROLE_LABELS = {
  employee: "Employee",
  hr: "HR",
  admin: "Admin",
  manager: "Manager",

  "admin-head": "Admin Head",
};

const ROLE_REDIRECTS = {
  employee: "/employee-dashboard",
  hr: "/hr-dashboard",
  admin: "/dashboard",
  manager: "/manager-dashboard",

  "admin-head": "/admin-head",
};

const COMPLETION_KEY = (role) => `hrmss.signin.completed.${role}`;
const AUTH_KEY = "HRMSS_AUTH_SESSION";

/* ✅ Local profile cache key (MyProfile show aaga use aagum) */
const PROFILE_CACHE_KEY = (role, key) =>
  `hrmss.profile.cache.${role}.${key || "unknown"}`;

/* ===================== HELPERS ===================== */

const emptyForm = (empIdFromLogin = "", userEmail = "") => ({
  employeeId: empIdFromLogin,
  fullName: "",
  dob: "",
  gender: "",
  maritalStatus: "",
  bloodGroup: "",

  personalEmail: "",
  officialEmail: userEmail || "",
  mobileNumber: "",
  alternateContactNumber: "",

  currentAddress: "",
  permanentAddress: "",

  education: [
    { qualification: "", institution: "", yearOfPassing: "", specialization: "" },
  ],
  experience: [
    { organization: "", designation: "", fromDate: "", toDate: "", isPresent: false, reasonForLeaving: "" },
  ],

  primarySkills: "",
  secondarySkills: "",
  toolsTechnologies: "",

  accountHolderName: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  branch: "",

  emergencyName: "",
  emergencyRelationship: "",
  emergencyContactNumber: "",

  location: "",
  avatar: "",


  // ✅ Job Info (Added to be consistent with MyProfile)
  department: "",
  designation: "",
  workMode: "",
  joiningDate: "",
  manager: "",

  // ✅ Job Experience (New fields)
  totalExpFrom: "",
  totalExpTo: "",
  totalExpPresent: false,
  relevantExpFrom: "",
  relevantExpTo: "",
  relevantExpPresent: false,
});

function mapDbToForm(row, empIdFromLogin = "", userEmail = "") {
  const form = emptyForm(empIdFromLogin, userEmail);

  return {
    ...form,
    employeeId: row.employee_id ?? empIdFromLogin ?? "",
    fullName: row.full_name ?? "",
    dob: row.dob ?? "",
    gender: row.gender ?? "",
    maritalStatus: row.marital_status ?? "",
    bloodGroup: row.blood_group ?? "",

    personalEmail: row.personal_email ?? "",
    officialEmail: row.official_email ?? userEmail ?? "",
    mobileNumber: row.mobile_number ?? "",
    alternateContactNumber: row.alternate_contact_number ?? "",

    currentAddress: row.current_address ?? "",
    permanentAddress: row.permanent_address ?? "",

    education:
      Array.isArray(row.education) && row.education.length
        ? row.education
        : form.education,
    experience: Array.isArray(row.experience)
      ? row.experience.map(ex => ({
        ...ex,
        fromDate: ex.fromDate || (ex.duration ? String(ex.duration).split(" - ")[0] : ""),
        toDate: ex.toDate || (ex.duration ? String(ex.duration).split(" - ")[1] : ""),
        isPresent: ex.isPresent || (ex.duration && String(ex.duration).toLowerCase().includes("present"))
      }))
      : form.experience,

    primarySkills: row.primary_skills ?? "",
    secondarySkills: row.secondary_skills ?? "",
    toolsTechnologies: row.tools_technologies ?? "",

    accountHolderName: row.account_holder_name ?? "",
    bankName: row.bank_name ?? "",
    accountNumber: row.account_number ?? "",
    ifscCode: row.ifsc_code ?? "",
    branch: row.branch ?? "",

    emergencyName: row.emergency_name ?? "",
    emergencyRelationship: row.emergency_relationship ?? "",
    emergencyContactNumber: row.emergency_contact_number ?? "",

    location: row.location ?? "",
    avatar: row.avatar_url ?? "",


    // ✅ Job Info
    department: row.department ?? "",
    designation: row.designation ?? "",
    workMode: row.work_mode ?? "",
    joiningDate: row.joining_date ?? "",
    manager: row.reporting_manager ?? "",

    // ✅ Job Experience mapping (parse from concatenated strings if needed)
    totalExpFrom: row.total_exp_from || (row.total_experience ? String(row.total_experience).split(" - ")[0] : ""),
    totalExpTo: row.total_exp_to || (row.total_experience ? String(row.total_experience).split(" - ")[1] : ""),
    totalExpPresent: row.total_exp_present || (row.total_experience && String(row.total_experience).toLowerCase().includes("present")),

    relevantExpFrom: row.relevant_exp_from || (row.relevant_experience ? String(row.relevant_experience).split(" - ")[0] : ""),
    relevantExpTo: row.relevant_exp_to || (row.relevant_experience ? String(row.relevant_experience).split(" - ")[1] : ""),
    relevantExpPresent: row.relevant_exp_present || (row.relevant_experience && String(row.relevant_experience).toLowerCase().includes("present")),
  };
}

function readAuthSession() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ✅ optional: read cached profile (fallback) */
function readCachedProfile(role, key) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY(role, key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ✅ employee uses employeeId as "folder"


const hydrateJobInfoFromEmployees = async (empId, setForm, alreadyMergedRef, isMounted = () => true) => {
  if (!empId || alreadyMergedRef.current) return;
  const { data, error } = await supabase
    .from("hrmss_employees")
    .select("department, role, reporting_manager, join_date, location")
    .eq("employee_id", empId)
    .maybeSingle();

  if (error || !data || !isMounted()) return;

  alreadyMergedRef.current = true;
  setForm((prev) => ({
    ...prev,
    department: prev.department || data.department || "",
    designation: prev.designation || data.role || "",
    joiningDate: prev.joiningDate || data.join_date || "",
    workMode: prev.workMode || prev.work_mode || "",
    manager: prev.manager || data.reporting_manager || "",
    location: prev.location || data.location || "",
  }));
};

async function uploadAvatar({ folderKey, file }) {
  const cleanName = (file.name || "avatar").replace(/\s+/g, "-");
  const path = `profiles/${folderKey}/${Date.now()}-${cleanName}`;


  try {
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (upErr) throw upErr;
  } catch (err) {
    // Storage bucket has RLS; fall back to no avatar rather than blocking profile save.
    console.warn("Avatar upload skipped:", err?.message || err);
    return "";
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

const calculateExperience = (from, to) => {
  if (!from) return "";
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  if (isNaN(start.getTime())) return "";

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  // Adjust for partial months
  if (days < 0) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const yPart = years > 0 ? `${years} Year${years > 1 ? "s" : ""}` : "0 Years";
  const mPart = `${months} Month${months !== 1 ? "s" : ""}`;

  return `${yPart} ${mPart}`;
};

/* ===================== COMPONENT ===================== */

export default function EmployeeSignIn() {
  const navigate = useNavigate();
  const location = useLocation();

  const roleFromState = location.state?.role || "";
  const roleFromStorage = localStorage.getItem("hrmss.lastRole") || "";
  const role = roleFromState || roleFromStorage || "employee";

  const roleLabel = ROLE_LABELS[role] || "User";
  const redirectTo =
    location.state?.redirectTo || ROLE_REDIRECTS[role] || "/login";
  const empIdFromLogin = location.state?.empId || "";


  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false); // ✅ Validation state

  const jobInfoMerged = useRef(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);

  const [form, setForm] = useState(() => emptyForm(empIdFromLogin, ""));

  useEffect(() => {
    if (role) localStorage.setItem("hrmss.lastRole", role);
  }, [role]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError("");

        const authCache = readAuthSession();

        // ✅ Employee role: no supabase auth needed
        if (role === "employee") {
          const empId = String(
            empIdFromLogin || authCache?.employee_id || authCache?.identifier || ""
          ).trim();

          if (!empId) {
            navigate("/login", { replace: true });
            return;
          }

          const { data: row, error: selErr } = await supabase
            .from("hrmss_employee_profiles")
            .select("*")
            .eq("employee_id", empId)
            .maybeSingle();

          if (selErr) throw selErr;
          if (!mounted) return;


          if (row) {
            setForm(mapDbToForm(row, empId, ""));
          } else {
            // ✅ fallback: cached -> else empty
            const cached = readCachedProfile("employee", empId);
            if (cached)
              setForm({ ...emptyForm(empId, ""), ...cached, employeeId: empId });
            else setForm(emptyForm(empId, ""));
          }


          await hydrateJobInfoFromEmployees(empId, setForm, jobInfoMerged, () => mounted);
          return;
        }

        // ✅ Special case: Approver employee (admin role but actually an employee)
        const approverEmail = authCache?.email || authCache?.identifier || "";
        const isApproverEmployee = role === "admin" &&
          String(approverEmail).trim().toLowerCase() === "haripriya@twite.ai";

        if (isApproverEmployee) {
          // Fetch from hrmss_employee_profiles using email (like employee flow)
          const { data: empRow, error: empErr } = await supabase
            .from("hrmss_employee_profiles")
            .select("*")
            .or(`official_email.eq.${approverEmail},personal_email.eq.${approverEmail}`)
            .maybeSingle();

          if (empErr) throw empErr;
          if (!mounted) return;

          const empId = empRow?.employee_id || authCache?.employee_id || "";

          if (empRow) {
            setForm(mapDbToForm(empRow, empId, approverEmail));
          } else {
            // Start with empty form for fresh profile
            setForm(emptyForm(empId, approverEmail));
          }

          // Hydrate job info from hrmss_employees table
          if (empId) {
            await hydrateJobInfoFromEmployees(empId, setForm, jobInfoMerged, () => mounted);
          }
          return;
        }

        // ✅ Other roles (hr/admin/manager) - existing logic (supabase auth)
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user || null;

        const userId = user?.id || authCache?.id || null;

        const userEmail =
          user?.email ||
          authCache?.email ||
          authCache?.official_email ||
          authCache?.identifier ||
          "";

        if (!userId) {
          navigate("/login", { replace: true, state: { redirectTo: "/sign-in", role } });
          return;
        }

        const { data: row, error: selErr } = await supabase
          .from("hrmss_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (selErr) throw selErr;
        if (!mounted) return;

        if (row) setForm(mapDbToForm(row, empIdFromLogin, userEmail));
        else {
          // ✅ fallback: cached -> else empty
          const cached = readCachedProfile(role, userId);
          if (cached) setForm({ ...emptyForm(empIdFromLogin, userEmail), ...cached });
          else setForm(emptyForm(empIdFromLogin, userEmail));
        }
      } catch (e) {
        console.error(e);
        if (mounted) setError(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [empIdFromLogin, navigate, role]);

  const onChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const updateEducation = (index, key, value) => {
    setForm((p) => {
      const next = [...p.education];
      next[index] = { ...next[index], [key]: value };
      return { ...p, education: next };
    });
  };

  const addEducation = () => {
    setForm((p) => ({
      ...p,
      education: [
        ...p.education,
        { qualification: "", institution: "", yearOfPassing: "", specialization: "" },
      ],
    }));
  };

  const removeEducation = (index) => {
    setForm((p) => {
      const next = p.education.filter((_, i) => i !== index);
      return { ...p, education: next.length ? next : p.education };
    });
  };

  const updateExperience = (index, key, value) => {
    setForm((p) => {
      const next = [...p.experience];
      next[index] = { ...next[index], [key]: value };
      return { ...p, experience: next };
    });
  };

  const addExperience = () => {
    setForm((p) => ({
      ...p,
      experience: [
        ...p.experience,
        { organization: "", designation: "", fromDate: "", toDate: "", isPresent: false, reasonForLeaving: "" },
      ],
    }));
  };

  const removeExperience = (index) => {
    setForm((p) => {
      const next = p.experience.filter((_, i) => i !== index);
      return { ...p, experience: next.length ? next : p.experience };
    });
  };

  const changeAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (form.avatar && String(form.avatar).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(form.avatar);
      } catch { }
    }

    setAvatarFile(file);
    setAvatarRemoved(false);
    onChange("avatar", URL.createObjectURL(file));
  };

  const removeAvatar = () => {
    if (form.avatar && String(form.avatar).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(form.avatar);
      } catch { }
    }
    setAvatarFile(null);
    setAvatarRemoved(true);
    onChange("avatar", "");
  };

  const completeness = useMemo(() => {
    const must = [
      form.employeeId,
      form.fullName,
      form.dob,
      form.gender,
      form.personalEmail,
      form.mobileNumber,
      form.currentAddress,
      form.accountHolderName,
      form.bankName,
      form.accountNumber,
      form.ifscCode,
      form.emergencyName,
      form.emergencyContactNumber,
    ];
    const filled = must.filter((v) => String(v || "").trim().length > 0).length;
    return Math.round((filled / must.length) * 100);
  }, [form]);


  /* ✅ Check if this is an "Edit Profile" mode (already completed once) */
  const isEditMode = useMemo(() => {
    return localStorage.getItem(COMPLETION_KEY(role)) === "true";
  }, [role]);

  const saveAndContinue = async () => {
    try {
      setSaving(true);
      setError("");
      setIsSubmitted(true); // ✅ Trigger validation visuals

      const requiredFields = [
        { key: "fullName", label: "Full Name" },
        { key: "personalEmail", label: "Personal Email" },
        { key: "mobileNumber", label: "Mobile Number" },

        // Personal
        { key: "dob", label: "Date of Birth" },
        { key: "gender", label: "Gender" },
        { key: "maritalStatus", label: "Marital Status" },
        { key: "bloodGroup", label: "Blood Group" },

        // Job Experience
        { key: "totalExpFrom", label: "Total Experience From" },

        // Address
        { key: "currentAddress", label: "Current Address" },
        { key: "permanentAddress", label: "Permanent Address" },

        // Bank
        { key: "accountHolderName", label: "Account Holder Name" },
        { key: "bankName", label: "Bank Name" },
        { key: "accountNumber", label: "Account Number" },
        { key: "ifscCode", label: "IFSC Code" },
        { key: "branch", label: "Branch" },

        // Emergency
        { key: "emergencyName", label: "Emergency Contact Name" },
        { key: "emergencyRelationship", label: "Relationship" },
        { key: "emergencyContactNumber", label: "Emergency Contact Number" },
      ];

      if (role === "employee" || empIdFromLogin) {
        requiredFields.push({ key: "employeeId", label: "Employee ID" });
      }

      // ✅ Phone Validation (10 digits)
      const validatePhone = (key, label, isRequired) => {
        const val = form[key] || "";
        const numPart = val.includes(" ") ? val.split(" ")[1] : val;
        // Check if just code or empty
        if (isRequired && (!numPart || numPart.replace(/\D/g, "").length !== 10)) return `Please enter valid 10-digit ${label}`;
        if (!isRequired && numPart && numPart.replace(/\D/g, "").length !== 10) return `Please enter valid 10-digit ${label}`;
        return null;
      };

      const phoneError = validatePhone("mobileNumber", "Mobile Number", true) ||
        validatePhone("emergencyContactNumber", "Emergency Contact Number", true) ||
        (form.alternateContactNumber && validatePhone("alternateContactNumber", "Alternate Contact Number", false));

      if (phoneError) {
        setError(phoneError);
        setSaving(false);
        return;
      }

      const missing = requiredFields.filter((f) => !String(form[f.key] || "").trim());
      if (missing.length) {
        setError("Please fill the required fields to continue.");

        setSaving(false);
        return;
      }

      // ✅ EMPLOYEE save to hrmss_employee_profiles
      if (role === "employee") {
        const empId = String(form.employeeId || empIdFromLogin || "").trim();
        if (!empId) {
          setError("Employee ID missing");

          setSaving(false);
          return;
        }

        let avatar_url = form.avatar || "";
        if (avatarRemoved) {
          avatar_url = null;
        } else if (avatarFile) {
          avatar_url = await uploadAvatar({ folderKey: empId, file: avatarFile });
        } else {
          if (String(avatar_url).startsWith("blob:")) avatar_url = null;
        }

        const payload = {
          employee_id: empId,
          profile_key: empId,

          profile_completed: true,
          full_name: form.fullName || null,
          dob: form.dob || null,
          gender: form.gender || null,
          marital_status: form.maritalStatus || null,
          blood_group: form.bloodGroup || null,

          personal_email: form.personalEmail || null,
          official_email: form.officialEmail || null,
          mobile_number: form.mobileNumber || null,
          alternate_contact_number: form.alternateContactNumber || null,

          current_address: form.currentAddress || null,
          permanent_address: form.permanentAddress || null,
          education: Array.isArray(form.education) ? form.education : [],
          experience: Array.isArray(form.experience) ? form.experience : [],
          primary_skills: form.primarySkills || null,
          secondary_skills: form.secondarySkills || null,
          tools_technologies: form.toolsTechnologies || null,
          account_holder_name: form.accountHolderName || null,
          bank_name: form.bankName || null,
          account_number: form.accountNumber || null,
          ifsc_code: form.ifscCode || null,
          branch: form.branch || null,

          emergency_name: form.emergencyName || null,
          emergency_relationship: form.emergencyRelationship || null,
          emergency_contact_number: form.emergencyContactNumber || null,
          location: form.location || null,
          avatar_url: avatar_url || null,

          // ✅ Job Experience columns
          total_experience: form.totalExpFrom ? `${form.totalExpFrom} - ${(!form.totalExpTo || form.totalExpPresent) ? "Present" : form.totalExpTo}` : null,
          relevant_experience: form.relevantExpFrom ? `${form.relevantExpFrom} - ${(!form.relevantExpTo || form.relevantExpPresent) ? "Present" : form.relevantExpTo}` : null,
        };

        const { error: upErr } = await supabase
          .from("hrmss_employee_profiles")
          .upsert(payload, { onConflict: "employee_id" });

        if (upErr) throw upErr;

        if (avatar_url && String(form.avatar).startsWith("blob:")) {
          const old = form.avatar;
          onChange("avatar", avatar_url);
          try {
            URL.revokeObjectURL(old);
          } catch { }
        }


        try {
          const cacheForm = { ...form, employeeId: empId, avatar: avatar_url || "" };
          localStorage.setItem(PROFILE_CACHE_KEY("employee", empId), JSON.stringify(cacheForm));
        } catch { }

        localStorage.setItem(COMPLETION_KEY(role), "true");


        // ✅ If editing from dashboard, just go back. Else go to redirect.
        if (isEditMode) navigate(-1);
        else navigate(redirectTo || ROLE_REDIRECTS.employee, { replace: true });
        return;
      }

      // ✅ Approver employee: save to hrmss_employee_profiles (like employee)
      const authCache = readAuthSession();
      const approverEmail = authCache?.email || authCache?.identifier || "";
      const isApproverEmployee = role === "admin" &&
        String(approverEmail).trim().toLowerCase() === "haripriya@twite.ai";

      if (isApproverEmployee) {
        const empId = String(form.employeeId || authCache?.employee_id || "").trim();

        let avatar_url = form.avatar || "";
        if (avatarRemoved) {
          avatar_url = null;
        } else if (avatarFile) {
          avatar_url = await uploadAvatar({ folderKey: empId || approverEmail, file: avatarFile });
        } else {
          if (String(avatar_url).startsWith("blob:")) avatar_url = null;
        }

        const payload = {
          employee_id: empId || null,
          profile_key: empId || approverEmail,
          profile_completed: true,
          full_name: form.fullName || null,
          dob: form.dob || null,
          gender: form.gender || null,
          marital_status: form.maritalStatus || null,
          blood_group: form.bloodGroup || null,
          personal_email: form.personalEmail || null,
          official_email: form.officialEmail || approverEmail || null,
          mobile_number: form.mobileNumber || null,
          alternate_contact_number: form.alternateContactNumber || null,
          current_address: form.currentAddress || null,
          permanent_address: form.permanentAddress || null,
          education: Array.isArray(form.education) ? form.education : [],
          experience: Array.isArray(form.experience) ? form.experience : [],
          primary_skills: form.primarySkills || null,
          secondary_skills: form.secondarySkills || null,
          tools_technologies: form.toolsTechnologies || null,
          account_holder_name: form.accountHolderName || null,
          bank_name: form.bankName || null,
          account_number: form.accountNumber || null,
          ifsc_code: form.ifscCode || null,
          branch: form.branch || null,
          emergency_name: form.emergencyName || null,
          emergency_relationship: form.emergencyRelationship || null,
          emergency_contact_number: form.emergencyContactNumber || null,
          location: form.location || null,
          avatar_url: avatar_url || null,
          total_experience: form.totalExpFrom ? `${form.totalExpFrom} - ${(!form.totalExpTo || form.totalExpPresent) ? "Present" : form.totalExpTo}` : null,
          relevant_experience: form.relevantExpFrom ? `${form.relevantExpFrom} - ${(!form.relevantExpTo || form.relevantExpPresent) ? "Present" : form.relevantExpTo}` : null,
        };

        // Upsert using official_email since approver may not have employee_id yet
        const { error: upErr } = await supabase
          .from("hrmss_employee_profiles")
          .upsert(payload, { onConflict: empId ? "employee_id" : "official_email" });

        if (upErr) throw upErr;

        if (avatar_url && String(form.avatar).startsWith("blob:")) {
          const old = form.avatar;
          onChange("avatar", avatar_url);
          try { URL.revokeObjectURL(old); } catch { }
        }

        localStorage.setItem(COMPLETION_KEY("admin"), "true");

        if (isEditMode) navigate(-1);
        else navigate(redirectTo || ROLE_REDIRECTS.admin, { replace: true });
        return;
      }

      // ✅ Other roles (HR, Admin, etc.)
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user || null;

      const userId = user?.id || authCache?.id || null;

      const userEmail = user?.email || authCache?.email || authCache?.official_email || authCache?.identifier || "";

      if (!userId) {
        navigate("/login", { replace: true, state: { redirectTo: "/sign-in", role } });
        return;
      }

      let avatar_url = form.avatar || "";
      if (avatarRemoved) {
        avatar_url = null;
      } else if (avatarFile) {
        avatar_url = await uploadAvatar({ folderKey: userId, file: avatarFile });
      } else {
        if (String(avatar_url).startsWith("blob:")) avatar_url = null;
      }

      const payload = {
        user_id: userId,
        role,
        profile_key: userEmail || form.employeeId || null,

        employee_id: form.employeeId || null,
        full_name: form.fullName || null,
        dob: form.dob || null,
        gender: form.gender || null,
        marital_status: form.maritalStatus || null,
        blood_group: form.bloodGroup || null,

        personal_email: form.personalEmail || null,
        official_email: userEmail || form.officialEmail || null,
        mobile_number: form.mobileNumber || null,
        alternate_contact_number: form.alternateContactNumber || null,
        current_address: form.currentAddress || null,
        permanent_address: form.permanentAddress || null,
        education: Array.isArray(form.education) ? form.education : [],
        experience: Array.isArray(form.experience) ? form.experience : [],
        primary_skills: form.primarySkills || null,
        secondary_skills: form.secondarySkills || null,
        tools_technologies: form.toolsTechnologies || null,
        account_holder_name: form.accountHolderName || null,
        bank_name: form.bankName || null,
        account_number: form.accountNumber || null,
        ifsc_code: form.ifscCode || null,
        branch: form.branch || null,

        emergency_name: form.emergencyName || null,
        emergency_relationship: form.emergencyRelationship || null,
        emergency_contact_number: form.emergencyContactNumber || null,
        location: form.location || null,
        avatar_url: avatar_url || null,

        // ✅ Job Info columns
        department: form.department || null,
        designation: form.designation || null,
        work_mode: form.workMode || null,
        joining_date: form.joiningDate || null,
        reporting_manager: form.manager || null,

        // ✅ Job Experience columns
        total_experience: form.totalExpFrom ? `${form.totalExpFrom} - ${(!form.totalExpTo || form.totalExpPresent) ? "Present" : form.totalExpTo}` : null,
        relevant_experience: form.relevantExpFrom ? `${form.relevantExpFrom} - ${(!form.relevantExpTo || form.relevantExpPresent) ? "Present" : form.relevantExpTo}` : null,
      };

      const { error: upErr } = await supabase
        .from("hrmss_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (upErr) throw upErr;

      if (avatar_url && String(form.avatar).startsWith("blob:")) {
        const old = form.avatar;
        onChange("avatar", avatar_url);
        try {
          URL.revokeObjectURL(old);
        } catch { }
      }


      try {
        const cacheForm = { ...form, avatar: avatar_url || "" };
        localStorage.setItem(PROFILE_CACHE_KEY(role, userId), JSON.stringify(cacheForm));
      } catch { }

      localStorage.setItem(COMPLETION_KEY(role), "true");


      if (isEditMode) navigate(-1);
      else navigate(redirectTo, { replace: true });

    } catch (e) {
      console.error(e);
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {

    return <Preloader variant="page" message="Fetching Profile Data" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/20 to-slate-50 p-4 md:p-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* TOP BAR */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>

            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {isEditMode ? "Manage Profile" : `${roleLabel} Setup`}
              </h1>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {isEditMode ? "Update your personal and professional records" : "Complete your profile to unlock all features"} •{" "}
                <span className="text-purple-600 font-black">{completeness}% Complete</span>
              </p>

              {error ? (
                <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-2.5 text-xs font-bold text-rose-600 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">

            {!isEditMode && (
              <button
                type="button"
                onClick={() => {
                  if (form.avatar && String(form.avatar).startsWith("blob:")) {
                    try {
                      URL.revokeObjectURL(form.avatar);
                    } catch { }
                  }
                  setAvatarFile(null);
                  setAvatarRemoved(false);
                  setForm((p) => emptyForm(empIdFromLogin, p.officialEmail || ""));
                }}
                className="px-5 py-2.5 rounded-xl border border-rose-200 text-xs font-black text-rose-600 uppercase tracking-widest hover:bg-rose-50 transition-all"
              >
                Reset
              </button>
            )}

            <button
              onClick={saveAndContinue}
              disabled={saving}

              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-700 text-xs font-black text-white uppercase tracking-widest hover:bg-purple-800 shadow-lg shadow-purple-100 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
            >
              <Save size={16} />
              {saving ? "Processing..." : isEditMode ? "Save Changes" : "Finish Setup"}
            </button>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: FORM */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b bg-gradient-to-r from-purple-700 to-indigo-600 text-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/80">

                      {isEditMode ? "Profile Management" : "First Time Setup"}
                    </p>
                    <h2 className="text-lg md:text-xl font-bold leading-tight">
                      {isEditMode ? "Keep your records up to date" : "Complete your profile to continue"}
                    </h2>
                  </div>

                  <div className="hidden md:flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                    <ShieldCheck size={16} />
                    <span className="text-sm font-semibold">Secure</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span>Profile Completion</span>
                    <span className="font-semibold text-white">{completeness}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-white" style={{ width: `${completeness}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 space-y-8">
                <SectionHeader icon={User} title="Personal Information" subtitle="Basic personal details" />

                <div className="flex flex-col md:flex-row gap-6 md:items-center">
                  <div className="relative w-fit">
                    {form.avatar ? (
                      <img
                        src={form.avatar}
                        alt="avatar"
                        className="h-24 w-24 md:h-28 md:w-28 rounded-2xl border object-cover shadow-sm"
                      />
                    ) : (
                      <div className="h-24 w-24 md:h-28 md:w-28 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center shadow-sm">
                        <div className="text-center">
                          <ImagePlus className="mx-auto text-slate-500" size={20} />
                          <p className="mt-1 text-[11px] font-semibold text-slate-600">Add Photo</p>
                        </div>
                      </div>
                    )}

                    <label className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow cursor-pointer border hover:bg-slate-50">
                      <Camera size={16} className="text-slate-700" />
                      <input hidden type="file" accept="image/*" onChange={changeAvatar} />
                    </label>

                    {form.avatar && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="absolute -top-2 -left-2 rounded-xl border bg-white px-2 py-1 text-xs font-semibold text-rose-600 shadow hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      icon={User}
                      label="EMPLOYEE FULL NAME"
                      value={form.fullName}
                      onChange={(v) => onChange("fullName", v)}
                      placeholder="Enter full name"
                      required
                      error={isSubmitted && !form.fullName}
                    />
                    <Input
                      icon={IdCard}
                      label="EMPLOYEE ID (IF APPLICABLE)"
                      value={form.employeeId}
                      onChange={(v) => onChange("employeeId", v)}
                      placeholder="EMP-001"
                      required={role === "employee" || !!empIdFromLogin}
                      error={isSubmitted && (role === "employee" || !!empIdFromLogin) && !form.employeeId}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    icon={CalendarDays}
                    label="DATE OF BIRTH"
                    type="date"
                    value={form.dob}
                    onChange={(v) => onChange("dob", v)}
                    required
                    error={isSubmitted && !form.dob}
                  />
                  <Select
                    icon={User}
                    label="GENDER"
                    value={form.gender}
                    onChange={(v) => onChange("gender", v)}
                    options={["Male", "Female", "Other"]}
                    placeholder="Select Gender"
                    required
                    error={isSubmitted && !form.gender}
                  />
                  <Select
                    icon={HeartPulse}
                    label="MARITAL STATUS"
                    value={form.maritalStatus}
                    onChange={(v) => onChange("maritalStatus", v)}
                    options={["Single", "Married", "Other"]}
                    placeholder="Select Status"
                    required
                    error={isSubmitted && !form.maritalStatus}
                  />
                  <Select
                    icon={HeartPulse}
                    label="BLOOD GROUP"
                    value={form.bloodGroup}
                    onChange={(v) => onChange("bloodGroup", v)}
                    options={["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]}
                    placeholder="Select Blood Group"
                    required
                    error={isSubmitted && !form.bloodGroup}
                  />
                </div>

                <Divider />

                <SectionHeader icon={Briefcase} title="Job Information" subtitle="Current role & employment details" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input icon={Building2} label="DEPARTMENT" value={form.department} onChange={(v) => onChange("department", v)} placeholder="e.g. Technology" />
                  <Input icon={Briefcase} label="DESIGNATION / ROLE" value={form.designation} onChange={(v) => onChange("designation", v)} placeholder="e.g. Senior Admin" />
                  <Input icon={CalendarDays} label="DATE OF JOINING" type="date" value={form.joiningDate} onChange={(v) => onChange("joiningDate", v)} />
                  <Select icon={Sparkles} label="WORK MODE" value={form.workMode} onChange={(v) => onChange("workMode", v)} options={["On-site", "Remote", "Hybrid"]} placeholder="Select Mode" />
                  <Input icon={User} label="REPORTING MANAGER" value={form.manager} onChange={(v) => onChange("manager", v)} placeholder="Manager Name" />
                  <Input icon={MapPin} label="WORK LOCATION" value={form.location} onChange={(v) => onChange("location", v)} placeholder="City / Office" />
                </div>

                <Divider />

                <SectionHeader icon={Briefcase} title="Job Experience" subtitle="Overall work experience details" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Total Work Experience</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="date"
                        label="FROM"
                        value={form.totalExpFrom}
                        onChange={(v) => onChange("totalExpFrom", v)}
                        required
                        error={isSubmitted && !form.totalExpFrom}
                      />
                      <Input type="date" label="TO" value={form.totalExpTo} onChange={(v) => onChange("totalExpTo", v)} />
                    </div>
                    {form.totalExpFrom && (
                      <p className="mt-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={10} />
                        Experience: {calculateExperience(form.totalExpFrom, form.totalExpTo)}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Relevant Work Experience</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="date" label="FROM" value={form.relevantExpFrom} onChange={(v) => onChange("relevantExpFrom", v)} />
                      <Input type="date" label="TO" value={form.relevantExpTo} onChange={(v) => onChange("relevantExpTo", v)} />
                    </div>
                    {form.relevantExpFrom && (
                      <p className="mt-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={10} />
                        Experience: {calculateExperience(form.relevantExpFrom, form.relevantExpTo)}
                      </p>
                    )}
                  </div>
                </div>

                <Divider />
                <SectionHeader icon={Phone} title="Contact Details" subtitle="Email & phone numbers" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    icon={Mail}
                    label="PERSONAL EMAIL ID"
                    value={form.personalEmail}
                    onChange={(v) => onChange("personalEmail", v)}
                    placeholder="name@gmail.com"
                    required
                    error={isSubmitted && !form.personalEmail}
                  />
                  <Input icon={Mail} label="OFFICIAL EMAIL ID" value={form.officialEmail} onChange={(v) => onChange("officialEmail", v)} placeholder="name@company.com" />
                  <PhoneInput
                    label="MOBILE NUMBER"
                    value={form.mobileNumber}
                    onChange={(v) => onChange("mobileNumber", v)}
                    required
                    error={isSubmitted && !form.mobileNumber}
                  />
                  <PhoneInput
                    label="ALTERNATE CONTACT NUMBER"
                    value={form.alternateContactNumber}
                    onChange={(v) => onChange("alternateContactNumber", v)}
                  />
                </div>

                <Divider />
                <SectionHeader icon={Home} title="Address Information" subtitle="Current & permanent address" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Textarea
                    icon={Home}
                    label="CURRENT ADDRESS"
                    value={form.currentAddress}
                    onChange={(v) => onChange("currentAddress", v)}
                    placeholder="Enter current address"
                    required
                    error={isSubmitted && !form.currentAddress}
                  />
                  <Textarea
                    icon={Home}
                    label="PERMANENT ADDRESS"
                    value={form.permanentAddress}
                    onChange={(v) => onChange("permanentAddress", v)}
                    placeholder="Enter permanent address"
                    required
                    error={isSubmitted && !form.permanentAddress}
                  />
                </div>

                <Divider />
                <SectionHeader
                  icon={GraduationCap}
                  title="Educational Qualifications"
                  subtitle="Add your education details"
                  right={
                    <button
                      type="button"
                      onClick={addEducation}
                      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus size={14} /> Add Qualification
                    </button>
                  }
                />

                <div className="space-y-4">
                  {form.education.map((row, idx) => (
                    <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-bold text-slate-900">Qualification #{idx + 1}</p>
                        {form.education.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEducation(idx)}
                            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input icon={GraduationCap} label="QUALIFICATION" value={row.qualification} onChange={(v) => updateEducation(idx, "qualification", v)} placeholder="BSc / MSc / Diploma" />
                        <Input icon={Building2} label="INSTITUTION / UNIVERSITY" value={row.institution} onChange={(v) => updateEducation(idx, "institution", v)} placeholder="University name" />
                        <Input icon={CalendarDays} label="YEAR OF PASSING" value={row.yearOfPassing} onChange={(v) => updateEducation(idx, "yearOfPassing", v)} placeholder="2022" />
                        <Input icon={Sparkles} label="SPECIALIZATION" value={row.specialization} onChange={(v) => updateEducation(idx, "specialization", v)} placeholder="Computer Science" />
                      </div>
                    </div>
                  ))}
                </div>

                <Divider />
                <SectionHeader
                  icon={Briefcase}
                  title="Professional Experience"
                  subtitle="If applicable, add your past experience"
                  right={
                    <button
                      type="button"
                      onClick={addExperience}
                      className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus size={14} /> Add Experience
                    </button>
                  }
                />

                <div className="space-y-4">
                  {form.experience.map((row, idx) => (
                    <div key={idx} className="rounded-2xl border bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-bold text-slate-900">Experience #{idx + 1}</p>
                        {form.experience.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeExperience(idx)}
                            className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input icon={Building2} label="ORGANIZATION" value={row.organization} onChange={(v) => updateExperience(idx, "organization", v)} placeholder="Company name" />
                        <Input icon={Briefcase} label="DESIGNATION" value={row.designation} onChange={(v) => updateExperience(idx, "designation", v)} placeholder="Software Engineer" />

                        <div className="space-y-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500 font-bold">Duration</p>
                          <div className="grid grid-cols-2 gap-3">
                            <Input type="date" label="FROM" value={row.fromDate} onChange={(v) => updateExperience(idx, "fromDate", v)} />
                            <Input type="date" label="TO" value={row.toDate} onChange={(v) => updateExperience(idx, "toDate", v)} />
                          </div>
                          {row.fromDate && (
                            <p className="mt-1 text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                              <Sparkles size={10} />
                              Duration: {calculateExperience(row.fromDate, row.toDate)}
                            </p>
                          )}
                        </div>

                        <Input icon={Sparkles} label="REASON FOR LEAVING" value={row.reasonForLeaving} onChange={(v) => updateExperience(idx, "reasonForLeaving", v)} placeholder="Better opportunity" />
                      </div>
                    </div>
                  ))}
                </div>

                <Divider />
                <SectionHeader icon={Sparkles} title="Skills & Expertise" subtitle="Mention your skills & tools" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input icon={Sparkles} label="PRIMARY SKILLS" value={form.primarySkills} onChange={(v) => onChange("primarySkills", v)} placeholder="React, Node, ..." />
                  <Input icon={Sparkles} label="SECONDARY SKILLS" value={form.secondarySkills} onChange={(v) => onChange("secondarySkills", v)} placeholder="UI/UX, Testing, ..." />
                  <Textarea icon={Sparkles} label="TOOLS / TECHNOLOGIES KNOWN" value={form.toolsTechnologies} onChange={(v) => onChange("toolsTechnologies", v)} placeholder="Git, Docker, Figma, Postman..." />
                </div>

                <Divider />
                <SectionHeader icon={CreditCard} title="Bank & Payroll Details" subtitle="Salary credit details" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    icon={User}
                    label="ACCOUNT HOLDER NAME"
                    value={form.accountHolderName}
                    onChange={(v) => onChange("accountHolderName", v)}
                    placeholder="Name as per bank"
                    required
                    error={isSubmitted && !form.accountHolderName}
                  />
                  <Input
                    icon={Building2}
                    label="BANK NAME"
                    value={form.bankName}
                    onChange={(v) => onChange("bankName", v)}
                    placeholder="Bank name"
                    required
                    error={isSubmitted && !form.bankName}
                  />
                  <Input
                    icon={CreditCard}
                    label="ACCOUNT NUMBER"
                    value={form.accountNumber}
                    onChange={(v) => onChange("accountNumber", v)}
                    placeholder="XXXXXXXXXXXX"
                    required
                    error={isSubmitted && !form.accountNumber}
                  />
                  <Input
                    icon={IdCard}
                    label="IFSC CODE"
                    value={form.ifscCode}
                    onChange={(v) => onChange("ifscCode", v)}
                    placeholder="IFSC0001234"
                    required
                    error={isSubmitted && !form.ifscCode}
                  />
                  <Input
                    icon={MapPin}
                    label="BRANCH"
                    value={form.branch}
                    onChange={(v) => onChange("branch", v)}
                    placeholder="Branch name"
                    required
                    error={isSubmitted && !form.branch}
                  />
                  <Input icon={MapPin} label="WORK LOCATION (OPTIONAL)" value={form.location} onChange={(v) => onChange("location", v)} placeholder="Colombo / Chennai" />
                </div>

                <Divider />
                <SectionHeader icon={HeartPulse} title="Emergency Contact Details" subtitle="Who to contact in emergency" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    icon={User}
                    label="NAME"
                    value={form.emergencyName}
                    onChange={(v) => onChange("emergencyName", v)}
                    placeholder="Contact person name"
                    required
                    error={isSubmitted && !form.emergencyName}
                  />
                  <Input
                    icon={HeartPulse}
                    label="RELATIONSHIP"
                    value={form.emergencyRelationship}
                    onChange={(v) => onChange("emergencyRelationship", v)}
                    placeholder="Father / Mother / Spouse..."
                    required
                    error={isSubmitted && !form.emergencyRelationship}
                  />
                  <PhoneInput
                    label="CONTACT NUMBER"
                    value={form.emergencyContactNumber}
                    onChange={(v) => onChange("emergencyContactNumber", v)}
                    required
                    error={isSubmitted && !form.emergencyContactNumber}
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">


                  <button
                    type="button"
                    onClick={saveAndContinue}
                    disabled={saving}

                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-950 shadow disabled:opacity-60 transition-all active:scale-95"
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : isEditMode ? "Update Profile" : "Finish Setup"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: PREVIEW / SUMMARY */}
          <div className="space-y-6">
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b">
                <h3 className="text-sm font-bold text-slate-900">Preview</h3>
                <p className="text-xs text-slate-500 mt-1">This is how your profile will look</p>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-3">
                  {form.avatar ? (
                    <img src={form.avatar} alt="preview" className="h-12 w-12 rounded-xl border object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                      <ImagePlus size={16} className="text-slate-500" />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{form.fullName || "Your Name"}</p>
                    <p className="text-xs text-slate-500 truncate">{form.employeeId || "EMP-XXX"}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <MiniRow label="Personal Email" value={form.personalEmail} />
                  <MiniRow label="Official Email" value={form.officialEmail} />
                  <MiniRow label="Mobile" value={form.mobileNumber} />

                  <MiniRow label="DOB" value={form.dob ? String(form.dob).split("-").reverse().join("/") : "-"} />
                  <MiniRow label="Gender" value={form.gender} />
                  <MiniRow label="Marital" value={form.maritalStatus} />
                  <MiniRow label="Blood Group" value={form.bloodGroup} />
                  <MiniRow label="Education Rows" value={String(form.education?.length || 0)} />
                  <MiniRow label="Experience Rows" value={String(form.experience?.length || 0)} />
                  <MiniRow label="Total Experience" value={form.totalExpFrom ? calculateExperience(form.totalExpFrom, form.totalExpTo) : "-"} />
                  <MiniRow label="Relevant Experience" value={form.relevantExpFrom ? calculateExperience(form.relevantExpFrom, form.relevantExpTo) : "-"} />
                </div>

                <div className="mt-5 rounded-xl bg-purple-50 border border-purple-100 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles size={16} className="mt-0.5 text-purple-700" />
                    <div>
                      <p className="text-sm font-semibold text-purple-900">Completion Score</p>
                      <p className="text-xs text-purple-800/80 mt-1">
                        Fill remaining fields to reach 100% and unlock all features.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-purple-200 overflow-hidden">
                    <div className="h-full rounded-full bg-purple-700" style={{ width: `${completeness}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE FIXED SAVE */}
        <div className="lg:hidden sticky bottom-3">
          <button
            onClick={saveAndContinue}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-700 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-800 shadow-lg disabled:opacity-60"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI Helpers ---------------- */

function SectionHeader({ icon: Icon, title, subtitle, right }) {
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

function Divider() {
  return <div className="h-px w-full bg-slate-200" />;
}

function PhoneInput({ label, value, onChange, required = false, error = false }) {
  // Parse value: expects "+91 9876543210" or just "9876543210"
  let code = "+91";
  let number = "";

  if (value) {
    if (value.includes(" ")) {
      const parts = value.split(" ");
      code = parts[0];
      number = parts.slice(1).join("");
    } else if (value.startsWith("+")) {
      // heuristic: +9198765...
      code = value.substring(0, 3);
      number = value.substring(3);
    } else {
      number = value;
    }
  }

  // Supported codes
  const codes = ["+91", "+94"];
  if (!codes.includes(code)) code = "+91"; // Default fallback

  const handleCode = (e) => {
    const newCode = e.target.value;
    onChange(`${newCode} ${number}`);
  }

  const handleNumber = (e) => {
    // Only digits, max 10
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    onChange(`${code} ${val}`);
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </p>
      <div className={`group flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition ${error
        ? 'border-rose-300 ring-1 ring-rose-200 focus-within:ring-2 focus-within:ring-rose-200 focus-within:border-rose-400'
        : 'focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-300'
        }`}>

        {/* Country Code Select */}
        <div className="relative flex items-center min-w-[60px] border-r border-slate-200 pr-2 mr-2">
          <select
            value={code}
            onChange={handleCode}
            className="w-full appearance-none bg-transparent text-sm font-semibold text-slate-700 outline-none z-10 cursor-pointer"
          >
            {codes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={12} className="absolute right-0 text-slate-400 pointer-events-none" />
        </div>

        {/* Fixed Icon for Phone */}
        <Phone size={16} className={`shrink-0 transition ${error ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-purple-700'}`} />

        <input
          type="text"
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 bg-transparent font-medium tracking-wide"
          value={number}
          onChange={handleNumber}
          placeholder="1234567890"
        />
      </div>
    </div>
  );
}

function Input({ icon: Icon, label, value, onChange, placeholder, type = "text", disabled = false, required = false, error = false }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </p>
      <div className={`group flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition ${disabled ? 'opacity-50 bg-slate-50'
        : error
          ? 'border-rose-300 ring-1 ring-rose-200 focus-within:ring-2 focus-within:ring-rose-200 focus-within:border-rose-400'
          : 'focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-300'
        }`}>
        {Icon ? (
          <Icon size={16} className={`transition ${disabled ? 'text-slate-400'
            : error ? 'text-rose-400'
              : 'text-slate-400 group-focus-within:text-purple-700'
            }`} />
        ) : null}

        <input
          type={type}
          disabled={disabled}
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 bg-transparent disabled:cursor-not-allowed"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function Select({ icon: Icon, label, value, onChange, options, placeholder, required = false, error = false }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </p>
      <div className={`group flex items-center gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition ${error
        ? 'border-rose-300 ring-1 ring-rose-200 focus-within:ring-2 focus-within:ring-rose-200 focus-within:border-rose-400'
        : 'focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-300'
        }`}>
        {Icon ? <Icon size={16} className={`transition ${error ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-purple-700'}`} /> : null}
        <select
          className="w-full bg-transparent outline-none text-sm text-slate-900"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder || "Select"}</option>
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

function Textarea({ icon: Icon, label, value, onChange, placeholder, required = false, error = false }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">
        {label} {required && <span className="text-rose-500">*</span>}
      </p>
      <div className={`group flex items-start gap-2 rounded-2xl border bg-white px-3 py-2.5 shadow-sm transition ${error
        ? 'border-rose-300 ring-1 ring-rose-200 focus-within:ring-2 focus-within:ring-rose-200 focus-within:border-rose-400'
        : 'focus-within:ring-2 focus-within:ring-purple-200 focus-within:border-purple-300'
        }`}>
        {Icon ? <Icon size={16} className={`mt-0.5 transition ${error ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-purple-700'}`} /> : null}
        <textarea
          className="w-full outline-none text-sm text-slate-900 placeholder:text-slate-400 min-h-[110px] resize-none"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

function MiniRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 text-right" title={value || "-"}>
        {value || "-"}
      </p>
    </div>
  );
}
