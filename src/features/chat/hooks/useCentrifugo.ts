'use client';

import { useEffect, useRef } from 'react';
import { Centrifuge, type Subscription } from 'centrifuge';
import { useQueryClient } from '@tanstack/react-query';
import { getCentrifugoToken } from '@/lib/api';
import { MessageDoc, InboxConversationEntry } from '@/lib/types';
import { inboxQueryKey, messagesQueryKey } from './queryKeys';

const CENTRIFUGO_WS_URL = process.env.NEXT_PUBLIC_CENTRIFUGO_WS_URL ?? 'ws://localhost:8000/connection/websocket';

interface NewMessageEvent {
  type: 'new_message';
  conversationId: string;
  messageId: number;
  senderId: string;
  text: string;
  createdAt: string;
}

interface InboxUpdateEvent {
  type: 'inbox_update';
  conversationId: string;
  lastMessage: string;
  updatedAt: string;
  senderId: string;
  otherUserId: string;
  otherUserName: string;
  conversationType: 'direct' | 'group';
}

type PersonalChannelEvent = InboxUpdateEvent;

/**
 * One Centrifuge client lives for the lifetime of an authenticated session.
 *
 * Two kinds of channels are subscribed to:
 *  1. `personal#<userId>` — exactly one, for the whole session, from the
 *     moment the user connects. This is what makes the inbox update live
 *     even for a conversation the user has never opened before (a brand
 *     new contact messaging them for the first time) — they wouldn't be
 *     subscribed to that conversation's `conversation:<id>` channel yet,
 *     but they're always subscribed to their own personal channel.
 *  2. `conversation:<id>` — one per conversation already in the inbox,
 *     used for the live message stream while a chat is open.
 *
 * No presence/typing/read-receipt handling yet, and no per-channel
 * subscribe authorization beyond Centrifugo's built-in `#` user-limited
 * channel check on the personal channel — see the note in
 * `centrifugo.config.ts` about reintroducing the proxy mechanism later.
 */
export const useCentrifugo = (currentUserId: string | undefined, conversationIds: string[]) => {
  const queryClient = useQueryClient();
  const clientRef = useRef<Centrifuge | null>(null);
  const subscriptionsRef = useRef<Map<string, Subscription>>(new Map());

  useEffect(() => {
    if (!currentUserId) return;

    const token = getCentrifugoToken();
    if (!token) return;

    const centrifuge = new Centrifuge(CENTRIFUGO_WS_URL, {
      token,
      getToken: async () => getCentrifugoToken() ?? '',
    });

    clientRef.current = centrifuge;
    centrifuge.connect();

    const personalChannel = `personal#${currentUserId}`;
    const personalSub = centrifuge.newSubscription(personalChannel);
    personalSub.on('publication', (ctx) => {
      const event = ctx.data as PersonalChannelEvent;
      if (event.type === 'inbox_update') {
        handleInboxUpdateEvent(queryClient, event);
      }
    });
    personalSub.subscribe();
    subscriptionsRef.current.set(personalChannel, personalSub);

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current.clear();
      centrifuge.disconnect();
      clientRef.current = null;
    };
  }, [currentUserId]);

  useEffect(() => {
    const centrifuge = clientRef.current;
    if (!centrifuge) return;

    conversationIds.forEach((conversationId) => {
      const channel = `conversation:${conversationId}`;
      if (subscriptionsRef.current.has(channel)) return;

      const sub = centrifuge.newSubscription(channel);
      sub.on('publication', (ctx) => {
        const event = ctx.data as NewMessageEvent;
        if (event.type === 'new_message') {
          handleNewMessageEvent(queryClient, currentUserId, event);
        }
      });
      sub.subscribe();
      subscriptionsRef.current.set(channel, sub);
    });

    // Only prune `conversation:*` channels here — the personal channel is
    // managed entirely by the effect above and must never be touched by
    // this one.
    const activeChannels = new Set(conversationIds.map((id) => `conversation:${id}`));
    subscriptionsRef.current.forEach((sub, channel) => {
      if (channel.startsWith('conversation:') && !activeChannels.has(channel)) {
        sub.unsubscribe();
        subscriptionsRef.current.delete(channel);
      }
    });
  }, [conversationIds, currentUserId, queryClient]);
};

function handleNewMessageEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUserId: string | undefined,
  event: NewMessageEvent,
): void {
  const incoming: MessageDoc = {
    conversation_id: event.conversationId,
    bucket: event.createdAt.slice(0, 7),
    message_id: event.messageId,
    sender_id: event.senderId,
    text: event.text,
    created_at: event.createdAt,
    status: 'delivered',
  };

  queryClient.setQueryData<MessageDoc[]>(messagesQueryKey(event.conversationId), (existing) => {
    const list = existing ?? [];

    if (event.senderId === currentUserId) {
      const optimisticIndex = list.findIndex((m) => m.status === 'sending' && m.text === event.text);
      if (optimisticIndex !== -1) {
        const next = [...list];
        next[optimisticIndex] = incoming;
        return next;
      }
    }

    if (list.some((m) => m.message_id === incoming.message_id)) return list;
    return [incoming, ...list];
  });

  queryClient.setQueryData<InboxConversationEntry[]>(inboxQueryKey, (existing) => {
    if (!existing) return existing;

    const index = existing.findIndex((c) => c.conversation_id === event.conversationId);
    if (index === -1) return existing;

    const updatedEntry: InboxConversationEntry = {
      ...existing[index],
      last_message: event.text,
      updated_at: event.createdAt,
      unread_count: event.senderId === currentUserId ? existing[index].unread_count : existing[index].unread_count + 1,
    };

    const rest = existing.filter((_, i) => i !== index);
    return [updatedEntry, ...rest];
  });
}

/**
 * Bumps an existing inbox row, or — for a conversation the user has never
 * seen before — inserts a brand new one using the data carried on the
 * event itself, with no REST round-trip needed. The `conversation:<id>`
 * subscription effect picks this new id up automatically on the next
 * render, since it reads from the same inbox query this writes to.
 */
function handleInboxUpdateEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  event: InboxUpdateEvent,
): void {
  queryClient.setQueryData<InboxConversationEntry[]>(inboxQueryKey, (existing) => {
    const list = existing ?? [];
    const index = list.findIndex((c) => c.conversation_id === event.conversationId);

    if (index !== -1) {
      const updatedEntry: InboxConversationEntry = {
        ...list[index],
        last_message: event.lastMessage,
        updated_at: event.updatedAt,
        unread_count: list[index].unread_count + 1,
      };
      return [updatedEntry, ...list.filter((_, i) => i !== index)];
    }

    const newEntry: InboxConversationEntry = {
      conversation_id: event.conversationId,
      updated_at: event.updatedAt,
      last_message: event.lastMessage,
      unread_count: 1,
      name: event.otherUserName,
      type: event.conversationType,
      other_user_id: event.otherUserId,
    };
    return [newEntry, ...list];
  });
}
