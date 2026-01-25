const items = [
  "Role-Based Permissions (RBAC)",
  "Manager / HR access control",
  "Notification rules",
  "Data retention rules",
];

export default function AdminHeadSystemSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="text-sm text-slate-500">Control permissions, access, notifications, and retention.</p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Settings</h3>
        <ul className="space-y-2 text-sm text-slate-700 list-disc list-inside">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
