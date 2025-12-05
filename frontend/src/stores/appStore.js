import create from 'zustand';

const useAppStore = create((set) => ({
  user: null,
  location: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
  setLocation: (location) => set({ location }),
}));

export default useAppStore;
