import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type LoginInput, type SignupInput } from '../api/auth';
import { tokenStore } from '../api/tokenStore';
import type { Merchant } from '../types';

export interface AuthContextValue {
  merchant: Merchant | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [initializing, setInitializing] = useState(true);

  // On mount, if a token exists, hydrate the current merchant. A failed /me
  // (expired/invalid token) leaves us logged out — the interceptor clears it.
  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!tokenStore.getAccess()) {
        setInitializing(false);
        return;
      }
      try {
        const me = await authApi.me();
        if (active) setMerchant(me);
      } catch {
        if (active) {
          tokenStore.clear();
          setMerchant(null);
        }
      } finally {
        if (active) setInitializing(false);
      }
    }
    bootstrap();

    // Keep local state in sync if tokens are cleared elsewhere (e.g. interceptor).
    const unsub = tokenStore.subscribe((tokens) => {
      if (!tokens) setMerchant(null);
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await authApi.login(input);
    tokenStore.set({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setMerchant(session.merchant);
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const session = await authApi.signup(input);
    tokenStore.set({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setMerchant(session.merchant);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout(tokenStore.getRefresh());
    tokenStore.clear();
    setMerchant(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      merchant,
      isAuthenticated: !!merchant,
      initializing,
      login,
      signup,
      logout,
    }),
    [merchant, initializing, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
