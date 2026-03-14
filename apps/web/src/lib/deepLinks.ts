import { api } from './api';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';

export type DeepLinkResult =
  | { type: 'user'; username: string }
  | { type: 'chat'; chatId: string }
  | { type: 'invite'; code: string }
  | { type: 'none' };

// Parse current URL into a deep link
export function parseDeepLink(): DeepLinkResult {
  const path = window.location.pathname;

  // /@username or /username (starts with letter, no slash after)
  const userMatch = path.match(/^\/@?([a-zA-Z0-9_]{3,20})$/);
  if (userMatch) return { type: 'user', username: userMatch[1] };

  // /chat/ID
  const chatMatch = path.match(/^\/chat\/([a-f0-9-]{36})$/);
  if (chatMatch) return { type: 'chat', chatId: chatMatch[1] };

  // /invite/CODE
  const inviteMatch = path.match(/^\/invite\/([a-z0-9]{10,20})$/);
  if (inviteMatch) return { type: 'invite', code: inviteMatch[1] };

  return { type: 'none' };
}

// Clear the deep link from URL without page reload
export function clearDeepLink() {
  window.history.replaceState({}, '', '/');
}

// Handle deep link after user is logged in
export async function handleDeepLink(link: DeepLinkResult): Promise<{
  action: 'open-profile' | 'open-chat' | 'show-invite' | 'none';
  data?: unknown;
}> {
  if (link.type === 'none') return { action: 'none' };

  try {
    if (link.type === 'user') {
      const { user } = await api.request<{ user: unknown }>(`/users/by-username/${link.username}`);
      return { action: 'open-profile', data: user };
    }

    if (link.type === 'chat') {
      const store = useChatStore.getState();
      const chat = store.chats.find(c => c.id === link.chatId);
      if (chat) {
        store.setActiveChat(link.chatId);
        return { action: 'open-chat', data: chat };
      }
      return { action: 'none' };
    }

    if (link.type === 'invite') {
      // Get info about the group before joining
      const data = await api.request<{ chat: unknown; alreadyMember?: boolean }>(`/chats/join/${link.code}`, {
        method: 'POST',
      });
      return { action: 'show-invite', data };
    }
  } catch (e) {
    console.warn('Deep link failed:', e);
  }

  return { action: 'none' };
}

// Generate shareable link for user
export function getUserLink(username: string): string {
  return `${window.location.origin}/@${username}`;
}

// Generate shareable link for chat
export function getChatLink(chatId: string): string {
  return `${window.location.origin}/chat/${chatId}`;
}
