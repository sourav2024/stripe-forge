import { apiClient, unwrap } from './client';
import type { AuthSession, AuthTokens, Merchant } from '../types';

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// The backend nests token pairs under `tokens` ({ merchant, tokens }); the app
// works with a flat AuthSession, so we normalize at this boundary only.
interface WireSession {
  merchant: Merchant;
  tokens: AuthTokens;
}

function toSession(wire: WireSession): AuthSession {
  return { merchant: wire.merchant, ...wire.tokens };
}

export const authApi = {
  async signup(input: SignupInput): Promise<AuthSession> {
    const res = await apiClient.post('/auth/signup', input);
    return toSession(unwrap<WireSession>(res));
  },

  async login(input: LoginInput): Promise<AuthSession> {
    const res = await apiClient.post('/auth/login', input);
    return toSession(unwrap<WireSession>(res));
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await apiClient.post('/auth/refresh', { refreshToken });
    return unwrap<WireSession>(res).tokens;
  },

  async me(): Promise<Merchant> {
    const res = await apiClient.get('/auth/me');
    return unwrap<Merchant>(res);
  },

  async logout(refreshToken: string | null): Promise<void> {
    await apiClient.post('/auth/logout', { refreshToken }).catch(() => undefined);
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/password/reset-request', { email });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await apiClient.post('/auth/password/reset', { token, password });
  },
};
