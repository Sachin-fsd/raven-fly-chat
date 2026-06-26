import { create } from 'zustand';

interface ChatUiState {
  /** Which conversation is currently open in the main pane. */
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  /** Mobile: whether the sidebar (inbox) or the chat pane is showing.
   *  Desktop renders both panes side by side regardless of this flag. */
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;

  theme: 'light' | 'dark';
  toggleTheme: () => void;

  isNewChatDialogOpen: boolean;
  setNewChatDialogOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatUiState>((set, get) => ({
  activeConversationId: null,
  setActiveConversationId: (id) =>
    set({
      activeConversationId: id,
      // Opening a conversation on mobile should navigate away from the
      // inbox list to the chat pane.
      isMobileSidebarOpen: id ? false : get().isMobileSidebarOpen,
    }),

  isMobileSidebarOpen: true,
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),

  theme: 'dark',
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),

  isNewChatDialogOpen: false,
  setNewChatDialogOpen: (open) => set({ isNewChatDialogOpen: open }),
}));
