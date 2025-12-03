/**
 * Auth Store
 * Manages user authentication state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api/auth';

const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      // Actions
      login: async (username, password) => {
        set({ loading: true, error: null });
        try {
          const response = await authAPI.login(username, password);

          if (response.success) {
            set({
              user: response.user,
              isAuthenticated: true,
              loading: false,
              error: null,
            });
            return { success: true };
          } else {
            set({ error: response.error, loading: false });
            return { success: false, error: response.error };
          }
        } catch (error) {
          const errorMsg = error.response?.data?.error || 'Login failed';
          set({ error: errorMsg, loading: false });
          return { success: false, error: errorMsg };
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      changePassword: async (username, oldPassword, newPassword) => {
        set({ loading: true, error: null });
        try {
          const response = await authAPI.changePassword(username, oldPassword, newPassword);
          set({ loading: false });
          return response;
        } catch (error) {
          const errorMsg = error.response?.data?.error || 'Password change failed';
          set({ error: errorMsg, loading: false });
          throw error;
        }
      },

      // Computed values (getters)
      isPharmacist: () => get().user?.role === 'PHARMACIST',
      isPharmacyTech: () => get().user?.role === 'PHARMACY_TECH',
      isNurse: () => get().user?.role === 'NURSE',
      isSupervisor: () => get().user?.is_supervisor === true,
      canReceiveStock: () => {
        const role = get().user?.role;
        return role === 'PHARMACIST' || role === 'PHARMACY_TECH';
      },
      canTransferStock: () => {
        const role = get().user?.role;
        return role === 'PHARMACIST' || role === 'PHARMACY_TECH';
      },
      canApproveTransfers: () => {
        const user = get().user;
        return user?.role === 'PHARMACIST' && user?.can_delegate === true;
      },
      canViewReports: () => {
        const role = get().user?.role;
        return role === 'PHARMACIST' || role === 'PHARMACY_TECH';
      },
      canManageSettings: () => {
        const user = get().user;
        return user?.role === 'PHARMACIST' && user?.is_supervisor === true;
      },
    }),
    {
      name: 'auth-storage', // LocalStorage key
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
