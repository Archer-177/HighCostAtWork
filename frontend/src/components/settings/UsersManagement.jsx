import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';

export default function UsersManagement({ users, onAdd, onEdit, onDelete, currentUser }) {
  const roleColors = {
    'PHARMACIST': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    'PHARMACY_TECH': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'NURSE': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
  }

  // Only allow managing users if the current user is a pharmacist OR a supervisor
  const canManageUsers = currentUser?.role === 'PHARMACIST' || currentUser?.is_supervisor;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h2 className="text-xl font-bold dark:text-white">Users</h2>
        {canManageUsers && (
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-maroon-600 hover:bg-maroon-700 text-white 
                   font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Username</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Role</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Location</th>
              <th className="text-left py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Email</th>
              <th className="text-center py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Can Delegate</th>
              <th className="text-center py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Supervisor</th>
              <th className="text-right py-3 px-6 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              // A supervisor can only edit/delete users at their own location or child locations
              const isMyHierarchy = currentUser?.is_supervisor && (
                user.location_id === currentUser.location_id ||
                user.parent_hub_id === currentUser.location_id
              );

              const canEdit = canManageUsers && (
                !currentUser?.is_supervisor || isMyHierarchy
              );

              return (
                <tr key={user.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-6 font-medium dark:text-white">{user.username}</td>
                  <td className="py-3 px-6">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-6 dark:text-gray-300">{user.location_name}</td>
                  <td className="py-3 px-6">
                    <div className="flex flex-col">
                      <span className="dark:text-gray-300">{user.email || '-'}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{user.mobile_number || ''}</span>
                    </div>
                  </td>
                  <td className="text-center py-3 px-6">
                    {user.can_delegate ? (
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                    )}
                  </td>
                  <td className="text-center py-3 px-6">
                    {user.is_supervisor ? (
                      <Check className="w-5 h-5 text-green-600 dark:text-green-400 mx-auto" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" />
                    )}
                  </td>
                  <td className="text-right py-3 px-6">
                    {canEdit ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(user)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => onDelete(user)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic py-2">Read Only</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
