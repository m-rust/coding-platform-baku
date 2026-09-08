import { create } from 'zustand';

const STORAGE_KEY = 'auth_state';

const getInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      accessToken: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        user: null,
        accessToken: null,
      };
    }

    const parsed = JSON.parse(raw);

    return {
      user: parsed.user || null,
      accessToken: parsed.accessToken || null,
    };
  } catch {
    return {
      user: null,
      accessToken: null,
    };
  }
};

const persistState = (state) => {
  if (typeof window === 'undefined') return;

  const toStore = {
    user: state.user,
    accessToken: state.accessToken,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
};

export const useAuthStore = create((set, get) => ({
  ...getInitialState(),

  isBootstrapped: false,

  completeBootstrap: () => set({ isBootstrapped: true }),

  setUser: (user) => {
    const { accessToken } = get();
    set({ user });
    persistState({ user, accessToken });
  },

  setAuth: ({ user, accessToken }) => {
    const nextState = { user, accessToken };
    set(nextState);
    persistState(nextState);
  },

  setAccessToken: (accessToken) => {
    const { user } = get();
    const nextState = { user, accessToken };
    set(nextState);
    persistState(nextState);
  },

  clearAuth: () => {
    set({
      user: null,
      accessToken: null,
    });

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
}));

