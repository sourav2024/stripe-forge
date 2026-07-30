import type { AuthTokens } from '../types';

// Tokens live in localStorage so a page refresh keeps the session, and in a
// module-level cache so the axios interceptor reads them synchronously without
// importing React context (avoids a circular dependency with AuthContext).

const ACCESS_KEY = 'sf.accessToken';
const REFRESH_KEY = 'sf.refreshToken';

type Listener = (tokens: AuthTokens | null) => void;

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);
const listeners = new Set<Listener>();

function emit(): void {
  const snapshot = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  listeners.forEach((fn) => fn(snapshot));
}

export const tokenStore = {
  getAccess: (): string | null => accessToken,
  getRefresh: (): string | null => refreshToken,

  set(tokens: AuthTokens): void {
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    emit();
  },

  clear(): void {
    accessToken = null;
    refreshToken = null;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    emit();
  },

  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
