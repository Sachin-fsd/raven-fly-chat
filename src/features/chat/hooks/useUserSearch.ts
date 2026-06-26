'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiSuccessEnvelope } from '@/lib/api';
import { PublicUser, ConversationDoc, InboxConversationEntry } from '@/lib/types';
import { userSearchQueryKey, inboxQueryKey } from './queryKeys';

export const useUserSearch = (query: string) => {
  return useQuery({
    queryKey: userSearchQueryKey(query),
    enabled: query.trim().length > 0,
    queryFn: async () => {
      const res = await api.get<ApiSuccessEnvelope<PublicUser[]>>('/users/search', { params: { q: query } });
      return res.data.data;
    },
  });
};

export const useCreateConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUser: PublicUser) => {
      const res = await api.post<ApiSuccessEnvelope<ConversationDoc>>('/conversations', {
        participantId: otherUser.id,
      });
      return { conversation: res.data.data, otherUser };
    },
    onSuccess: ({ conversation, otherUser }) => {
      queryClient.setQueryData<InboxConversationEntry[]>(inboxQueryKey, (existing) => {
        const already = existing?.find((c) => c.conversation_id === conversation._id);
        if (already) return existing;

        const entry: InboxConversationEntry = {
          conversation_id: conversation._id,
          updated_at: conversation.updatedAt,
          last_message: conversation.lastMessage,
          unread_count: 0,
          name: otherUser.name,
          type: 'direct',
          other_user_id: otherUser.id,
        };
        return [entry, ...(existing ?? [])];
      });
    },
  });
};
