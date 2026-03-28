import { create } from 'zustand';

const STORAGE_KEY = 'auth_state';

const getInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
      };
    }

    const parsed = JSON.parse(raw);

    return {
      user: parsed.user || null,
      accessToken: parsed.accessToken || null,
      refreshToken: null,
    };
  }
  catch {
    return {
      user: null,
      accessToken: null,
      refreshToken: null,
    };
  }
};

const persistState = (state) => {
  if (typeof window === 'undefined') return;

  const toStore = {
    user: state.user,
    accessToken: state.accessToken,
    refreshToken: null,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
};

export const useAuthStore = create((set, get) => ({
  ...getInitialState(),

  setAuth: ({ user, accessToken, refreshToken }) => {
    const nextState = { user, accessToken, refreshToken };
    set(nextState);
    persistState(nextState);
  },

  setAccessToken: (accessToken) => {
    const { user, refreshToken } = get();
    const nextState = { user, accessToken, refreshToken };
    set(nextState);
    persistState(nextState);
  },

  clearAuth: () => {
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
    });

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  },
}));

