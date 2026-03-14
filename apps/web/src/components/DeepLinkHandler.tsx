import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseDeepLink, handleDeepLink, clearDeepLink } from '../lib/deepLinks';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { X, Users, MessageCircle, UserPlus, Check, Link } from 'lucide-react';
import type { User } from '../lib/types';
import type { Chat } from '../lib/types';

interface InviteData { chat: Chat; alreadyMember: boolean }

export default function DeepLinkHandler() {
  const { user: me, token } = useAuthStore();
  const { setActiveChat, loadChats } = useChatStore();
  const [inviteModal, setInviteModal] = useState<InviteData | null>(null);
  const [profileModal, setProfileModal] = useState<User | null>(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!me || !token) return;
    const link = parseDeepLink();
    if (link.type === 'none') return;

    handleDeepLink(link).then(result => {
      clearDeepLink();
      if (result.action === 'open-profile') {
        setProfileModal(result.data as User);
      } else if (result.action === 'show-invite') {
        const d = result.data as InviteData;
        if (d.alreadyMember) {
          setActiveChat(d.chat.id);
        } else {
          setInviteModal(d);
        }
      } else if (result.action === 'open-chat') {
        setActiveChat((result.data as Chat).id);
      }
    });
  }, [me?.id]);

  const joinGroup = async () => {
    if (!inviteModal) return;
    setJoining(true);
    try {
      await loadChats();
      setActiveChat(inviteModal.chat.id);
      setJoined(true);
      setTimeout(() => setInviteModal(null), 1200);
    } catch {}
    setJoining(false);
  };

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const startChat = async () => {
    if (!profileModal) return;
    try {
      const { api } = await import('../lib/api');
      const chat = await api.request<Chat>('/chats/personal', {
        method: 'POST',
        body: JSON.stringify({ userId: profileModal.id }),
      });
      await loadChats();
      setActiveChat(chat.id);
      setProfileModal(null);
    } catch {}
  };

  return (
    <>
      {/* ── Invite modal ── */}
      <AnimatePresence>
        {inviteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && setInviteModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-strong rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center">
                  {inviteModal.chat.avatar
                    ? <img src={inviteModal.chat.avatar} className="w-14 h-14 rounded-2xl object-cover" />
                    : <Users size={28} className="text-accent" />}
                </div>
                <button onClick={() => setInviteModal(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>

              <h2 className="text-white font-bold text-xl mb-1">{inviteModal.chat.name || 'Группа'}</h2>
              <p className="text-zinc-500 text-sm mb-6">Вас пригласили в эту группу</p>

              {joined ? (
                <div className="flex items-center justify-center gap-2 py-3 text-green-400">
                  <Check size={20} />
                  <span className="font-medium">Вы вступили!</span>
                </div>
              ) : (
                <button onClick={joinGroup} disabled={joining}
                  className="w-full py-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {joining
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><UserPlus size={18} />Вступить в группу</>}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile quick-view modal ── */}
      <AnimatePresence>
        {profileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && setProfileModal(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-strong rounded-3xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-800 flex items-center justify-center">
                  {profileModal.avatar
                    ? <img src={profileModal.avatar} className="w-full h-full object-cover" />
                    : <span className="text-2xl font-bold text-zinc-400">{(profileModal.displayName || profileModal.username)[0].toUpperCase()}</span>}
                </div>
                <button onClick={() => setProfileModal(null)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-white font-bold text-xl">{profileModal.displayName || profileModal.username}</h2>
                {profileModal.isVerified && (
                  <svg viewBox="0 0 22 22" fill="none" style={{ width: 18, height: 18 }}>
                    <path d="M11 2L13.5 4.5L17 4L18 7.5L21 9.5L20 13L22 16L19 17.5L18 21L14.5 20L11 22L7.5 20L4 21L3 17.5L0 16L2 13L1 9.5L4 7.5L5 4L8.5 4.5L11 2Z" fill="#2B82CD"/>
                    <path d="M7 11L10 14L15 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <p className="text-zinc-500 text-sm mb-1">@{profileModal.username}</p>
              {profileModal.bio && <p className="text-zinc-400 text-sm mt-2 mb-4">{profileModal.bio}</p>}

              <div className="flex gap-2 mt-4">
                <button onClick={startChat}
                  className="flex-1 py-2.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
                  <MessageCircle size={16} />Написать
                </button>
                <button onClick={() => copyLink(`${window.location.origin}/@${profileModal.username}`)}
                  className="px-4 py-2.5 rounded-xl bg-surface-tertiary text-zinc-300 hover:bg-surface-hover transition-all flex items-center gap-2">
                  {copied ? <Check size={16} className="text-green-400" /> : <Link size={16} />}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
