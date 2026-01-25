import { Settings, Shield, User, Bell } from "lucide-react";

export default function EmployeeSettings() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <Settings className="text-slate-700" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your account preferences and security settings.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-6 hover:shadow-md transition cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition">
              <User size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Profile Visibility</p>
              <p className="text-xs text-slate-500">Control who can see your profile details</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 hover:shadow-md transition cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition">
              <Shield size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Security & Password</p>
              <p className="text-xs text-slate-500">Update your password and login methods</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 hover:shadow-md transition cursor-pointer group">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-700 group-hover:bg-orange-700 group-hover:text-white transition">
              <Bell size={20} />
            </div>
            <div>
              <p className="font-bold text-slate-900">Notification Preferences</p>
              <p className="text-xs text-slate-500">How you receive updates and alerts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
