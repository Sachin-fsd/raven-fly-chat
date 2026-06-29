'use client';

import { format } from 'date-fns';
import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageDoc } from '@/lib/types';

interface MessageBubbleProps {
  message: MessageDoc;
  isOwn: boolean;
}

const StatusIcon = ({ status }: { status: MessageDoc['status'] }) => {
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 text-muted-foreground" />;
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-sky-500" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />;
    default:
      return null;
  }
};

export const MessageBubble = ({ message, isOwn }: MessageBubbleProps) => {
  return (
    <div className={cn('flex animate-slide-in-right', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'group relative max-w-[75%] rounded-2xl px-3.5 py-2 shadow-sm',
          isOwn
            ? 'rounded-br-md bg-bubble-sent text-bubble-sent-foreground'
            : 'rounded-bl-md bg-bubble-received text-bubble-received-foreground',
          message.status === 'sending' && 'opacity-60',
          message.status === 'failed' && 'border border-destructive/40',
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
        <div className="mt-1 flex items-center justify-end gap-1">
          <span className="text-[10px] text-muted-foreground">{format(new Date(message.created_at), 'HH:mm')}</span>
          {isOwn && <StatusIcon status={message.status ?? 'sent'} />}
        </div>
      </div>
    </div>
  );
};
