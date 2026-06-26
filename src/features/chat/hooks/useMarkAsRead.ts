'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { InboxConversationEntry } from '@/lib/types';
import { inboxQueryKey } from './queryKeys';

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, lastReadMessageId }: { conversationId: string; lastReadMessageId: number }) => {
      await api.patch(`/conversations/${conversationId}/read`, { lastReadMessageId });
    },
    onMutate: ({ conversationId }) => {
      queryClient.setQueryData<InboxConversationEntry[]>(inboxQueryKey, (existing) =>
        existing?.map((c) => (c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c)),
      );
    },
  });
};
