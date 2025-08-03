import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  role: 'admin' | 'user';
  preferences: {
    defaultProject?: string;
    timeFormat: '12h' | '24h';
    weekStartDay: number;
    notifications: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface TimerState {
  isRunning: boolean;
  currentEntryId?: string;
  startTime?: Date;
  elapsedTime: number;
  projectId?: string;
  description: string;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Timer state
  timer: TimerState;
  
  // UI state
  isOffline: boolean;
  activeView: 'timer' | 'entries' | 'reports';
  sidebarCollapsed: boolean;
  
  // Offline queue
  offlineQueue: Array<{
    id: string;
    type: 'create' | 'update' | 'delete';
    endpoint: string;
    data: any;
    timestamp: Date;
  }>;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (authenticated: boolean) => void;
  
  // Timer actions
  startTimer: (projectId?: string, description?: string) => void;
  stopTimer: () => void;
  updateTimer: (elapsedTime: number) => void;
  resetTimer: () => void;
  
  // UI actions
  setOffline: (offline: boolean) => void;
  setActiveView: (view: 'timer' | 'entries' | 'reports') => void;
  toggleSidebar: () => void;
  
  // Offline queue actions
  addToOfflineQueue: (item: Omit<AppState['offlineQueue'][0], 'id' | 'timestamp'>) => void;
  removeFromOfflineQueue: (id: string) => void;
  clearOfflineQueue: () => void;
}

const initialTimerState: TimerState = {
  isRunning: false,
  elapsedTime: 0,
  description: '',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      timer: initialTimerState,
      isOffline: false,
      activeView: 'timer',
      sidebarCollapsed: false,
      offlineQueue: [],
      
      // User actions
      setUser: (user) => set({ user }),
      setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
      
      // Timer actions
      startTimer: (projectId, description = '') => {
        const now = new Date();
        set({
          timer: {
            isRunning: true,
            startTime: now,
            elapsedTime: 0,
            projectId,
            description,
          },
        });
      },
      
      stopTimer: () => {
        set({
          timer: {
            ...get().timer,
            isRunning: false,
            startTime: undefined,
          },
        });
      },
      
      updateTimer: (elapsedTime) => {
        set({
          timer: {
            ...get().timer,
            elapsedTime,
          },
        });
      },
      
      resetTimer: () => {
        set({ timer: initialTimerState });
      },
      
      // UI actions
      setOffline: (offline) => set({ isOffline: offline }),
      setActiveView: (view) => set({ activeView: view }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      
      // Offline queue actions
      addToOfflineQueue: (item) => {
        const newItem = {
          ...item,
          id: crypto.randomUUID(),
          timestamp: new Date(),
        };
        set({
          offlineQueue: [...get().offlineQueue, newItem],
        });
      },
      
      removeFromOfflineQueue: (id) => {
        set({
          offlineQueue: get().offlineQueue.filter(item => item.id !== id),
        });
      },
      
      clearOfflineQueue: () => {
        set({ offlineQueue: [] });
      },
    }),
    {
      name: 'time-tracker-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        timer: state.timer,
        activeView: state.activeView,
        sidebarCollapsed: state.sidebarCollapsed,
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);