
import AdminNotifications from "../admin/ApproverEmployeeNotifications.jsx";

// Admin Head uses the same data-driven notifications view as Admin,
// pulling from hrmss_notifications (no hardcoded items).
export default function AdminHeadNotifications() {
  return <AdminNotifications />;
}
