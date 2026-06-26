'use client';

import { useQuery } from '@tanstack/react-query';
import { api, ApiSuccessEnvelope } from '@/lib/api';
import { ConversationDoc } from '@/lib/types';
import { conversationQueryKey } from './queryKeys';

export const useConversation = (conversationId: string | null) => {
  return useQuery({
    queryKey: conversationId ? conversationQueryKey(conversationId) : ['conversation', 'none'],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await api.get<ApiSuccessEnvelope<ConversationDoc>>(`/conversations/${conversationId}`);
      return res.data.data;
    },
    staleTime: 60_000,
  });
};
