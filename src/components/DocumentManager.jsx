// src/components/DocumentManager.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud,
  Download,
  Eye,
  Grid,
  List,
  Search,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock3,
  Check,
  X,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { ensureRoleAuthSession } from "../lib/employeeAuthBridge";

/* ===================== CONFIG ===================== */
const DOCS_TABLE = "hrmss_documents";
const BUCKET = "hrmss-documents";
const ALLOWED_ROLES = new Set(["admin", "employee", "hr", "manager", "admin-head"]);
const AUTH_KEY = "HRMSS_AUTH_SESSION";
const LEGACY_EMP_SIGNIN_KEY = "hrmss.employee.signin";
const DOCS_AUTH_KEY = "HRMSS_DOCS_AUTH";
const OFFLINE_DOCS_PREFIX = "HRMSS_DOCS_OFFLINE";
const OFFLINE_MAX_BYTES = 4 * 1024 * 1024;

const STATUS_STYLES = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200",
};

/* ===================== HELPERS ===================== */
const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(val >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const determineDocType = (fileName = "", mimeType = "") => {
  const lowerName = (fileName || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();
  if (lowerMime.includes("pdf") || lowerName.endsWith(".pdf")) return "PDF";
  if (lowerMime.includes("image") || lowerName.match(/\.(png|jpg|jpeg|webp|gif)$/)) return "IMAGE";
  if (lowerMime.includes("word") || lowerName.match(/\.(doc|docx)$/)) return "WORD";
  if (lowerMime.includes("excel") || lowerName.match(/\.(xls|xlsx|csv)$/)) return "EXCEL";
  return "FILE";
};

const badgeColor = (type) => {
  if (type === "PDF") return "bg-rose-50 text-rose-700";
  if (type === "IMAGE") return "bg-blue-50 text-blue-700";
  if (type === "WORD") return "bg-indigo-50 text-indigo-700";
  if (type === "EXCEL") return "bg-emerald-50 text-emerald-700";
  return "bg-gray-100 text-gray-700";
};

const statusBadge = (status) => STATUS_STYLES[status] || "bg-slate-100 text-slate-600 border border-slate-200";

const accentMap = {
  blue: {
    solid: "bg-blue-600 text-white",
    hover: "hover:bg-blue-700",
    subtle: "text-blue-700",
    border: "hover:border-blue-500",
  },
  purple: {
    solid: "bg-purple-700 text-white",
    hover: "hover:bg-purple-800",
    subtle: "text-purple-700",
    border: "hover:border-purple-500",
  },
  slate: {
    solid: "bg-slate-900 text-white",
    hover: "hover:bg-black",
    subtle: "text-slate-800",
    border: "hover:border-slate-500",
  },
};

const safeFileName = (name = "file") => {
  const n = name.replace(/[^\w.\-() ]+/g, "_").trim();
  return n.length ? n : "file";
};

const must = (v, msg) => {
  if (!v) throw new Error(msg);
  return v;
};

const DOCUMENT_BRIDGE_SIGNATURE = "supabase auth bridge failed";
const DOCUMENT_BRIDGE_FRIENDLY =
  "Switched to offline mode for documents (saved locally in this browser).";

const getDocumentErrorMessage = (error, fallback) => {
  const raw = String(error?.message || error || "").trim();
  const defaultMsg = String(fallback || "Something went wrong").trim() || "Something went wrong";
  if (raw) {
    if (raw.toLowerCase().includes(DOCUMENT_BRIDGE_SIGNATURE)) {
      const base = defaultMsg.endsWith(".") ? defaultMsg : `${defaultMsg}.`;
      return `${base} ${DOCUMENT_BRIDGE_FRIENDLY}`;
    }
    return raw;
  }
  return defaultMsg;
};

const isRlsDenied = (error) => {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "42501" || code === "401" || msg.includes("row-level security") || msg.includes("unauthorized");
};

const stringToUuid = (input) => {
  const s = String(input || "fallback");
  let h1 = 0x811c9dc5;
  let h2 = 0xc9dc5118;
  let h3 = 0x1c9dc511;
  let h4 = 0x5118c9dc;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x1000193);
    h2 = Math.imul(h2 ^ ch, 0x10001b3);
    h3 = Math.imul(h3 ^ ch, 0x1000163);
    h4 = Math.imul(h4 ^ ch, 0x1000133);
  }
  const hex = (n) => ("00000000" + (n >>> 0).toString(16)).slice(-8);
  const str = hex(h1) + hex(h2) + hex(h3) + hex(h4);
  return `${str.slice(0, 8)}-${str.slice(8, 12)}-${str.slice(12, 16)}-${str.slice(16, 20)}-${str.slice(20, 32)}`;
};

