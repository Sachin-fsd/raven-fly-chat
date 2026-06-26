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

  const { data: conversations } = useInbox();
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  // One real-time connection for the whole authenticated session, kept in
  // sync with every conversation currently in the inbox.
  useCentrifugo(
    user?.id,
    (conversations ?? []).map((c) => c.conversation_id),
  );

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
