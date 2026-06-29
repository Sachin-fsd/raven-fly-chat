'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { MessageDoc, ConversationDoc } from '@/lib/types';
import { useChatStore } from '../store/useChatStore';
import { useChatMessages } from '../hooks/useChatMessages';
import { useConversation } from '../hooks/useConversation';
import { useMarkAsRead } from '../hooks/useMarkAsRead';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { EmptyState } from './EmptyState';

const getInitials = (name: string): string =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const MessagePane = () => {
  const { user } = useAuth();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);

  const { data: conversation, isLoading: isConversationLoading } = useConversation(activeConversationId);
  const { historyQuery, sendMessage, loadOlderMessages } = useChatMessages(activeConversationId, user?.id);
  const markAsRead = useMarkAsRead();

  const otherUserId = conversation ? conversation.participants.find((id) => id !== user?.id) : undefined;
  const otherUserData = otherUserId ? conversation?.participantsData[otherUserId] : undefined;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const prevHeightRef = useRef<number>(0);
  const isRestoringRef = useRef(false);
  const messages = historyQuery.data ?? [];
  const newestMessageId = messages.at(-1)?.message_id;
  
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeConversationId, newestMessageId]);

  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return;
    const newest = messages[0];
    markAsRead.mutate({
      conversationId: activeConversationId,
      lastReadMessageId: newest.message_id
    });
  }, [activeConversationId, messages[0]?.message_id]);

  const handleScroll = async () => {
    const el = scrollContainerRef.current;
    if (!el || el.scrollTop > 80 || isLoadingOlder) return;

    setIsLoadingOlder(true);
    prevHeightRef.current = el.scrollHeight;            
    isRestoringRef.current = true;                      

    await loadOlderMessages();

    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const newHeight = scrollContainerRef.current.scrollHeight;
        scrollContainerRef.current.scrollTop = newHeight - prevHeightRef.current;
      }
      setIsLoadingOlder(false);
      isRestoringRef.current = false;   
    });
  };


  if (!activeConversationId) {
    return <EmptyState />;
  }

  const headerName = otherUserData?.name ?? 'Conversation';

  return (
    <div className="flex h-full w-full flex-col bg-muted/30">
      <div className="flex items-center gap-3 border-b border-border bg-panel px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setActiveConversationId(null)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {isConversationLoading ? (
          <>
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <Avatar>
              <AvatarFallback>{getInitials(headerName)}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium">{headerName}</p>
            </div>
          </>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 space-y-2 overflow-y-auto px-4 py-4 thin-scrollbar"
      >
        {isLoadingOlder && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <>{console.log("\nhistory data: ",historyQuery.data)}</>
        {historyQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={i % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}>
                <Skeleton className="h-9 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : (
          // history comes back newest-first; reverse for natural top-to-bottom reading order
          [...messages].reverse().map((message) => (
            <MessageBubble
              key={message.clientId ?? message.message_id}
              message={resolveMessageStatus(message, otherUserId, conversation)}
              isOwn={message.sender_id === user?.id}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={(payload) => sendMessage.mutate(payload)} disabled={sendMessage.isPending} />
    </div>
  );
};

/**
 * For our own messages, a live event (`status` already set by
 * useChatMessages/useCentrifugo this session) always wins. For messages
 * loaded from history with no live event yet in this session — e.g. the
 * other person already read them before we even opened the app — we
 * derive "seen" from the conversation's persisted `readReceipts` map.
 * There's no persisted signal for "delivered" (online-at-send-time is
 * never stored), so a historical message with no live event falls back
 * to a plain single tick rather than guessing.
 */
function resolveMessageStatus(
  message: MessageDoc,
  otherUserId: string | undefined,
  conversation: ConversationDoc | undefined,
): MessageDoc {
  console.log({message});
  if (message.status || !otherUserId || !conversation) {
    return { ...message, status: message.status ?? 'sent' };
  }

  const otherUserLastRead = conversation.readReceipts[otherUserId] ?? 0;
  return { ...message, status: message.message_id <= otherUserLastRead ? 'read' : 'sent' };
}
