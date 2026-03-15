import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Users,
  Settings,
  Languages,
  Info,
  LogOut,
  ArrowLeft,
  Camera,
  Edit3,
  Check,
  Loader2,
  Trash2,
  Calendar,
  AtSign,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Palette,
  Sparkles,
  UserPlus,
  UserMinus,
  UserCheck,
  Clock,
  Search,
  Shield,
  Eye,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useLang } from '../lib/i18n';
import { getUserLink } from '../lib/deepLinks';
import { useThemeStore, type ChatTheme, type FontSize, type BubbleSize, type ColorScheme } from '../stores/themeStore';
import DatePicker from './DatePicker';
import type { User as UserType, UserPresence, FriendRequest, FriendWithId } from '../lib/types';
import SecuritySettings from './SecuritySettings';

type SideView = 'main' | 'profile' | 'settings' | 'about' | 'themes' | 'friends' | 'security';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { user, updateUser, logout } = useAuthStore();
  const { clearStore } = useChatStore();
  const { chatTheme, setChatTheme, settings: themeSettings, update: updateTheme, syncing: themeSyncing } = useThemeStore();
  const { t, lang, setLang } = useLang();

  const [view, setView] = useState<SideView>('main');
  const [prevView, setPrevView] = useState<SideView>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Friends state
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<UserPresence[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);

  const themeCards: { id: ChatTheme; color: string; accent: string; name: string; nameEn: string; desc: string; descEn: string; animated?: boolean; gradient?: string }[] = [
    { id: 'midnight', color: '#0f0f13', accent: '#6366f1', name: 'Полночь', nameEn: 'Midnight', desc: 'Тёмная тема с мягкими акцентами', descEn: 'Dark theme with soft accents' },
    { id: 'ocean', color: '#0b172a', accent: '#3b82f6', name: 'Океан', nameEn: 'Ocean', desc: 'Глубокий синий с прохладными тонами', descEn: 'Deep blue with cool tones' },
    { id: 'forest', color: '#0f1c15', accent: '#10b981', name: 'Лес', nameEn: 'Forest', desc: 'Природный зелёный и спокойствие', descEn: 'Natural green and serenity' },
    { id: 'sunset', color: '#1f111a', accent: '#ec4899', gradient: 'linear-gradient(135deg, #1f111a, #150a0f)', name: 'Закат', nameEn: 'Sunset', desc: 'Тёплый розовый градиент заката', descEn: 'Warm pink sunset gradient' },
    { id: 'classic', color: '#121215', accent: '#a1a1aa', name: 'Классика', nameEn: 'Classic', desc: 'Минималистичная монохромная тема', descEn: 'Minimalist monochrome theme' },
    { id: 'neon', color: '#0b0f19', accent: '#8b5cf6', name: 'Неон', nameEn: 'Neon', desc: 'Фиолетовое свечение за курсором', descEn: 'Purple glow follows your cursor', animated: true },
    { id: 'aurora', color: '#022c22', accent: '#10b981', gradient: 'linear-gradient(135deg, #022c22, #064e3b)', name: 'Аврора', nameEn: 'Aurora', desc: 'Северное сияние реагирует на мышь', descEn: 'Northern lights react to mouse', animated: true },
    { id: 'cyber', color: '#000000', accent: '#f59e0b', name: 'Кибер', nameEn: 'Cyber', desc: 'Сетка и янтарное свечение мыши', descEn: 'Grid pattern with amber glow', animated: true },
    { id: 'glass', color: '#0d1117', accent: '#3b82f6', name: 'Стекло', nameEn: 'Glass', desc: 'Плавное свечение следует за мышью', descEn: 'Smooth glow follows the cursor', animated: true },
    { id: 'void', color: '#000000', accent: '#ffffff', name: 'Бездна', nameEn: 'Void', desc: 'Абсолютный мрак с точечным светом', descEn: 'Absolute darkness with spot light', animated: true },
  ];

  const changeView = (next: SideView) => {
    setPrevView(view);
    setView(next);
    if (next === 'themes') {
      const idx = themeCards.findIndex(tc => tc.id === chatTheme);
      if (idx >= 0) setThemeIndex(idx);
    }
    if (next === 'friends') {
      loadFriends();
    }
  };

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const [friendsList, requests] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsList);
      setFriendRequests(requests);
    } catch (e) {
      console.error('Load friends error:', e);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await api.acceptFriendRequest(requestId);
      const req = friendRequests.find(r => r.id === requestId);
      if (req) {
        const socket = getSocket();
        if (socket) socket.emit('friend_accepted', { friendId: req.user.id });
      }
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await api.declineFriendRequest(requestId);
      setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    try {
      const friend = friends.find(f => f.friendshipId === friendshipId);
      await api.removeFriend(friendshipId);
      if (friend) {
        const socket = getSocket();
        if (socket) socket.emit('friend_removed', { friendId: friend.id });
      }
      setFriends(prev => prev.filter(f => f.friendshipId !== friendshipId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendFriendRequest = async (friendId: string) => {
    try {
      const result = await api.sendFriendRequest(friendId);
      const socket = getSocket();
      if (socket) socket.emit('friend_request', { friendId });
      // If auto-accepted (they already sent us a request), reload friends
      if (result.status === 'accepted') {
        loadFriends();
      }
      // Remove from search results
      setFriendSearchResults(prev => prev.filter(u => u.id !== friendId));
    } catch (e) {
      console.error(e);
    }
  };

  // Friend search effect
  useEffect(() => {
    const raw = friendSearch.trim();
    const q = raw.startsWith('@') ? raw.slice(1) : raw;
    if (q.length < 3) {
      setFriendSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setFriendSearchLoading(true);
        const results = await api.searchUsers(q);
        // Filter out self and already-friends
        const friendIds = new Set(friends.map(f => f.id));
        setFriendSearchResults(results.filter(u => u.id !== user?.id && !friendIds.has(u.id)));
      } catch (e) {
        console.error(e);
      } finally {
        setFriendSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [friendSearch, friends, user?.id]);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => { setView('main'); setPrevView('main'); }, 300);
      setIsEditing(false);
      setFriendSearch('');
      setFriendSearchResults([]);
      return () => clearTimeout(timer);
    }
    // Load friend request count when menu opens
    api.getFriendRequests().then(setFriendRequests).catch(() => {});
  }, [isOpen]);

  // Real-time friend updates via socket
  const loadFriendsRef = useRef(loadFriends);
  loadFriendsRef.current = loadFriends;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onFriendRequestReceived = () => {
      // Reload friend requests when a new request arrives
      api.getFriendRequests().then(setFriendRequests).catch(() => {});
    };

    const onFriendRequestAccepted = () => {
      // Someone accepted our request — reload friends
      loadFriendsRef.current();
    };

    const onFriendRemoved = (data: { userId: string }) => {
      // Remove this user from our friends list
      setFriends(prev => prev.filter(f => f.id !== data.userId));
    };

    socket.on('friend_request_received', onFriendRequestReceived);
    socket.on('friend_request_accepted', onFriendRequestAccepted);
    socket.on('friend_removed', onFriendRemoved);

    return () => {
      socket.off('friend_request_received', onFriendRequestReceived);
      socket.off('friend_request_accepted', onFriendRequestAccepted);
      socket.off('friend_removed', onFriendRemoved);
    };
  }, []);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setBirthday(user.birthday || '');
    }
  }, [user]);

  const handleLogout = () => {
    clearStore();
    logout();
    onClose();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const updated = await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        birthday: birthday || undefined,
      });
      updateUser(updated);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const updated = await api.uploadAvatar(file);
      updateUser(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUploading(true);
      await api.removeAvatar();
      updateUser({ avatar: null });
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarUploading(false);
    }
  };

  const initials = (user?.displayName || user?.username || '??')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const menuItems = [
    { icon: User, label: t('myProfile'), onClick: () => changeView('profile') },
    { icon: Users, label: t('friends'), onClick: () => changeView('friends'), badge: friendRequests.length > 0 ? friendRequests.length : undefined },
    { icon: Settings, label: t('settings'), onClick: () => changeView('settings') },
    { divider: true },
    { icon: Info, label: t('aboutApp'), subtitle: 'Vortex Messenger v1.0', onClick: () => changeView('about') },
  ];

  // Slide direction for animations
  const slideDir = prevView === 'main' ? 1 : -1;
  const viewVariants = {
    enter: (dir: number) => ({ x: dir * 100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 100, opacity: 0 }),
  };

  // ======= MAIN VIEW =======
  const renderMain = () => (
    <motion.div key="main" className="flex flex-col h-full" initial={false} animate="center" exit="exit" variants={viewVariants} custom={-1} transition={{ duration: 0.2 }}>
      
          </div>
        </div>
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('about')}</h4>
          <div className="flex items-center gap-4 px-3 py-3 rounded-xl bg-surface-tertiary/50">
            <Info size={18} className="text-zinc-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200">Vortex Messenger</p>
              <p className="text-xs text-zinc-500">{t('version')} 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ======= THEMES VIEW =======
  const renderThemes = () => {
    const currentCard = themeCards[themeIndex];
    const isActive = chatTheme === currentCard.id;

    const ACCENT_PRESETS = [
      '#6366f1','#8b5cf6','#ec4899','#3b82f6','#10b981',
      '#f59e0b','#ef4444','#06b6d4','#f97316','#ffffff',
    ];

    const BG_GRADIENTS = [
      { id: 'default', label: 'По умолчанию', preview: 'bg-zinc-900' },
      { id: 'gradient:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', label: 'Ночь', preview: '' },
      { id: 'gradient:linear-gradient(135deg,#0f2027,#203a43,#2c5364)', label: 'Океан', preview: '' },
      { id: 'gradient:linear-gradient(135deg,#1a0533,#2d1b69,#11998e)', label: 'Аврора', preview: '' },
      { id: 'gradient:linear-gradient(135deg,#1f0c1c,#3b1f2b,#1a0a0a)', label: 'Закат', preview: '' },
      { id: 'pattern:dots', label: 'Точки', preview: '' },
      { id: 'pattern:grid', label: 'Сетка', preview: '' },
      { id: 'pattern:waves', label: 'Волны', preview: '' },
    ];

    return (
      <motion.div key="themes" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
          <button onClick={() => changeView('settings')} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h3 className="text-sm font-semibold text-white flex-1">Кастомизация</h3>
          {themeSyncing && <span className="text-xs text-zinc-600">сохр...</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* ── Цветовая схема ── */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">Режим</p>
            <div className="grid grid-cols-3 gap-2">
              {([['dark','🌙','Тёмная'],['light','☀️','Светлая'],['auto','⚡','Авто']] as [ColorScheme,string,string][]).map(([id, emoji, label]) => (
                <button key={id} onClick={() => updateTheme({ colorScheme: id })}
                  className={`py-2.5 rounded-xl text-sm flex flex-col items-center gap-1 transition-all border ${themeSettings.colorScheme === id ? 'border-accent bg-accent/15 text-accent' : 'border-white/8 bg-surface-tertiary/50 text-zinc-400 hover:border-white/15'}`}>
                  <span className="text-lg">{emoji}</span>
                  <span className="text-xs">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Цвет акцента ── */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">Цвет акцента</p>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_PRESETS.map(color => (
                <button key={color} onClick={() => updateTheme({ accentColor: color })}
                  style={{ backgroundColor: color }}
                  className={`w-8 h-8 rounded-full transition-all border-2 ${themeSettings.accentColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}>
                  {themeSettings.accentColor === color && <span className="text-white text-xs font-bold flex items-center justify-center h-full">{color === '#ffffff' ? '✓' : '✓'}</span>}
                </button>
              ))}
              {/* Custom color picker */}
              <label className="w-8 h-8 rounded-full border-2 border-dashed border-zinc-600 hover:border-zinc-400 flex items-center justify-center cursor-pointer transition-all relative overflow-hidden" title="Свой цвет">
                <span className="text-zinc-400 text-lg">+</span>
                <input type="color" value={themeSettings.accentColor} onChange={e => updateTheme({ accentColor: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border border-zinc-600" style={{ backgroundColor: themeSettings.accentColor }}/>
              <span className="text-xs text-zinc-500 font-mono">{themeSettings.accentColor}</span>
            </div>
          </div>

          {/* ── Пресеты тем ── */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">Тема интерфейса</p>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => setThemeIndex(i => (i - 1 + themeCards.length) % themeCards.length)} className="p-1.5 rounded-lg bg-surface-tertiary/60 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16}/></button>
              <div className="flex-1 overflow-hidden rounded-xl border border-border/40"
                style={currentCard.gradient ? { background: currentCard.gradient } : { backgroundColor: currentCard.color }}>
                <div className="p-3 flex flex-col gap-1.5">
                  <div className="self-start px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-white/10 text-[11px] text-white/70">Привет! 👋</div>
                  <div className="self-end px-2.5 py-1.5 rounded-xl rounded-br-sm text-[11px] text-white/80" style={{ backgroundColor: currentCard.accent + '60' }}>Привет! ✨</div>
                </div>
                <div className="px-3 py-2 bg-black/20 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: currentCard.accent }}/>
                  <span className="text-white text-xs font-semibold">{lang === 'ru' ? currentCard.name : currentCard.nameEn}</span>
                  {currentCard.animated && <span className="text-[9px] text-yellow-400">✨</span>}
                </div>
              </div>
              <button onClick={() => setThemeIndex(i => (i + 1) % themeCards.length)} className="p-1.5 rounded-lg bg-surface-tertiary/60 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16}/></button>
            </div>
            <button onClick={() => setChatTheme(currentCard.id)} disabled={isActive}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-accent/15 text-accent ring-1 ring-accent/30 cursor-default' : 'bg-accent text-white hover:bg-accent/90'}`}>
              {isActive ? '✓ Применено' : 'Применить тему'}
            </button>
            <div className="flex gap-1 mt-2 justify-center">
              {themeCards.map((tc, i) => (
                <button key={tc.id} onClick={() => setThemeIndex(i)}
                  className={`rounded-full transition-all ${i === themeIndex ? 'w-4 h-1.5 bg-accent' : chatTheme === tc.id ? 'w-1.5 h-1.5 bg-accent/50' : 'w-1.5 h-1.5 bg-zinc-700 hover:bg-zinc-500'}`}/>
              ))}
            </div>
          </div>

          {/* ── Фон чата ── */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">Фон чата</p>
            <div className="grid grid-cols-4 gap-2">
              {BG_GRADIENTS.map(bg => (
                <button key={bg.id} onClick={() => updateTheme({ chatBg: bg.id })}
                  className={`h-12 rounded-xl border-2 transition-all overflow-hidden ${themeSettings.chatBg === bg.id ? 'border-accent scale-105' : 'border-transparent hover:border-zinc-600'}`}
                  style={bg.id === 'default' ? { backgroundColor: '#18181b' } : bg.id.startsWith('gradient:') ? { background: bg.id.slice(9) } : { backgroundColor: '#18181b' }}
                  title={bg.label}>
                  {bg.id === 'default' && <span className="text-zinc-500 text-xs flex items-center justify-center h-full">—</span>}
                  {bg.id.startsWith('pattern:') && (
                    <span className="text-zinc-400 text-[10px] flex items-center justify-center h-full leading-tight px-1 text-center">{bg.label}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Размер шрифта ── */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">Размер шрифта</p>
            <div className="grid grid-cols-3 gap-2">
              {([['small','Маленький','text-xs'],['medium','Средний','text-sm'],['large','Крупный','text-base']] as [FontSize,string,string][]).map(([id, label, cls]) => (
                <button key={id} onClick={() => updateTheme({ fontSize: id })}
                  className={`py-2.5 rounded-xl transition-all border ${themeSettings.fontSize === id ? 'border-accent bg-accent/15 text-accent' : 'border-white/8 bg-surface-tertiary/50 text-zinc-400 hover:border-white/15'}`}>
                  <span className={`${cls} font-medium block`}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Размер пузырей ── */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-2.5">Размер сообщений</p>
            <div className="grid grid-cols-3 gap-2">
              {([['compact','Compact','Компакт'],['normal','Normal','Обычный'],['comfortable','Comfort','Просторно']] as [BubbleSize,string,string][]).map(([id, en, ru]) => (
                <button key={id} onClick={() => updateTheme({ bubbleSize: id })}
                  className={`py-2.5 rounded-xl text-xs transition-all border ${themeSettings.bubbleSize === id ? 'border-accent bg-accent/15 text-accent' : 'border-white/8 bg-surface-tertiary/50 text-zinc-400 hover:border-white/15'}`}>
                  {lang === 'ru' ? ru : en}
                </button>
              ))}
            </div>
          </div>

          {/* ── Сброс ── */}
          <button onClick={() => updateTheme({ accentColor: '#6366f1', fontSize: 'medium', bubbleSize: 'normal', colorScheme: 'dark', chatBg: 'default' })}
            className="w-full py-2 rounded-xl text-xs text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-600 transition-all">
            Сбросить настройки
          </button>

        </div>
      </motion.div>
    );
  };

  // ======= FRIENDS VIEW =======
  const renderFriends = () => (
    <motion.div key="friends" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <button onClick={() => { changeView('main'); setFriendSearch(''); setFriendSearchResults([]); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('friends')}</h3>
      </div>

      {/* Search bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={t('searchFriends')}
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {friendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            {/* Search results */}
            {friendSearch.trim().length > 0 && (
              <div className="px-4 pt-2 pb-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  <Search size={12} className="inline mr-1" />{t('searchFriends').split('(')[0].trim()}
                </h4>
                {(() => {
                  const raw = friendSearch.trim();
                  const q = raw.startsWith('@') ? raw.slice(1) : raw;
                  if (q.length < 3) {
                    return <p className="text-xs text-zinc-500 text-center py-3">{t('minCharsHint')}</p>;
                  }
                  if (friendSearchLoading) {
                    return (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={18} className="animate-spin text-zinc-400" />
                      </div>
                    );
                  }
                  if (friendSearchResults.length === 0) {
                    return <p className="text-xs text-zinc-500 text-center py-3">{t('noSearchResults')}</p>;
                  }
                  return (
                    <div className="space-y-1">
                      {friendSearchResults.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border/50">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                              {(u.displayName || u.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                            <p className="text-xs text-zinc-500">@{u.username}</p>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(u.id)}
                            className="p-2 rounded-lg bg-vortex-500/20 text-vortex-400 hover:bg-vortex-500/30 transition-colors"
                            title={t('addFriend')}
                          >
                            <UserPlus size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Incoming requests */}
            {friendRequests.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  {t('friendRequests')} ({friendRequests.length})
                </h4>
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-border/50">
                      {req.user.avatar ? (
                        <img src={req.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {(req.user.displayName || req.user.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{req.user.displayName || req.user.username}</p>
                        <p className="text-xs text-zinc-500">@{req.user.username}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                          title={t('accept')}
                        >
                          <UserCheck size={16} />
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          title={t('decline')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div className="px-4 pt-4 pb-2">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {t('friendsList')} ({friends.length})
              </h4>
              {friends.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">{t('noFriends')}</p>
              ) : (
                <div className="space-y-1">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group/friend">
                      <div className="relative">
                        {friend.avatar ? (
                          <img src={friend.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-vortex-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {(friend.displayName || friend.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        {friend.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-surface-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{friend.displayName || friend.username}</p>
                        <p className="text-xs text-zinc-500">
                          {friend.isOnline ? t('online') : `@${friend.username}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.friendshipId)}
                        className="p-2 rounded-lg text-zinc-600 opacity-0 group-hover/friend:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title={t('removeFriend')}
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );

  // ======= ABOUT VIEW =======
  const renderAbout = () => (
    <motion.div key="about" className="flex flex-col h-full" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <button onClick={() => changeView('main')} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('aboutApp')}</h3>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <img src="/logo.png" alt="Vortex" className="w-20 h-20 rounded-2xl object-cover mb-4 ring-2 ring-white/10" />
        <h2 className="text-xl font-bold gradient-text mb-1">Vortex Messenger</h2>
        <p className="text-sm text-zinc-400 mb-6">{t('version')} 1.0.0</p>
        <div className="text-xs text-zinc-500 space-y-1">
          <p>{t('modernMessenger')}</p>
          <p>{t('onPrivacy')}</p>
          <p className="mt-4 text-zinc-600">© 2026 Vortex Team</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-3 top-3 bottom-3 w-[340px] max-w-[calc(100vw-24px)] bg-surface-secondary/95 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-border/50 rounded-3xl z-50 flex flex-col overflow-hidden"
          >
            <AnimatePresence mode="wait" custom={slideDir}>
              {view === 'main' && renderMain()}
              {view === 'profile' && renderProfile()}
              {view === 'settings' && renderSettings()}
              {view === 'themes' && renderThemes()}
              {view === 'friends' && renderFriends()}
              {view === 'about' && renderAbout()}
              {view === 'security' && <SecuritySettings onClose={() => changeView('settings')} />}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
