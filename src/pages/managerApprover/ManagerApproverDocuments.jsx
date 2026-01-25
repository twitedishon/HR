
import { useEffect, useState } from "react";
import DocumentManager from "../../components/DocumentManager.jsx";
import { supabase } from "../../lib/supabaseClient";
import { getManagerSession } from "./managerApproverData";

export default function ManagerApproverDocuments() {
  const session = getManagerSession();
  const [authUserId, setAuthUserId] = useState(null);

  useEffect(() => {
    const loadAuthUserId = async () => {
      try {
        const email = (session.email || "").trim().toLowerCase();
        if (!email) return;
        const { data, error } = await supabase
          .from("hrmss_approvers")
          .select("auth_user_id")
          .eq("email", email)
          .eq("active", true)
          .maybeSingle();
        if (!error && data?.auth_user_id) {
          setAuthUserId(data.auth_user_id);
        }
      } catch (e) {
        console.warn("manager approver docs auth_user_id lookup failed", e);
      }
    };
    loadAuthUserId();
  }, [session.email]);

  return (
    <DocumentManager
      title="Manager Documents"
      subtitle="Upload and manage team-related documents"
      accent="purple"
      role="manager"

      canUpload={true}
      allowAnonymous={true}
      userIdOverride={authUserId || session.id}
      categoryOptions={["Team Reports", "Policies", "Approvals", "Payroll", "Other"]}
    />
  );
}