const safeStorageKey = (value) => String(value || "").replace(/[^\w.-]+/g, "_");

const buildOfflineKey = ({ roleKey, userKey, mode }) => {
  const r = safeStorageKey(roleKey || "unknown");
  const u = safeStorageKey(userKey || "anonymous");
  const m = safeStorageKey(mode || "user");
  return `${OFFLINE_DOCS_PREFIX}.${m}.${r}.${u}`;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const readAuthCache = () => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readLegacyEmployeeSignin = () => {
  try {
    const raw = localStorage.getItem(LEGACY_EMP_SIGNIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readDocsAuth = () => {
  try {
    const raw = sessionStorage.getItem(DOCS_AUTH_KEY) || localStorage.getItem(DOCS_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const resolveEffectiveRole = ({ roleProp, authCache } = {}) => {
  const r = String(roleProp || authCache?.loginRole || authCache?.role || "").trim().toLowerCase();
  return r || "";
};

const resolveEmployeeId = ({ authCache, legacyEmployeeSignin } = {}) => {
  const empId = String(
    authCache?.employee_id ||
    authCache?.employeeId ||
    authCache?.empId ||
    authCache?.identifier ||
    authCache?.id ||
    legacyEmployeeSignin?.employee_id ||
    legacyEmployeeSignin?.employeeId ||
    legacyEmployeeSignin?.empId ||
    legacyEmployeeSignin?.identifier ||
    legacyEmployeeSignin?.id ||
    ""
  ).trim();
  return empId || "";
};

const resolvePreferredEmail = ({ authCache, legacyEmployeeSignin } = {}) => {
  const email = String(
    authCache?.officialEmail ||
    authCache?.official_email ||
    authCache?.email ||
    legacyEmployeeSignin?.officialEmail ||
    legacyEmployeeSignin?.official_email ||
    legacyEmployeeSignin?.email ||
    ""
  ).trim();
  return email || undefined;
};

const isBridgeFailure = (error) =>
  String(error?.message || error || "")
    .toLowerCase()
    .includes(DOCUMENT_BRIDGE_SIGNATURE);

/* ===================== COMPONENT ===================== */
export default function DocumentManager({
  title = "Documents",
  subtitle,
  accent = "blue",
  role,
  canUpload = true,
  allowAnonymous = false,
  userIdOverride = null,
  categoryOptions = [
    "Offer Letter",
    "Payslip",
    "Appointment Letter",
    "HR Policy",
    "Other",
  ],
  mode = "user", // "user" | "hr-review"
  showEmployee = false,
}) {
  const theme = accentMap[accent] || accentMap.blue;
  const fileRef = useRef(null);
  const bridgeInProgress = useRef(false);

  const [docs, setDocs] = useState([]);
  const [docTitle, setDocTitle] = useState("");
  const [category, setCategory] = useState(categoryOptions?.[0] || "Other");
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("table");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);

  const [statusFilter, setStatusFilter] = useState(mode === "hr-review" ? "pending" : "all");
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedAction, setSelectedAction] = useState(null); // "approved" | "rejected"

  const pageRole = String(role || "").trim().toLowerCase();
  const normalizedPageRole = ALLOWED_ROLES.has(pageRole) ? pageRole : null;

  const getOfflineStorageKey = () => {
    const authCache = readAuthCache();
    const legacyEmployeeSignin = readLegacyEmployeeSignin();
    const docsAuth = readDocsAuth();

    const roleKey =
      normalizedPageRole ||
      resolveEffectiveRole({ roleProp: role || docsAuth?.role, authCache }) ||
      role ||
      docsAuth?.role ||
      "unknown";

    const userKey =
      userIdOverride ||
      resolveEmployeeId({ authCache, legacyEmployeeSignin }) ||
      authCache?.user_id ||
      authCache?.userId ||
      authCache?.id ||
      docsAuth?.identifier ||
      docsAuth?.email ||
      "anonymous";

    return buildOfflineKey({ roleKey, userKey, mode });
  };

  const readOfflineDocs = () => {
    try {
      const raw = localStorage.getItem(getOfflineStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const writeOfflineDocs = (rows) => {
    try {
      localStorage.setItem(getOfflineStorageKey(), JSON.stringify(rows || []));
    } catch { }
  };

  const resetUploadForm = () => {
    setDocTitle("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadOfflineDoc = async (userIdHint) => {
    if (file.size > OFFLINE_MAX_BYTES) {
      throw new Error(
        `Offline mode supports files up to ${Math.round(OFFLINE_MAX_BYTES / (1024 * 1024))}MB.`
      );
    }

    const localDataUrl = await fileToDataUrl(file);
    const stamp = Date.now();
    const fileName = safeFileName(file.name);
    const offlineId = stringToUuid(`${stamp}.${fileName}.${docTitle.trim()}`);
    const isEmployee = normalizedPageRole === "employee";

    const offlineRow = {
      id: offlineId,
      user_id: userIdHint || userIdOverride || "offline",
      role: normalizedPageRole || role || "unknown",
      title: docTitle.trim(),
      category,
      file_name: fileName,
      mime_type: file.type || null,
      size_bytes: file.size ?? null,
      bucket: null,
      storage_path: null,
      status: isEmployee ? "pending" : "approved",
      submitted_at: new Date().toISOString(),
      reviewed_at: isEmployee ? null : new Date().toISOString(),
      reviewed_by: isEmployee ? null : (userIdHint || userIdOverride || null),
      review_note: isEmployee ? null : "Offline upload",
      created_at: new Date().toISOString(),
      local_data_url: localDataUrl,
    };

    const next = [offlineRow, ...(readOfflineDocs() || [])];
    writeOfflineDocs(next);
    setDocs(next.map(mapOfflineRowToUi));
    resetUploadForm();
    setErrMsg("Uploaded offline. Sync will resume once Supabase is available.");
  };

  /* ---------- AUTH: ensure Supabase session (employee bridge) ---------- */
  const ensureDocsAuthSession = async () => {
    const { data: sess, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw sessErr;
    if (sess?.session?.user?.id) return sess.session.user;

    if (bridgeInProgress.current) return null;

    const authCache = readAuthCache();
    const legacyEmployeeSignin = readLegacyEmployeeSignin();
    const docsAuth = readDocsAuth();

    const effectiveRole = resolveEffectiveRole({ roleProp: role || docsAuth?.role, authCache });
    if (!ALLOWED_ROLES.has(effectiveRole)) return null;

    const identifier =
      effectiveRole === "employee"
        ? resolveEmployeeId({ authCache, legacyEmployeeSignin }) || String(docsAuth?.identifier || docsAuth?.email || "").trim()
        : String(
          authCache?.user_id ||
          authCache?.userId ||
          authCache?.id ||
          authCache?.identifier ||
          authCache?.email ||
          docsAuth?.identifier ||
          docsAuth?.email ||
          ""
        ).trim();

    if (!identifier) return null;

    const preferredEmail =
      resolvePreferredEmail({ authCache, legacyEmployeeSignin }) ||
      String(docsAuth?.preferredEmail || docsAuth?.email || "").trim() ||
      undefined;

    const password = docsAuth?.password ? String(docsAuth.password) : undefined;

    try {
      bridgeInProgress.current = true;
      await ensureRoleAuthSession({
        role: effectiveRole,
        identifier,
        preferredEmail,
        password,
        allowSignup: true,
      });
    } finally {
      bridgeInProgress.current = false;
    }

    const { data: sess2, error: sess2Err } = await supabase.auth.getSession();
    if (sess2Err) throw sess2Err;
    return sess2?.session?.user || null;
  };

  const getAuthedUser = async () => {
    const user = await ensureDocsAuthSession();
    if (user?.id) return user;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session?.user || null;
  };

  /* ---------- LOAD DOCS ---------- */
  const loadDocs = async () => {
    try {
      setErrMsg("");
      setLoading(true);
      setOfflineMode(false);

      if (!isSupabaseConfigured) {
        setOfflineMode(true);
        const offlineRows = readOfflineDocs();
        setDocs((offlineRows || []).map(mapOfflineRowToUi));
        setErrMsg("Supabase not configured. Working in offline mode for documents.");
        return;
      }

      const authed = await getAuthedUser();
      if (!authed?.id) {
        if (allowAnonymous) {
          setOfflineMode(true);
          const offlineRows = readOfflineDocs();
          setDocs((offlineRows || []).map(mapOfflineRowToUi));
          setErrMsg("Using offline mode for documents (saved locally in this browser).");
          return;
        }
        setDocs([]);
        setErrMsg("Please login (Supabase Auth) to view documents.");
        return;
      }

      let q = supabase.from(DOCS_TABLE).select("*").order("created_at", { ascending: false });

      if (mode === "hr-review") {
        q = q.eq("role", "employee");
        if (statusFilter !== "all") q = q.eq("status", statusFilter);
      } else {
        // For employees, use employee_id instead of auth user.id
        // because all employees share the same bridged auth session
        const authCache = readAuthCache();
        const legacyEmployeeSignin = readLegacyEmployeeSignin();
        const empId = resolveEmployeeId({ authCache, legacyEmployeeSignin });

        const queryUserId = (normalizedPageRole === "employee" && empId) ? empId : authed.id;
        q = q.eq("user_id", queryUserId);
        if (normalizedPageRole) q = q.eq("role", normalizedPageRole);
      }

      const { data, error } = await q;
      if (error) throw error;

      let employeeMap = {};

      if (mode === "hr-review") {
        const empIds = [
          ...new Set((data || []).map((r) => r.user_id).filter(Boolean)),
        ];
        if (empIds.length) {
          const { data: empRows, error: empErr } = await supabase
            .from("hrmss_employees")
            .select("employee_id, full_name, email")
            .in("employee_id", empIds);
          if (empErr) throw empErr;
          employeeMap = Object.fromEntries(
            (empRows || []).map((r) => [
              r.employee_id,
              `${r.full_name || r.employee_id || ""}${r.email ? ` (${r.email})` : ""}`,
            ])
          );
        }
      }

      setDocs(
        (data || []).map((row) =>
          mapRowToUi(
            {
              ...row,
              employeeDisplay: employeeMap[row.user_id],
            }
          )
        )
      );
    } catch (e) {
      console.error("loadDocs error:", e);
      if (isBridgeFailure(e) || allowAnonymous) {
        setOfflineMode(true);
        const offlineRows = readOfflineDocs();
        setDocs((offlineRows || []).map(mapOfflineRowToUi));
        setErrMsg(getDocumentErrorMessage(e, "Failed to load documents"));
      } else {
        setDocs([]);
        if (isRlsDenied(e)) {
          setErrMsg("Access denied by RLS. Please ensure you are signed in.");
        } else {
          setErrMsg(getDocumentErrorMessage(e, "Failed to load documents"));
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (bridgeInProgress.current) return;
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        loadDocs();
      }
    });
    const authSub = data.subscription;

    const channel = supabase
      .channel("hrmss_documents_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: DOCS_TABLE }, () => {
        if (bridgeInProgress.current) return;
        loadDocs();
      })
      .subscribe();

    return () => {
      try {
        authSub?.unsubscribe();
      } catch { }
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, mode]);

  /* ---------- UPLOAD ---------- */
  const pickFile = (e) => {
    if (!canUpload || mode === "hr-review") return;
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!docTitle) setDocTitle(f.name.replace(/\.[^/.]+$/, ""));
  };

  const upload = async () => {
    if (!canUpload || mode === "hr-review") {
      alert("Uploads are disabled.");
      return;
    }

    try {
      setErrMsg("");
      if (!file || !docTitle.trim()) return alert("Title & file required");
      setBusy(true);

      if (offlineMode || !isSupabaseConfigured) {
        await uploadOfflineDoc(userIdOverride);
        return;
      }

      let user = null;
      try {
        user = await getAuthedUser();
      } catch (authErr) {
        if (allowAnonymous || isBridgeFailure(authErr)) {
          setOfflineMode(true);
          const offlineRows = readOfflineDocs();
          setDocs((offlineRows || []).map(mapOfflineRowToUi));
          setErrMsg(getDocumentErrorMessage(authErr, "Failed to upload document"));
          return;
        }
        throw authErr;
      }

      const shouldOfflineUpload = allowAnonymous && !user?.id;
      if (shouldOfflineUpload) {
        await uploadOfflineDoc(user?.id);
        return;
      }

      if (!user?.id) {
        setErrMsg("Please sign in (Supabase Auth) to upload documents.");
        setBusy(false);
        return;
      }

      must(normalizedPageRole, "Role missing/invalid. Cannot upload without role.");

      // For employees, use employee_id as user_id so each employee has unique documents
      const authCache = readAuthCache();
      const legacyEmployeeSignin = readLegacyEmployeeSignin();
      const empId = resolveEmployeeId({ authCache, legacyEmployeeSignin });

      const isEmployee = normalizedPageRole === "employee";
      const userId = (isEmployee && empId) ? empId : user.id;

      const fileName = safeFileName(file.name);
      const stamp = Date.now();
      const storagePath = `${userId}/${stamp}_${fileName}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const payload = {
        user_id: userId,
        role: normalizedPageRole,
        title: docTitle.trim(),
        category,
        file_name: fileName,
        mime_type: file.type || null,
        size_bytes: file.size ?? null,
        bucket: BUCKET,
        storage_path: storagePath,
        status: isEmployee ? "pending" : "approved",
        submitted_at: new Date().toISOString(),
        reviewed_at: isEmployee ? null : new Date().toISOString(),
        reviewed_by: isEmployee ? null : userId,
        review_note: isEmployee ? null : "Auto-approved HR upload",
      };

      const { data: inserted, error: insErr } = await supabase
        .from(DOCS_TABLE)
        .insert(payload)
        .select("*")
        .single();

      if (insErr) {
        await supabase.storage.from(BUCKET).remove([storagePath]);
        throw insErr;
      }

      setDocs((p) => [mapRowToUi(inserted), ...p]);
      resetUploadForm();
      alert("Document uploaded!");
    } catch (e) {
      console.error("upload error:", e);
      setErrMsg(getDocumentErrorMessage(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- VIEW / DOWNLOAD ---------- */
  const openSignedUrl = async (doc, mode = "view") => {
    try {
      setErrMsg("");
      setBusy(true);

      if (doc?.localDataUrl) {
        window.open(doc.localDataUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const user = await getAuthedUser();
      must(user?.id, "Please login (Supabase Auth) to access documents.");

      const { data, error } = await supabase.storage
        .from(doc.bucket || BUCKET)
        .createSignedUrl(doc.storagePath, 60 * 10);

      if (error) throw error;
      const url = data?.signedUrl;
      must(url, "Failed to generate URL");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("signed url error:", e);
      setErrMsg(getDocumentErrorMessage(e, "Failed to open file"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- DELETE (employee only, pending) ---------- */
  const remove = async (doc) => {
    if (mode === "hr-review") return;
    if (doc.status && doc.status !== "pending") return;
    const ok = window.confirm("Delete this document?");
    if (!ok) return;

    try {
      setErrMsg("");
      setBusy(true);

      if (offlineMode || doc?.localOnly) {
        const next = (readOfflineDocs() || []).filter((d) => String(d.id) !== String(doc.id));
        writeOfflineDocs(next);
        setDocs(next.map(mapOfflineRowToUi));
        return;
      }

      const user = await getAuthedUser();
      must(user?.id, "Please login (Supabase Auth) to delete documents.");

      const { error: delErr } = await supabase.from(DOCS_TABLE).delete().eq("id", doc.id);
      if (delErr) throw delErr;

      const { error: stoErr } = await supabase.storage
        .from(doc.bucket || BUCKET)
        .remove([doc.storagePath]);
      if (stoErr) console.warn("storage remove error:", stoErr);

      setDocs((p) => p.filter((d) => d.id !== doc.id));
    } catch (e) {
      console.error("remove error:", e);
      setErrMsg(getDocumentErrorMessage(e, "Delete failed"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- HR REVIEW UPDATE ---------- */
  const updateStatus = async (docId, nextStatus, note) => {
    if (mode !== "hr-review") return;
    try {
      setBusy(true);
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const uid = userData?.user?.id;
      must(uid, "No auth user");

      const { error } = await supabase
        .from(DOCS_TABLE)
        .update({
          status: nextStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: uid,
          review_note: note || null,
        })
        .eq("id", docId);
      if (error) throw error;
      setNoteModalOpen(false);
      setNoteText("");
      setSelectedDoc(null);
      setSelectedAction(null);
      await loadDocs();
    } catch (e) {
      console.error("update status error:", e);
      setErrMsg(getDocumentErrorMessage(e, "Failed to update status"));
    } finally {
      setBusy(false);
    }
  };

  /* ---------- FILTER ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = docs;
    if (q) {
      list = list.filter((d) => `${d.title} ${d.fileName}`.toLowerCase().includes(q));
    }
    return list;
  }, [docs, search]);

  const StatusBadge = ({ status }) => (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${statusBadge(status)}`}>
      {status === "pending" ? <Clock3 size={12} /> : null}
      {status === "approved" ? <CheckCircle2 size={12} /> : null}
      {status === "rejected" ? <XCircle size={12} /> : null}
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "-"}
    </span>
  );

  const renderActions = (d) => {
    if (mode === "hr-review") {
      return (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedDoc(d);
              setSelectedAction("approved");
              setNoteModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            disabled={busy || d.status !== "pending"}
            title={d.status !== "pending" ? "Already reviewed" : undefined}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDoc(d);
              setSelectedAction("rejected");
              setNoteModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs rounded-lg border bg-rose-50 text-rose-700 hover:bg-rose-100"
            disabled={busy || d.status !== "pending"}
            title={d.status !== "pending" ? "Already reviewed" : undefined}
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => openSignedUrl(d, "view")}
            className="hover:opacity-80"
            title="View"
            disabled={busy}
          >
            <Eye size={16} />
          </button>
          <button
            type="button"
            onClick={() => openSignedUrl(d, "download")}
            className="hover:opacity-80"
            title="Download"
            disabled={busy}
          >
            <Download size={16} />
          </button>
        </div>
      );
    }

    return (
      <div className="flex justify-end gap-3">
        <button type="button" onClick={() => openSignedUrl(d, "view")} className="hover:opacity-80" title="View" disabled={busy}>
          <Eye size={16} />
        </button>
        <button type="button" onClick={() => openSignedUrl(d, "download")} className="hover:opacity-80" title="Download" disabled={busy}>
          <Download size={16} />
        </button>
        {d.status === "pending" && (
          <button type="button" onClick={() => remove(d)} className="hover:opacity-80" title="Delete" disabled={busy}>
            <Trash2 size={16} className="text-rose-600" />
          </button>
        )}
      </div>
    );
  };

  /* ---------- UI ---------- */
  return (
    <section className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("table")}
            className={`p-2 rounded-lg border ${view === "table" ? theme.solid : "bg-white"} ${theme.hover}`}
            aria-label="Table view"
            type="button"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`p-2 rounded-lg border ${view === "grid" ? theme.solid : "bg-white"} ${theme.hover}`}
            aria-label="Grid view"
            type="button"
          >
            <Grid size={16} />
          </button>
        </div>
      </div>

      {mode === "hr-review" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {["pending", "approved", "rejected", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${statusFilter === s ? `${theme.solid} ${theme.hover}` : "bg-white hover:bg-gray-50"
                }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

      {errMsg ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5" />
          <div className="min-w-0">{errMsg}</div>
        </div>
      ) : null}

      {mode !== "hr-review" && canUpload ? (
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div
            onClick={() => canUpload && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition ${theme.border} ${canUpload ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
              }`}
          >
            <UploadCloud className={`mx-auto ${theme.subtle}`} />
            <p className="font-semibold mt-2">Click to upload document</p>
            <p className="text-xs text-gray-500">PDF, Image, Word, Excel</p>
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between bg-gray-50 p-3 rounded-xl">
              <div>
                <div className="font-medium">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {formatBytes(file.size)} • {determineDocType(file.name, file.type)}
                </div>
              </div>
              <button onClick={() => setFile(null)} className="text-xs underline" type="button">
                Remove
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Document title"
              className="rounded-xl border px-3 py-2 text-sm"
            />

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              {categoryOptions.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <button
              onClick={upload}
              disabled={busy || !canUpload}
              className={`rounded-xl ${theme.solid} font-semibold text-sm ${theme.hover} px-4 py-2.5 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed`}
              type="button"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Upload Document
            </button>
          </div>

          <input
            type="file"
            ref={fileRef}
            className="hidden"
            onChange={pickFile}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.csv"
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Search size={16} className="text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="w-full md:w-72 rounded-xl border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={loadDocs}
          className="ml-auto text-xs px-3 py-2 rounded-xl border bg-white hover:bg-gray-50"
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading documents...
        </div>
      ) : view === "table" ? (
        <div className="bg-white rounded-2xl border overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left">Document</th>
                <th className="px-4 py-3">Category</th>
                {showEmployee && <th className="px-4 py-3">Employee</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Size</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showEmployee ? 6 : 5} className="text-center py-10 text-gray-500">
                    No documents found
                  </td>
                </tr>
              )}

              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor(d.type)}`}>
                        {d.type}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold">{d.title}</div>
                        <div className="text-xs text-gray-500 truncate">{d.fileName}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{d.date}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{d.category}</td>
                  {showEmployee && <td className="px-4 py-3 text-xs text-slate-700">{d.employee || "-"}</td>}
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3">{formatBytes(d.size)}</td>
                  <td className="px-4 py-3">{renderActions(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">No documents found</div>
          ) : null}

          {filtered.map((d) => (
            <div key={d.id} className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor(d.type)}`}>
                  {d.type}
                </span>
                <StatusBadge status={d.status} />
              </div>
              <h3 className="font-semibold truncate">{d.title}</h3>
              {showEmployee ? (
                <p className="text-[11px] text-slate-600 mt-1">Employee: {d.employee || "-"}</p>
              ) : null}
              <p className="text-xs text-gray-500 truncate">{d.fileName}</p>
              <p className="text-xs mt-1">{formatBytes(d.size)}</p>
              <p className="text-[11px] text-gray-400 mt-2">{d.date}</p>

              <div className="flex justify-end gap-3 mt-4">{renderActions(d)}</div>
            </div>
          ))}
        </div>
      )}

      {/* <p className="text-xs text-gray-400">
        {offlineMode
          ? "Offline mode enabled. Documents are stored locally in this browser."
          : "Connected to Supabase (Storage + DB). Users will see only their own documents (RLS) + role-based access."}
      </p> */}

      {noteModalOpen && selectedDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNoteModalOpen(false)}>
          <div
            className="bg-white rounded-2xl p-4 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Reviewing</p>
                <p className="font-semibold text-slate-900 truncate">{selectedDoc.title}</p>
              </div>
              <button onClick={() => setNoteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note (optional)"
              className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
              rows={3}
            />

            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setNoteModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border bg-white hover:bg-gray-50"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={() => updateStatus(selectedDoc.id, selectedAction, noteText)}
                className={`px-3 py-1.5 text-xs rounded-lg border font-semibold ${selectedAction === "approved"
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                type="button"
                disabled={busy}
              >
                {selectedAction === "approved" ? "Confirm Approve" : "Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===================== MAPPER ===================== */
function mapRowToUi(r) {
  const fileName = r.file_name || "";
  const type = determineDocType(fileName, r.mime_type);
  const dt = r.created_at ? new Date(r.created_at) : null;

  return {
    id: r.id,
    title: r.title,
    category: r.category,
    fileName,
    size: r.size_bytes ?? null,
    type,
    bucket: r.bucket,
    storagePath: r.storage_path,
    date: dt ? dt.toLocaleString() : "-",
    status: r.status || "pending",
    employee: r.user_id || "",
    employeeDisplay: r.employeeDisplay || r.user_id || "",
    review_note: r.review_note || "",
    reviewed_at: r.reviewed_at || null,
    localDataUrl: null,
    localOnly: false,
  };
}

function mapOfflineRowToUi(r) {
  const fileName = r.file_name || r.fileName || "";
  const type = determineDocType(fileName, r.mime_type || r.mimeType);
  const dt = r.created_at ? new Date(r.created_at) : r.createdAt ? new Date(r.createdAt) : null;

  return {
    id: r.id,
    title: r.title || fileName || "Document",
    category: r.category || "Other",
    fileName,
    size: r.size_bytes ?? r.size ?? null,
    type,
    bucket: r.bucket || null,
    storagePath: r.storage_path || null,
    date: dt ? dt.toLocaleString() : "-",
    status: r.status || "pending",
    employee: r.user_id || "",
    employeeDisplay: r.employeeDisplay || r.user_id || "",
    review_note: r.review_note || "",
    reviewed_at: r.reviewed_at || null,
    localDataUrl: r.local_data_url || r.localDataUrl || null,
    localOnly: true,
  };
}
