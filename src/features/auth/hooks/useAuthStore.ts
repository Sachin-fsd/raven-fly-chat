import { create } from 'zustand';
import { PublicUser } from '@/lib/types';
import { setAccessToken, setCentrifugoToken } from '@/lib/api';

interface AuthState {
  user: PublicUser | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  setSession: (user: PublicUser, accessToken: string, centrifugoToken: string) => void;
  clearSession: () => void;
  setStatus: (status: AuthState['status']) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setSession: (user, accessToken, centrifugoToken) => {
    setAccessToken(accessToken);
    setCentrifugoToken(centrifugoToken);
    set({ user, status: 'authenticated' });
  },
  clearSession: () => {
    setAccessToken(null);
    setCentrifugoToken(null);
    set({ user: null, status: 'unauthenticated' });
  },
  setStatus: (status) => set({ status }),
}));
