'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiSuccessEnvelope } from '@/lib/api';
import { MessageDoc, InboxConversationEntry } from '@/lib/types';
import { messagesQueryKey, inboxQueryKey } from './queryKeys';

interface SendMessageResponse {
  conversationId: string;
  messageId: number;
  bucket: string;
  text: string;
  senderId: string;
  createdAt: string;
  status: 'sent' | 'delivered';
}

// Must stay <= 20 — the backend caps this at 20 to match AstraDB's limit
// for explicitly-sorted, non-vector queries. Requesting more than the
// backend allows fails validation (400), which is why messages were
// vanishing on refresh after the sort fix.
const PAGE_SIZE = 20;

/**
 * The cache for a conversation's messages is always a plain, flat
 * `MessageDoc[]` sorted newest-first — deliberately the same shape
 * `useCentrifugo` writes into when a real-time message arrives, so both
 * "loaded from history" and "arrived live" data live in one place with no
 * reconciliation gymnastics.
 */
export const useChatMessages = (conversationId: string | null, currentUserId: string | undefined) => {
  const queryClient = useQueryClient();
  const queryKey = conversationId ? messagesQueryKey(conversationId) : ['messages', 'none'];

  const historyQuery = useQuery({
    queryKey,
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await api.get<ApiSuccessEnvelope<MessageDoc[]>>(`/conversations/${conversationId}/messages`, {
        params: { limit: PAGE_SIZE },
      });
      return res.data.data;
    },
    staleTime: 10_000,
  });

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId) return;
    const current = queryClient.getQueryData<MessageDoc[]>(queryKey) ?? [];
    const oldest = current[current.length - 1];
    if (!oldest) return;

    const res = await api.get<ApiSuccessEnvelope<MessageDoc[]>>(`/conversations/${conversationId}/messages`, {
      params: { limit: PAGE_SIZE, cursor: oldest.message_id, bucket: oldest.bucket },
    });

    if (res.data.data.length > 0) {
      queryClient.setQueryData<MessageDoc[]>(queryKey, (existing) => [...(existing ?? []), ...res.data.data]);
    }
    return res.data.data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, queryClient]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, clientId }: { text: string; clientId: string }) => {
      void clientId;
      const res = await api.post<ApiSuccessEnvelope<SendMessageResponse>>(
        `/conversations/${conversationId}/messages`,
        { text },
      );
      return res.data.data;
    },
    onMutate: async ({ text, clientId }) => {
      if (!conversationId || !currentUserId) return;

      const optimisticMessage: MessageDoc = {
        conversation_id: conversationId,
        bucket: new Date().toISOString().slice(0, 7),
        message_id: Date.now(),
        sender_id: currentUserId,
        text,
        created_at: new Date().toISOString(),
        status: 'sending',
        clientId,
      };

      queryClient.setQueryData<MessageDoc[]>(queryKey, (existing) => [optimisticMessage, ...(existing ?? [])]);

      queryClient.setQueryData<InboxConversationEntry[]>(inboxQueryKey, (existing) => {
        if (!existing) return existing;
        const index = existing.findIndex((c) => c.conversation_id === conversationId);
        if (index === -1) return existing;
        const updated = { ...existing[index], last_message: text, updated_at: optimisticMessage.created_at };
        return [updated, ...existing.filter((_, i) => i !== index)];
      });
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<MessageDoc[]>(queryKey, (existing) =>
        (existing ?? []).map((m) =>
          m.clientId === variables.clientId
            ? { ...m, message_id: data.messageId, status: data.status, created_at: data.createdAt }
            : m,
        ),
      );
    },
    onError: (_err, variables) => {
      queryClient.setQueryData<MessageDoc[]>(queryKey, (existing) =>
        (existing ?? []).map((m) => (m.clientId === variables.clientId ? { ...m, status: 'failed' as const } : m)),
      );
    },
  });
  return { historyQuery, sendMessage: sendMessageMutation, loadOlderMessages };
};