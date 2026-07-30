import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiError, ApiSuccess, PaginationMeta } from '../types';
import { tokenStore } from './tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the bearer token to every request.
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Single-flight refresh: concurrent 401s share one refresh call.
let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  // Bare axios (not apiClient) so we don't recurse through the interceptor.
  const res = await axios.post<ApiSuccess<{ accessToken: string; refreshToken: string }>>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
  const data = res.data.data;
  tokenStore.set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const isRefreshCall = original?.url?.includes('/auth/refresh');
    if (status === 401 && original && !original._retry && !isRefreshCall) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? performRefresh();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient(original);
      } catch (refreshErr) {
        refreshPromise = null;
        tokenStore.clear();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export interface NormalizedError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

function normalizeError(error: AxiosError<ApiError>): NormalizedError {
  const payload = error.response?.data;
  if (payload && payload.success === false && payload.error) {
    return {
      code: payload.error.code,
      message: payload.error.message,
      status: error.response?.status,
      details: payload.error.details,
    };
  }
  return {
    code: 'network_error',
    message: error.message || 'Something went wrong. Please try again.',
    status: error.response?.status,
  };
}

/** Unwrap `{ success, data }` into `data`. */
export function unwrap<T>(res: AxiosResponse<ApiSuccess<T>>): T {
  return res.data.data;
}

/** Unwrap a paginated `{ success, data, meta }` into `{ items, meta }`. */
export function unwrapPaginated<T>(
  res: AxiosResponse<ApiSuccess<T[]>>,
): { items: T[]; meta: PaginationMeta } {
  const { data, meta } = res.data;
  return {
    items: data,
    meta: meta ?? { page: 1, pageSize: data.length, total: data.length, totalPages: 1 },
  };
}
