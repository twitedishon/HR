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
    // Primary: try to resolve auth_user_id from approvers
    let { data: approver } = await supabase
      .from("hrmss_approvers")
      .select("auth_user_id")
      .eq("id", ownerId)
      .maybeSingle();

    let userIdToNotify = approver?.auth_user_id;

    // Secondary: resolve via hrmss_profiles (email -> approvers)
    let profile;
    if (!userIdToNotify) {
      const profileRes = await supabase
        .from("hrmss_profiles")
        .select("email, user_id")
        .eq("user_id", ownerId)
        .maybeSingle();
      profile = profileRes?.data;

      if (profile?.email) {
        const { data: approverByEmail } = await supabase
          .from("hrmss_approvers")
          .select("auth_user_id")
          .eq("email", profile.email)
          .maybeSingle();
        userIdToNotify = approverByEmail?.auth_user_id;
      }
    }

    // Final fallback: use profile.user_id or the ownerId itself
    if (!userIdToNotify && profile?.user_id) {
      userIdToNotify = profile.user_id;
    }
    if (!userIdToNotify && ownerId) {
      userIdToNotify = ownerId;
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

    // ✅ Insert to employee_notifications table
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

    const { error: notifError } = await supabase
      .from(EMP_NOTIF_TABLE)
      .insert(notificationData);

    if (notifError) {
      console.error("Employee notification insert error:", notifError);
    } else {
      console.log("Employee notification sent successfully");
    }

    // ✅ Also insert to hrmss_notifications for admin/approver users
    const adminNotificationData = {
      title: `Leave Request ${status}`,
      detail: message,
      type: status === "Approved" ? "success" : status === "Rejected" ? "warning" : "info",
      source: "LeaveManagement",
      route: "/dashboard/leave",
      audience: "admin",
      unread: true,
    };

    await supabase.from(ADMIN_NOTIF_TABLE).insert(adminNotificationData);
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
    // Validate the manager exists (used to avoid noise)
    let { data: manager } = await supabase
      .from("hrmss_approvers")
      .select("id, auth_user_id, email, name")
      .eq("id", managerId)
      .maybeSingle();

    let userIdToNotify = manager?.auth_user_id;

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
    }

    const dateRange =
      fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
    const message = `HR sent a ${leaveType} request for ${employeeName} (${dateRange}) for your approval.`;

    const notificationData = {
      title: "New Leave Request for Approval",
      detail: message,
      type: "info",
      source: "LeaveManagement",
      route: "/manager-approver-dashboard/approvals",
      audience: "manager",
      unread: true,
    };

    const { error: notifError } = await supabase
      .from(ADMIN_NOTIF_TABLE)
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
    const dateRange =
      fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;
    const statusText = status === "Approved" ? "approved" : "rejected";
    let message = `${managerName} ${statusText} a ${leaveType} request for ${employeeName} (${dateRange}).`;
    if (decisionNote) {
      message += ` Note: ${decisionNote}`;
    }

    const notificationData = {
      title: `Leave Request ${status}`,
      detail: message,
      type: status === "Approved" ? "success" : "warning",
      source: "LeaveManagement",
      route: "/hr-dashboard/leave",
      audience: "hr",
      unread: true,
    };

    const { error: notifError } = await supabase
      .from(ADMIN_NOTIF_TABLE)
      .insert(notificationData);

    if (notifError) {
      console.error("HR notification insert error:", notifError);
    } else {
      console.log("Inserted HR notification into hrmss_notifications successfully");
    }
  } catch (error) {
    console.error("Error notifying HR:", error);
  }
};
