/**
 * UI Store
 * Manages UI state (dark mode, sidebar, notifications, etc.)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUIStore = create(
  persist(
    (set, get) => ({
      // Dark Mode
      darkMode: false,
      autoDarkMode: true, // Auto-enable at 6pm

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDarkMode: (enabled) => set({ darkMode: enabled }),
      setAutoDarkMode: (enabled) => set({ autoDarkMode: enabled }),

      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      // Notifications
      notifications: [],
      addNotification: (notification) => {
        const id = Date.now();
        set((state) => ({
          notifications: [
            ...state.notifications,
            { ...notification, id, timestamp: new Date(), read: false },
          ],
        }));
        return id;
      },
      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },
      clearNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },
      clearAllNotifications: () => set({ notifications: [] }),
      getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

      // Modals
      activeModal: null,
      modalData: null,
      openModal: (modalName, data = null) => {
        set({ activeModal: modalName, modalData: data });
      },
      closeModal: () => set({ activeModal: null, modalData: null }),

      // Command Palette
      commandPaletteOpen: false,
      toggleCommandPalette: () => {
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
      },
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),

      // View Mode (grid/list)
      viewMode: 'grid',
      setViewMode: (mode) => set({ viewMode: mode }),

      // Filters (saved)
      savedFilters: [],
      addSavedFilter: (filter) => {
        set((state) => ({
          savedFilters: [...state.savedFilters, { ...filter, id: Date.now() }],
        }));
      },
      removeSavedFilter: (id) => {
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== id),
        }));
      },
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        darkMode: state.darkMode,
        autoDarkMode: state.autoDarkMode,
        viewMode: state.viewMode,
        savedFilters: state.savedFilters,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

// Check if auto dark mode should be enabled (6pm - 6am)
export const checkAutoDarkMode = () => {
  const store = useUIStore.getState();
  if (store.autoDarkMode) {
    const hour = new Date().getHours();
    const shouldBeDark = hour >= 18 || hour < 6;
    if (shouldBeDark !== store.darkMode) {
      store.setDarkMode(shouldBeDark);
    }
  }
};

// Check every minute
setInterval(checkAutoDarkMode, 60000);

export default useUIStore;
