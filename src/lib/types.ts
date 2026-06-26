export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

export type ConversationType = 'direct' | 'group';

export interface InboxConversationEntry {
  conversation_id: string;
  updated_at: string;
  last_message: string;
  unread_count: number;
  name: string;
  type: ConversationType;
  /** Only present for `type: 'direct'`. Not used yet — kept for when
   *  presence is reintroduced (it's keyed by user id, not conversation id). */
  other_user_id?: string;
}

export interface ParticipantInfo {
  name: string;
  email: string;
}

export interface ConversationDoc {
  _id: string;
  type: ConversationType;
  /** Only set for `type: 'group'` — groups aren't wired up in the UI yet,
   *  but the field is here so adding that flow later doesn't need a
   *  backend change. */
  name?: string;
  participants: string[];
  participantsData: Record<string, ParticipantInfo>;
  readReceipts: Record<string, number>;
  lastMessage: string;
  updatedAt: string;
  createdAt: string;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface MessageDoc {
  conversation_id: string;
  bucket: string;
  message_id: number;
  sender_id: string;
  text: string;
  created_at: string;
  /** Client-only field — never comes from the server. */
  status?: MessageStatus;
  /** Client-only correlation id used to reconcile an optimistic message
   *  with the real-time confirmation that arrives over Centrifugo. */
  clientId?: string;
}
