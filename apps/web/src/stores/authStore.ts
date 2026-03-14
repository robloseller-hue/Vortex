import { create } from 'zustand';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../lib/types';

interface Pending2Fa {
  userId: string;
  emailHint: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  pending2fa: Pending2Fa | null;
  login: (username: string, password: string) => Promise<void>;
  verify2fa: (code: string) => Promise<void>;
  loginWithToken: (token: string, user: User) => void;
  register: (username: string, displayName: string, password: string, bio?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const TOKEN_KEY = 'zync_token';

// Migrate old token
const _old = localStorage.getItem('vortex_token');
if (_old && !localStorage.getItem(TOKEN_KEY)) localStorage.setItem(TOKEN_KEY, _old);
localStorage.removeItem('vortex_token');

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  isLoading: true,
  error: null,
  pending2fa: null,

  login: async (username, password) => {
    set({ error: null, isLoading: true });
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');

      if (data.twoFaRequired) {
        // Store 2FA pending state in store — survives re-renders
        set({ isLoading: false, pending2fa: { userId: data.userId, emailHint: data.emailHint } });
        return;
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      api.setToken(data.token);
      connectSocket(data.token);
      set({ token: data.token, user: data.user, isLoading: false, pending2fa: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  verify2fa: async (code) => {
    const { pending2fa } = get();
    if (!pending2fa) return;
    set({ error: null, isLoading: true });
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pending2fa.userId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Неверный код');
      localStorage.setItem(TOKEN_KEY, data.token);
      api.setToken(data.token);
      connectSocket(data.token);
      set({ token: data.token, user: data.user, isLoading: false, pending2fa: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  loginWithToken: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    api.setToken(token);
    connectSocket(token);
    set({ token, user, isLoading: false, pending2fa: null });
  },

  register: async (username, displayName, password, bio) => {
    set({ error: null, isLoading: true });
    try {
      const { token, user } = await api.register(username, displayName, password, bio);
      localStorage.setItem(TOKEN_KEY, token);
      api.setToken(token);
      connectSocket(token);
      set({ token, user, isLoading: false, pending2fa: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    api.setToken(null);
    disconnectSocket();
    set({ token: null, user: null, pending2fa: null });
  },

  checkAuth: async () => {
    const token = get().token;
    // Don't interrupt 2FA flow
    if (get().pending2fa) { set({ isLoading: false }); return; }
    if (!token) { set({ isLoading: false }); return; }
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        api.setToken(token);
        const { user } = await api.getMe();
        connectSocket(token);
        set({ user, isLoading: false });
        return;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Требуется авторизация') || msg.includes('Недействительный токен')) break;
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    console.warn('checkAuth failed:', lastError);
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isLoading: false });
  },

  updateUser: (data) => {
    const { user } = get();
    if (user) set({ user: { ...user, ...data } });
  },
}));
