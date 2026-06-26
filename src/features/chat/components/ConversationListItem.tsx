'use client';

import { formatDistanceToNowStrict } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { InboxConversationEntry } from '@/lib/types';

interface ConversationListItemProps {
  conversation: InboxConversationEntry;
  isActive: boolean;
  onClick: () => void;
}

const getInitials = (name: string): string =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const ConversationListItem = ({ conversation, isActive, onClick }: ConversationListItemProps) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
        isActive && 'bg-accent hover:bg-accent',
      )}
    >
      <Avatar className="shrink-0">
        <AvatarFallback>{getInitials(conversation.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">{conversation.name}</p>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {formatDistanceToNowStrict(new Date(conversation.updated_at), { addSuffix: false })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">{conversation.last_message || 'Say hello 👋'}</p>
          {conversation.unread_count > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
