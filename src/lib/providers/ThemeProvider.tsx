'use client';

import { useEffect } from 'react';
import { useChatStore } from '@/features/chat/store/useChatStore';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const theme = useChatStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return <>{children}</>;
};
