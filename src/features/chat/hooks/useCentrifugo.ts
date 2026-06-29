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
  /** 'delivered' if the recipient was online (subscribed to their personal
   *  channel) at the moment this was sent — see centrifugo.config.ts's
   *  `isAnyoneSubscribedToChannel` — otherwise 'sent'. Only meaningful for
   *  the sender's own message bubble; ignored for messages we're receiving. */
  status: 'sent' | 'delivered';
}

interface ReadReceiptEvent {
  type: 'read_receipt';
  conversationId: string;
  userId: string;
  lastReadMessageId: number;
}

type ConversationChannelEvent = NewMessageEvent | ReadReceiptEvent;

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
 * Two kinds of channels are managed:
 *  1. `personal#<userId>` — always subscribed for the whole session.
 *     Drives live inbox updates and (via Centrifugo presence) lets the
 *     backend know the user is online so senders see "delivered" ticks.
 *
 *  2. `conversation:<id>` — subscribed only for the ONE conversation
 *     currently open on screen (`activeConversationId`). When the user
 *     switches chats or goes back to the inbox, the old channel is
 *     unsubscribed and the new one is subscribed. This keeps WebSocket
 *     traffic minimal and avoids pulling in messages for conversations
 *     the user isn't looking at.
 *
 * Online/presence detection still works correctly because it is based on
 * the personal channel (`personal:#<userId>`), not on conversation
 * subscriptions — see `isAnyoneSubscribedToChannel` in centrifugo.config.ts.
 */
export const useCentrifugo = (
  currentUserId: string | undefined,
  activeConversationId: string | null,
) => {
  const queryClient = useQueryClient();
  const clientRef = useRef<Centrifuge | null>(null);
  // Only ever holds: the personal sub + at most one conversation sub
  const subscriptionsRef = useRef<Map<string, Subscription>>(new Map());

  // ─── Effect 1: connect once and subscribe to the personal channel ───────
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

    const personalChannel = `personal:#${currentUserId}`;
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

  // ─── Effect 2: swap conversation subscription when active chat changes ───
  useEffect(() => {
    const centrifuge = clientRef.current;
    if (!centrifuge) return;

    if (!activeConversationId) return;

    const channel = `conversation:${activeConversationId}`;

    // If Centrifugo's internal registry already holds this channel (e.g. a
    // previous cleanup only called unsubscribe but not removeSubscription),
    // reuse it rather than calling newSubscription again — which would throw.
    const existing = centrifuge.getSubscription(channel);
    const sub = existing ?? centrifuge.newSubscription(channel);

    sub.on('publication', (ctx) => {
      const event = ctx.data as ConversationChannelEvent;
      if (event.type === 'new_message') {
        handleNewMessageEvent(queryClient, currentUserId, event);
      } else if (event.type === 'read_receipt') {
        handleReadReceiptEvent(queryClient, currentUserId, event);
      }
    });
    sub.subscribe();
    subscriptionsRef.current.set(channel, sub);

    return () => {
      // unsubscribe() stops receiving events; removeSubscription() removes it
      // from Centrifugo's internal registry so newSubscription() won't throw
      // if this same channel is opened again later.
      sub.unsubscribe();
      centrifuge.removeSubscription(sub);
      subscriptionsRef.current.delete(channel);
    };
  }, [activeConversationId, currentUserId, queryClient]);
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
    status: event.status,
  };

  // Status ranking so a late-arriving event can never *downgrade* a
  // message that's already moved further along (e.g. the read receipt
  // beat this event to the cache — don't stomp 'read' back to 'delivered').
  const statusRank: Record<NonNullable<MessageDoc['status']>, number> = {
    sending: 0,
    failed: 0,
    sent: 1,
    delivered: 2,
    read: 3,
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

    // The message may already be in the cache (e.g. the REST response for
    // our own send landed before this WS event did). In that case this
    // event is still the authoritative source for sent/delivered, so apply
    // it to the existing entry instead of silently dropping it.
    const existingIndex = list.findIndex((m) => m.message_id === incoming.message_id);
    if (existingIndex !== -1) {
      const current = list[existingIndex];
      const currentRank = statusRank[current.status ?? 'sent'];
      const incomingRank = statusRank[incoming.status ?? 'sent'];
      if (incomingRank <= currentRank) return list;
      const next = [...list];
      next[existingIndex] = { ...current, status: incoming.status };
      return next;
    }

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
 * Flips the tick icon on our own already-sent messages to "read" once the
 * other participant's `lastReadMessageId` catches up to them. This fires
 * exactly when the other person's mark-as-read-on-open call lands — i.e.
 * exactly when they've actually seen the conversation, not merely when
 * they're online.
 */
function handleReadReceiptEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  currentUserId: string | undefined,
  event: ReadReceiptEvent,
): void {
  if (event.userId === currentUserId) return; // our own read receipt, not relevant to our sent-message ticks

  queryClient.setQueryData<MessageDoc[]>(messagesQueryKey(event.conversationId), (existing) => {
    if (!existing) return existing;
    let changed = false;
    const next = existing.map((m) => {
      if (m.sender_id === currentUserId && m.message_id <= event.lastReadMessageId && m.status !== 'read') {
        changed = true;
        return { ...m, status: 'read' as const };
      }
      return m;
    });
    return changed ? next : existing;
  });
}

/**
 * Bumps an existing inbox row, or — for a conversation the user has never
 * seen before — inserts a brand new one using the data carried on the
 * event itself, with no REST round-trip needed.
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