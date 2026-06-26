'use client';

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, ApiSuccessEnvelope, setAccessToken, setCentrifugoToken } from '@/lib/api';
import { PublicUser } from '@/lib/types';
import { useAuthStore } from './useAuthStore';

interface AuthPayload {
  user: PublicUser;
  accessToken: string;
  centrifugoToken: string;
}

export const useAuth = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, status, setSession, clearSession, setStatus } = useAuthStore();

  // On first mount, try a silent refresh using the httpOnly refresh-token
  // cookie — this is what makes the session survive a hard page reload
  // even though the access token itself only lives in memory.
  useEffect(() => {
    if (status !== 'idle') return;

    setStatus('loading');
    api
      .post<ApiSuccessEnvelope<{ accessToken: string; centrifugoToken: string }>>('/auth/refresh')
      .then(async (res) => {
        setAccessToken(res.data.data.accessToken);
        setCentrifugoToken(res.data.data.centrifugoToken);
        const me = await api.get<ApiSuccessEnvelope<PublicUser>>('/users/me');
        setSession(me.data.data, res.data.data.accessToken, res.data.data.centrifugoToken);
      })
      .catch(() => {
        clearSession();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const loginMutation = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await api.post<ApiSuccessEnvelope<AuthPayload>>('/auth/login', input);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.centrifugoToken);
      router.push('/');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) => {
      const res = await api.post<ApiSuccessEnvelope<AuthPayload>>('/auth/register', input);
      return res.data.data;
    },
    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.centrifugoToken);
      router.push('/');
    },
  });

  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    clearSession();
    queryClient.clear();
    router.push('/login');
  };

  return {
    user,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'idle' || status === 'loading',
    login: loginMutation,
    register: registerMutation,
    logout,
  };
};
