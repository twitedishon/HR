import { supabase } from "./supabaseClient";

const EMP_NOTIF_TABLE = "employee_notifications";
const ADMIN_NOTIF_TABLE = "hrmss_notifications";

/**
 * Notify an employee about their leave request status change
 */
export const notifyEmployee = async ({
  ownerId,
  status,
  leaveType = "Leave Request",
}) => {
  if (!ownerId) return;

  try {
    // ✅ First try to get auth_user_id from hrmss_approvers directly
    let { data: approver } = await supabase
      .from("hrmss_approvers")
      .select("auth_user_id")
      .eq("id", ownerId)
      .maybeSingle();

    let userIdToNotify = approver?.auth_user_id;
    console.log(
      "Looking up notification user for ownerId:",
      ownerId,
      "found auth_user_id:",
      userIdToNotify
    );

    // If not found in approvers, look up by user_id in hrmss_profiles to get email
    if (!userIdToNotify) {
      const { data: profile } = await supabase
        .from("hrmss_profiles")
        .select("email, user_id")
        .eq("user_id", ownerId)
        .maybeSingle();

      if (profile?.email) {
        console.log(
          "Found profile email:",
          profile.email,
          "looking for auth_user_id..."
        );
        // Try to find auth_user_id by matching email in hrmss_approvers
        const { data: approverByEmail } = await supabase
          .from("hrmss_approvers")
          .select("auth_user_id")
          .eq("email", profile.email)
          .maybeSingle();

        userIdToNotify = approverByEmail?.auth_user_id;
        console.log(
          "Found auth_user_id from approvers by email:",
          userIdToNotify
        );
      }
    }

    if (!userIdToNotify) {
      console.warn(
        `Cannot find auth_user_id for employee ${ownerId}. This user may not have a Supabase auth account set up.`
      );
      return;
    }

    const message =
      status === "Approved"
        ? `Your ${leaveType} request was approved.`
        : status === "Rejected"
        ? `Your ${leaveType} request was rejected.`
        : `Your ${leaveType} request was updated.`;

    const notificationData = {
      user_id: userIdToNotify,
      title: "Leave Request Update",
      message,
      type:
        status === "Approved"
          ? "success"
          : status === "Rejected"
          ? "error"
          : "info",
      route: "/employee-dashboard/leave-management",
      unread: true,
    };

    console.log("Inserting employee notification:", notificationData);

    const { error: notifError } = await supabase
      .from(EMP_NOTIF_TABLE)
      .insert(notificationData);

    if (notifError) {
      console.error("Employee notification insert error:", notifError);
    } else {
      console.log("Employee notification sent successfully");
    }
  } catch (error) {
    console.error("Error notifying employee:", error);
  }
};

/**
 * Notify a manager about a new leave request from HR
 */
export const notifyManagerNewRequest = async ({
  managerId,
  managerName,
  employeeName,
  leaveType,
  fromDate,
  toDate,
}) => {
  if (!managerId) return;

  try {
    // ✅ First try to get auth_user_id from hrmss_approvers
    let { data: manager } = await supabase
      .from("hrmss_approvers")
      .select("id, auth_user_id, email, name")
      .eq("id", managerId)
      .maybeSingle();

    let userIdToNotify = manager?.auth_user_id;

    // ✅ If no auth_user_id in approvers, try to find it via email in hrmss_profiles
    if (!userIdToNotify && manager?.email) {
      const { data: profileData } = await supabase
        .from("hrmss_profiles")
        .select("user_id")
        .eq("email", manager.email)
        .maybeSingle();
      userIdToNotify = profileData?.user_id;
    }

    if (!userIdToNotify) {
      console.warn(
        `Cannot find user_id for manager ${managerId} (${managerName}). Manager data:`,
        manager
      );
      return;
    }

    const dateRange =
      fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
    const message = `HR sent a ${leaveType} request for ${employeeName} (${dateRange}) for your approval.`;

    console.log("Inserting notification for manager:", {
      user_id: userIdToNotify,
      managerName,
      message,
    });

    const notificationData = {
      user_id: userIdToNotify,
      title: "New Leave Request for Approval",
      message,
      type: "info",
      route: "/manager-approver/approvals",
      unread: true,
    };

    console.log("Manager notification data:", notificationData);

    const { error: notifError } = await supabase
      .from(EMP_NOTIF_TABLE)
      .insert(notificationData);

    if (notifError) {
      console.error("Manager notification insert error:", notifError);
      throw notifError;
    }

    console.log("Notification sent successfully to manager:", managerName);
  } catch (error) {
    console.error("Error notifying manager:", error);
  }
};

/**
 * Notify HR about manager's approval/rejection
 */
export const notifyHRAboutDecision = async ({
  managerName,
  employeeName,
  leaveType,
  status,
  fromDate,
  toDate,
  decisionNote = "",
}) => {
  if (!managerName || !status) return;

  try {
    // ✅ Get HR users from hrmss_profiles (they are HR role users)
    const { data: hrProfiles } = await supabase
      .from("hrmss_profiles")
      .select("user_id, email, role")
      .eq("role", "hr");

    if (!hrProfiles || hrProfiles.length === 0) {
      console.warn("No HR users found in hrmss_profiles");
      return;
    }

    console.log("Found HR users in profiles:", hrProfiles.length);

    // For each HR user, try to find their auth_user_id from hrmss_approvers by email
    const validHRUsers = [];
    for (const hrProfile of hrProfiles) {
      if (hrProfile.email) {
        const { data: approverData } = await supabase
          .from("hrmss_approvers")
          .select("auth_user_id, id, email")
          .eq("email", hrProfile.email)
          .maybeSingle();

        if (approverData?.auth_user_id) {
          console.log(
            "Found auth_user_id for HR",
            hrProfile.email,
            ":",
            approverData.auth_user_id
          );
          validHRUsers.push({
            auth_user_id: approverData.auth_user_id,
            email: hrProfile.email,
          });
        } else {
          console.log("No auth_user_id found for HR", hrProfile.email);
        }
      }
    }

    if (validHRUsers.length === 0) {
      console.warn("No HR users with valid auth_user_ids found");
      return;
    }

    const dateRange =
      fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
    const statusText = status === "Approved" ? "approved" : "rejected";
    let message = `${managerName} ${statusText} a ${leaveType} request for ${employeeName} (${dateRange}).`;
    if (decisionNote) {
      message += ` Note: ${decisionNote}`;
    }

    // Send notification to each HR user via employee_notifications
    for (const hr of validHRUsers) {
      const notificationData = {
        user_id: hr.auth_user_id,
        title: `Leave Request ${status}`,
        message,
        type: status === "Approved" ? "success" : "warning",
        route: "/hr-dashboard/leave-management",
        unread: true,
      };

      console.log("HR notification data:", notificationData);

      const { error: notifError } = await supabase
        .from(EMP_NOTIF_TABLE)
        .insert(notificationData);

      if (notifError) {
        console.error("HR notification insert error:", notifError);
      }
    }

    console.log(
      `Notified ${validHRUsers.length} HR user(s) about leave request ${status}`
    );
  } catch (error) {
    console.error("Error notifying HR:", error);
  }
};
