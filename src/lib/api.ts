import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/**
 * The access token lives in memory only (never localStorage) to limit
 * XSS blast radius. It's lost on a hard refresh, which is why
 * `useAuth`/`AuthProvider` calls `/auth/refresh` on app boot — the
 * httpOnly refresh-token cookie (set by the backend) silently re-issues
 * a fresh access token without the user noticing.
 */
let currentAccessToken: string | null = null;
let currentCentrifugoToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  currentAccessToken = token;
};

export const getAccessToken = (): string | null => currentAccessToken;

export const setCentrifugoToken = (token: string | null): void => {
  currentCentrifugoToken = token;
};

export const getCentrifugoToken = (): string | null => currentCentrifugoToken;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // sends the httpOnly refreshToken cookie automatically
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (currentAccessToken) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const newToken: string = response.data.data.accessToken;
    setAccessToken(newToken);
    setCentrifugoToken(response.data.data.centrifugoToken ?? null);
    return newToken;
  } catch {
    setAccessToken(null);
    setCentrifugoToken(null);
    return null;
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;

      // Coalesce concurrent 401s into a single refresh call instead of
      // firing one refresh request per failed request.
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);

export interface ApiSuccessEnvelope<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  errors?: { path: string; message: string }[];
}
