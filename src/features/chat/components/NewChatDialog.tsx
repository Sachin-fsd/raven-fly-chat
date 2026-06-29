'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useUserSearch, useCreateConversation } from '../hooks/useUserSearch';
import { useChatStore } from '../store/useChatStore';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

const getInitials = (name: string): string =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

export const NewChatDialog = () => {
  const isOpen = useChatStore((s) => s.isNewChatDialogOpen);
  const setOpen = useChatStore((s) => s.setNewChatDialogOpen);
  const setActiveConversationId = useChatStore((s) => s.setActiveConversationId);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);

  // isFetching would otherwise flash on every keystroke before the debounce
  // even fires; comparing against the debounced value tells us whether
  // we're "about to search" (still typing) vs. actually waiting on the
  // network, so the spinner only shows when a request is genuinely in flight.
  const { data: results, isFetching } = useUserSearch(debouncedQuery);
  const isPendingDebounce = query !== debouncedQuery;
  const createConversation = useCreateConversation();

  const handleSelectUser = (userId: string, userName: string, userEmail: string) => {
    createConversation.mutate(
      { id: userId, name: userName, email: userEmail },
      {
        onSuccess: ({ conversation }) => {
          setActiveConversationId(conversation._id);
          setOpen(false);
          setQuery('');
        },
      },
    );
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-panel p-5 shadow-lg animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">New conversation</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search by name or email"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-72 overflow-y-auto thin-scrollbar">
            {(isFetching || isPendingDebounce) && query.trim().length > 0 && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {!isFetching && !isPendingDebounce && query.trim().length > 0 && results?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found</p>
            )}

            {!isPendingDebounce &&
              results?.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user.id, user.name, user.email)}
                  disabled={createConversation.isPending}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <Avatar>
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </button>
              ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
