'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiRequest, ApiError } from '@/lib/api';
import type { AuthResponse, CustomerSummary } from '@/lib/types';

type LoginInput = { email: string; password: string };
type RegisterInput = LoginInput & {
  firstName: string;
  lastName: string;
  phone: string;
  marketingOptIn: boolean;
};

type AnonymousRefreshResponse = { authenticated: false };

type AuthContextValue = {
  customer: CustomerSummary | null;
  status: 'loading' | 'anonymous' | 'authenticated';
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'fraiche_access_token';
const CUSTOMER_KEY = 'fraiche_customer';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const tokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const persistSession = useCallback((response: AuthResponse) => {
    tokenRef.current = response.accessToken;
    setCustomer(response.customer);
    setStatus('authenticated');
    sessionStorage.setItem(TOKEN_KEY, response.accessToken);
    sessionStorage.setItem(CUSTOMER_KEY, JSON.stringify(response.customer));
    return response.accessToken;
  }, []);

  const clearSession = useCallback(() => {
    tokenRef.current = null;
    setCustomer(null);
    setStatus('anonymous');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(CUSTOMER_KEY);
  }, []);

  const refreshSession = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const operation = (async () => {
      try {
        const response = await apiRequest<AuthResponse | AnonymousRefreshResponse>(
          '/customer-auth/refresh',
          {
            method: 'POST',
            cache: 'no-store',
          },
        );
        if (!('accessToken' in response)) {
          clearSession();
          return null;
        }
        return persistSession(response);
      } catch {
        clearSession();
        return null;
      }
    })();

    refreshPromiseRef.current = operation;
    void operation.finally(() => {
      if (refreshPromiseRef.current === operation) refreshPromiseRef.current = null;
    });
    return operation;
  }, [clearSession, persistSession]);

  useEffect(() => {
    const savedToken = sessionStorage.getItem(TOKEN_KEY);
    const savedCustomer = sessionStorage.getItem(CUSTOMER_KEY);
    if (savedToken && savedCustomer) {
      try {
        tokenRef.current = savedToken;
        setCustomer(JSON.parse(savedCustomer) as CustomerSummary);
        setStatus('authenticated');
        void refreshSession();
        return;
      } catch {
        sessionStorage.removeItem(CUSTOMER_KEY);
      }
    }
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await apiRequest<AuthResponse>('/customer-auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      persistSession(response);
    },
    [persistSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await apiRequest<AuthResponse>('/customer-auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      persistSession(response);
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/customer-auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      const execute = (token: string | null) => {
        const headers = new Headers(init.headers);
        if (token) headers.set('Authorization', `Bearer ${token}`);
        return apiRequest<T>(path, { ...init, headers, cache: 'no-store' });
      };

      try {
        return await execute(tokenRef.current);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const nextToken = await refreshSession();
        if (!nextToken) throw error;
        return execute(nextToken);
      }
    },
    [refreshSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ customer, status, login, register, logout, refreshSession, request }),
    [customer, status, login, register, logout, refreshSession, request],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider.');
  return context;
}
