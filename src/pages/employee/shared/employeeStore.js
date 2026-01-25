import { useEffect, useMemo, useState } from "react";

const LS_KEY = "HRMS_EMP_DASH_LEAVE_DOC_NOTIF_V1";

const seed = {
  employee: {
    id: "EMP-001",
    name: "Priya Sharma",
    role: "Senior HR Executive",
    dept: "HR",
  },

  leaveBalance: [
    { label: "Casual", value: 6, hint: "remaining", tone: "success" },
    { label: "Sick", value: 4, hint: "remaining", tone: "info" },
    { label: "Annual", value: 12, hint: "remaining", tone: "purple" },
  ],

  leaveRequests: [
    {
      id: "LR-2001",
      type: "Casual Leave",
      from: "2025-12-15",
      to: "2025-12-16",
      days: 2,
      status: "Pending",
      reason: "Family function",
      appliedAtISO: "2025-12-12T09:10:00",
    },
    {
      id: "LR-2002",
      type: "Sick Leave",
      from: "2025-12-10",
      to: "2025-12-10",
      days: 1,
      status: "Approved",
      reason: "Fever",
      appliedAtISO: "2025-12-10T11:30:00",
    },
  ],

  documents: {
    myDocs: [
      {
        id: "DOC-101",
        name: "Offer_Letter.pdf",
        category: "HR",
        uploadedAtISO: "2025-12-01T09:00:00",
        sizeLabel: "220 KB",
        expiryISO: "",
      },
      {
        id: "DOC-102",
        name: "ID_Proof.png",
        category: "KYC",
        uploadedAtISO: "2025-11-28T15:10:00",
        sizeLabel: "410 KB",
        expiryISO: "2026-01-05",
      },
    ],
    companyDocs: [
      {
        id: "CDOC-201",
        name: "Leave_Policy_2025.pdf",
        category: "Policy",
        uploadedAtISO: "2025-10-02T10:00:00",
        sizeLabel: "350 KB",
      },
      {
        id: "CDOC-202",
        name: "Holiday_List_2025.pdf",
        category: "Calendar",
        uploadedAtISO: "2025-01-01T08:00:00",
        sizeLabel: "190 KB",
      },
    ],
  },


  notifications: [],
};

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw);
    return { ...seed, ...parsed };
  } catch {
    return seed;
  }
}

function save(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function useEmployeeDashboard() {
  const [data, setData] = useState(() => load());
  const [activeAction, setActiveAction] = useState(null);

  useEffect(() => {
    save(data);
  }, [data]);

  const view = useMemo(() => {
    const unread = (data.notifications || []).filter((n) => !n.read).length;

    // expiry alerts = myDocs with expiry within next 30 days
    const now = new Date();
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);

    const expiring = (data.documents?.myDocs || []).filter((d) => {
      if (!d.expiryISO) return false;
      const dt = new Date(d.expiryISO);
      return dt >= now && dt <= in30;
    });

    return {
      unreadCount: unread,
      expiringCount: expiring.length,
      expiringDocs: expiring,
    };
  }, [data]);

  const actions = {
    openAction: (payload) => setActiveAction(payload),
    closeAction: () => setActiveAction(null),

    // Leave
    submitLeave: ({ type, from, to, reason }) => {
      const f = new Date(from);
      const t = new Date(to);
      const ms = t - f;
      const days = Number.isFinite(ms) ? Math.max(1, Math.round(ms / 86400000) + 1) : 1;

      const req = {
        id: uid("LR"),
        type,
        from,
        to,
        days,
        status: "Pending",
        reason: reason || "-",
        appliedAtISO: new Date().toISOString(),
      };

      setData((prev) => ({
        ...prev,
        leaveRequests: [req, ...(prev.leaveRequests || [])],
      }));
    },

    cancelLeave: (id) => {
      setData((prev) => ({
        ...prev,
        leaveRequests: (prev.leaveRequests || []).map((r) =>
          r.id === id && r.status === "Pending" ? { ...r, status: "Cancelled" } : r
        ),
      }));
    },

    // Documents
    uploadDoc: ({ fileName, category, expiryISO }) => {
      const doc = {
        id: uid("DOC"),
        name: fileName || "New_Document.pdf",
        category: category || "Other",
        uploadedAtISO: new Date().toISOString(),
        sizeLabel: "—",
        expiryISO: expiryISO || "",
      };

      setData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          myDocs: [doc, ...(prev.documents?.myDocs || [])],
        },
      }));
    },

    deleteMyDoc: (id) => {
      setData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          myDocs: (prev.documents?.myDocs || []).filter((d) => d.id !== id),
        },
      }));
    },

    // Notifications
    markRead: (id) => {
      setData((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      }));
    },

    dismissNotif: (id) => {
      setData((prev) => ({
        ...prev,
        notifications: (prev.notifications || []).filter((n) => n.id !== id),
      }));
    },

    resetDemo: () => {
      setData(seed);
      setActiveAction(null);
    },
  };

  return { data, view, actions, activeAction };
}
