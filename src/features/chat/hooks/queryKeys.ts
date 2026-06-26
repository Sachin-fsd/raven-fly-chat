export const inboxQueryKey = ['inbox'] as const;

export const messagesQueryKey = (conversationId: string) => ['messages', conversationId] as const;

export const conversationQueryKey = (conversationId: string) => ['conversation', conversationId] as const;

export const userSearchQueryKey = (query: string) => ['user-search', query] as const;
