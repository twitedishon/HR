import { useEffect, useState } from "react";
import DocumentManager from "../../components/DocumentManager.jsx";
import { supabase } from "../../lib/supabaseClient";

const tabs = [
  { key: "uploads", label: "HR Uploads" },
  { key: "approvals", label: "Team Approval" },
];

export default function HrDocuments() {
  const [active, setActive] = useState("uploads");
  const [pendingCount, setPendingCount] = useState(null);

  useEffect(() => {
    const fetchPending = async () => {
      const { count, error } = await supabase
        .from("hrmss_documents")
        .select("id", { count: "exact", head: true })
        .eq("role", "employee")
        .eq("status", "pending");
      if (!error) setPendingCount(count ?? 0);
    };
    fetchPending();
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        {tabs.map((t) => {
          const activeTab = active === t.key;
          const isApprovals = t.key === "approvals";
          const countBadge = isApprovals && pendingCount != null ? ` (${pendingCount})` : "";
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`px-4 py-2 rounded-full border text-sm font-semibold transition ${activeTab ? "bg-purple-700 text-white border-purple-700" : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              type="button"
            >
              {t.label}
              {countBadge}
            </button>
          );
        })}
      </div>

      {active === "uploads" ? (
        <DocumentManager
          title="HR Uploads"
          accent="purple"
          role="hr"
          mode="user"
          canUpload={true}
          showEmployee={false}
          showStatus={false}
          categoryOptions={[
            "HR Policy",
            "Offer Letter",
            "Appointment Letter",
            "Company Circular",
            "Other",
          ]}
        />
      ) : (
        <DocumentManager
          title="Team Approval"
          subtitle="Review and approve employee documents"
          accent="purple"
          role="hr"
          mode="hr-review"
          canUpload={false}
          showEmployee={true}
          categoryOptions={[
            "All Educational Certificates (PDF)",
            "All Previous Companies Relieving Letters (PDF)",
            "Last 3 Months Pay Slips (PDF - merged or individual)",
            "Current Company Offer Letter (PDF)",
            "Voter ID (PDF / Image)",
            "PAN Card (PDF / Image)",
            "Passport Size Photograph (JPG / PNG)",
            "Aadhaar Card (PDF / Image - Mask Aadhaar number if required)",
            "Last Three Months Bank Statements (PDF)",
            "Other",
          ]}
        />
      )}
    </div>
  );
}
