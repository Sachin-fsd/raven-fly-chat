import { MessageCircle } from 'lucide-react';

/**
 * Branded splash shown while the very first render is resolving auth state
 * (the silent /auth/refresh call on boot) — the same idea as WhatsApp Web's
 * logo-centered loading screen, so there's no flash of a blank page or a
 * generic spinner before the app knows whether you're logged in.
 */
export const FullScreenLoader = () => (
  <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
      <MessageCircle className="h-8 w-8" />
    </div>
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-medium text-foreground">Chat</p>
      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground [animation-delay:200ms]" />
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-muted-foreground [animation-delay:400ms]" />
      </div>
    </div>
  </div>
);
