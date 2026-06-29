'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useInbox } from '@/features/chat/hooks/useInbox';
import { useCentrifugo } from '@/features/chat/hooks/useCentrifugo';
import { useChatStore } from '@/features/chat/store/useChatStore';
import { ChatSidebar } from '@/features/chat/components/ChatSidebar';
import { MessagePane } from '@/features/chat/components/MessagePane';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  // Still fetch the inbox so the sidebar can render, but we no longer pass
  // all conversation IDs to useCentrifugo — only the active one is subscribed.
  useInbox();

  const activeConversationId = useChatStore((s) => s.activeConversationId);

  // One persistent WS connection for the whole session:
  //  - personal channel always subscribed (keeps user "online" + live inbox updates)
  //  - conversation channel swapped in/out as the user opens/closes chats
  useCentrifugo(user?.id, activeConversationId);

  if (isLoading || !isAuthenticated) return <FullScreenLoader />;

  return (
    <main className="flex h-screen w-full overflow-hidden bg-background">
      <ChatSidebar
        className={cn('w-full shrink-0 md:w-[360px]', activeConversationId ? 'hidden md:flex' : 'flex')}
      />
      <div className={cn('flex-1', activeConversationId ? 'flex' : 'hidden md:flex')}>
        <MessagePane />
      </div>
    </main>
  );
}