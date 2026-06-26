'use client';

import { useMemo, useState } from 'react';
import { LogOut, MessageSquarePlus, Moon, Sun } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useInbox } from '../hooks/useInbox';
import { useChatStore } from '../store/useChatStore';
import { ConversationListItem } from './ConversationListItem';
import { NewChatDialog } from './NewChatDialog';
import { useAuth } from '@/features/auth/hooks/useAuth';

const getInitials = (name: string): string =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

interface ChatSidebarProps {
  className?: string;
}

export const ChatSidebar = ({ className }: ChatSidebarProps) => {
  const { user, logout } = useAuth();
  const { data: conversations, isLoading } = useInbox();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const setNewChatDialogOpen = useChatStore((s) => s.setNewChatDialogOpen);
  const theme = useChatStore((s) => s.theme);
  const toggleTheme = useChatStore((s) => s.toggleTheme);
  const [filter, setFilter] = useState('');

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!filter.trim()) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));
  }, [conversations, filter]);

  return (
    <div className={cn('flex h-full flex-col border-r border-border bg-panel', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 overflow-hidden">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
          </Avatar>
          <p className="truncate text-sm font-medium">{user?.name}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setNewChatDialogOpen(true)} aria-label="New chat">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-b border-border px-3 py-2">
        <Input
          placeholder="Search conversations"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-muted"
        />
      </div>

      <ScrollArea className="flex-1 thin-scrollbar">
        {isLoading ? (
          <div className="space-y-1 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground">Start a new chat to say hello 👋</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setNewChatDialogOpen(true)}>
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.conversation_id}
                conversation={conversation}
                isActive={conversation.conversation_id === activeConversationId}
                onClick={() => setActiveConversationId(conversation.conversation_id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      <NewChatDialog />
    </div>
  );
};
