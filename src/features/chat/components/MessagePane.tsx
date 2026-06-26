'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/hooks/useAuth';
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

  const messages = historyQuery.data ?? [];

  // Auto-scroll to the newest message whenever the active conversation
  // changes or a new message lands — but not when we're loading *older*
  // history (that would yank the user's scroll position).
  useEffect(() => {
    if (isLoadingOlder) return;
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [activeConversationId, messages.length, isLoadingOlder]);

  // Mark the conversation read once its newest message is visible.
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return;
    const newest = messages[0];
    markAsRead.mutate({ conversationId: activeConversationId, lastReadMessageId: newest.message_id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, messages[0]?.message_id]);

  const handleScroll = async () => {
    const el = scrollContainerRef.current;
    if (!el || el.scrollTop > 80 || isLoadingOlder) return;

    setIsLoadingOlder(true);
    const previousHeight = el.scrollHeight;
    await loadOlderMessages();
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - previousHeight;
      }
      setIsLoadingOlder(false);
    });
  };

  if (!activeConversationId) {
    return <EmptyState />;
  }

  const headerName = otherUserData?.name ?? 'Conversation';

  return (
    <div className="flex h-full flex-col bg-muted/30">
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
          [...messages].reverse().map((message,i) => (
            <MessageBubble
              key={i}
              message={message}
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
