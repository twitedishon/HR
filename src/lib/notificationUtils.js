import { supabase } from "./supabaseClient";

const EMP_NOTIF_TABLE = "employee_notifications";
const ADMIN_NOTIF_TABLE = "hrmss_notifications";

/**
 * Notify an employee about their leave request status change
 * 
 * IMPORTANT: For employees signed in via the Employee Sign-In flow (not Supabase Auth),
 * notifications are stored with user_id = employee_id (e.g., 'EMP-022').
 * This matches how EmployeeNotifications.jsx fetches notifications.
 */
export const notifyEmployee = async ({
  ownerId,
  status,
  leaveType = "Leave Request",
}) => {
  if (!ownerId) {
    console.warn("notifyEmployee: No ownerId provided");
    return;
  }

  console.log("notifyEmployee: Attempting to notify employee:", ownerId, "Status:", status);

  try {
    let userIdToNotify = null;

    // Strategy 1: Check if ownerId looks like an employee_id (e.g., EMP-XXX)
    // If so, use it directly - this is how EmployeeNotifications.jsx queries
    const isEmployeeIdFormat = /^EMP-\d+$/i.test(String(ownerId).trim());

    if (isEmployeeIdFormat) {
      // For employee-format IDs, first check if they have a Supabase auth user_id
      const { data: empProfile } = await supabase
        .from("hrmss_employee_profiles")
        .select("user_id, employee_id")
        .eq("employee_id", ownerId)
        .maybeSingle();

      if (empProfile?.user_id) {
        // If employee has a Supabase auth user_id, use it
        console.log("notifyEmployee: Found auth user_id for employee:", empProfile.user_id);
        userIdToNotify = empProfile.user_id;
      } else {
        // If no auth user_id, use the employee_id directly
        // This is the typical case for Employee Sign-In flow users
        console.log("notifyEmployee: Employee has no auth user_id, using employee_id directly:", ownerId);
        userIdToNotify = ownerId;
      }
    }

    // Strategy 2: Try hrmss_profiles by employee_id (for HR/Admin/Manager)
    if (!userIdToNotify) {
      const { data: profileByEmpId } = await supabase
        .from("hrmss_profiles")
        .select("user_id, email")
        .eq("employee_id", ownerId)
        .maybeSingle();

      if (profileByEmpId?.user_id) {
        console.log("notifyEmployee: Found user_id via hrmss_profiles.employee_id:", profileByEmpId.user_id);
        userIdToNotify = profileByEmpId.user_id;
      }
    }

    // Strategy 3: Try hrmss_approvers
    if (!userIdToNotify) {
      const { data: approver } = await supabase
        .from("hrmss_approvers")
        .select("auth_user_id")
        .eq("id", ownerId)
        .maybeSingle();

      if (approver?.auth_user_id) {
        console.log("notifyEmployee: Found user_id via hrmss_approvers:", approver.auth_user_id);
        userIdToNotify = approver.auth_user_id;
      }
    }

    // Strategy 4: Final fallback - use ownerId directly
    if (!userIdToNotify) {
      console.log("notifyEmployee: Using ownerId as user_id fallback:", ownerId);
      userIdToNotify = ownerId;
    }

    if (!userIdToNotify) {
      console.warn(
        `notifyEmployee: Cannot find user_id for employee ${ownerId}. This user may not have a Supabase auth account set up.`
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
      route: "/employee-dashboard/leave",
      unread: true,
    };

    console.log("notifyEmployee: Inserting notification:", JSON.stringify(notificationData));

    const { error: notifError } = await supabase
      .from(EMP_NOTIF_TABLE)
      .insert(notificationData);

    if (notifError) {
      console.error("notifyEmployee: Insert error:", notifError);
    } else {
      console.log("notifyEmployee: Successfully inserted notification for user:", userIdToNotify);
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
  managerEmail, // ✅ Added for target_email filtering
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
      target_email: managerEmail || manager?.email || "", // ✅ Target specific manager
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
