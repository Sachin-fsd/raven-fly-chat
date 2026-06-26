import { MessageCircle } from 'lucide-react';

export const EmptyState = () => (
  <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted/40 px-6 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <MessageCircle className="h-8 w-8" />
    </div>
    <h2 className="text-lg font-medium text-foreground">Your messages</h2>
    <p className="max-w-xs text-sm text-muted-foreground">
      Select a conversation from the list, or start a new one, to begin chatting.
    </p>
  </div>
);
