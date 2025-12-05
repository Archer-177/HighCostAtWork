import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function SecuritySettings({ currentUser }) {
  // Only allow pharmacists to view security settings
  const canViewSecurity = currentUser?.role === 'PHARMACIST';

  if (!canViewSecurity) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-center text-gray-600 dark:text-gray-400">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-semibold dark:text-white">Access Denied</p>
        <p>You do not have permission to view security settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold mb-6 dark:text-white">Security Settings</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium dark:text-white">Session Timeout</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Automatic logout after inactivity</p>
            </div>
            <span className="font-mono font-medium">15 minutes</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium dark:text-white">Password Requirements</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Minimum 8 characters, mixed case</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
              Enforced
            </span>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div>
              <p className="font-medium dark:text-white">Audit Logging</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Track all user actions</p>
            </div>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
              Enabled
            </span>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200 mb-2">Security Notice</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">
              This application runs on a shared network drive with file-based authentication.
              For enhanced security, ensure the network drive has appropriate access controls
              and regular backups are maintained.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
