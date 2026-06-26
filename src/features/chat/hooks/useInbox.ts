'use client';

import { useQuery } from '@tanstack/react-query';
import { api, ApiSuccessEnvelope } from '@/lib/api';
import { InboxConversationEntry } from '@/lib/types';
import { inboxQueryKey } from './queryKeys';

export const useInbox = () => {
  return useQuery({
    queryKey: inboxQueryKey,
    queryFn: async () => {
      const res = await api.get<ApiSuccessEnvelope<InboxConversationEntry[]>>('/conversations/inbox');
      return res.data.data;
    },
    staleTime: 30_000,
  });
};
