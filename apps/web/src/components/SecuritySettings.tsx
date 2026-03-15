import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Monitor, Smartphone, Trash2, LogOut } from 'lucide-react';

interface Session {
  id: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  ip?: string;
  country?: string;
  city?: string;
  isCurrent?: boolean;
  createdAt: string;
  lastActiveAt: string;
}

interface BlockedUser {
  id: string;
  blockedId: string;
  blocked: { id: string; username: string; displayName: string; avatar?: string };
}

function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  return `${days} дн. назад`;
}

function DeviceIcon({ os }: { os?: string }) {
  if (os && /iPhone|iPad|Android/.test(os)) return <Smartphone size={20} />;
  return <Monitor size={20} />;
}

interface Props { onClose: () => void; }

export default function SecuritySettings({ onClose }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBlocked, setShowBlocked] = useState(false);

  const getHeaders = () => {
    const token = localStorage.getItem('zync_token') || localStorage.getItem('vortex_token') || '';
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
    (async () => {
      try {
        const [sessRes, blockRes] = await Promise.all([
          fetch('/api/auth/sessions', { headers: getHeaders() }),
          fetch('/api/blocks', { headers: getHeaders() }),
        ]);
        const sessData = await sessRes.json();
        const blockData = await blockRes.json();
        setSessions(sessData.sessions || []);
        setBlockedUsers(Array.isArray(blockData) ? blockData : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const terminateSession = async (id: string) => {
    await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE', headers: getHeaders() });
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const terminateAll = async () => {
    await fetch('/api/auth/sessions', { method: 'DELETE', headers: getHeaders() });
    setSessions(prev => prev.filter(s => s.isCurrent));
  };

  const unblockUser = async (blockedId: string) => {
    await fetch(`/api/blocks/${blockedId}`, { method: 'DELETE', headers: getHeaders() });
    setBlockedUsers(prev => prev.filter(b => b.blockedId !== blockedId));
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="glass-strong rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="h-14 flex items-center justify-between px-5 border-b border-border flex-shrink-0">
          <h2 className="text-white font-semibold">Безопасность</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-border/50">
                <button onClick={() => setShowBlocked(v => !v)}
                  className="w-full flex items-center justify-between text-sm text-zinc-300 hover:text-white transition-colors">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-red-400"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                    <span>Заблокированные</span>
                    {blockedUsers.length > 0 && <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">{blockedUsers.length}</span>}
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 transition-transform ${showBlocked ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <AnimatePresence>
                  {showBlocked && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-2 pt-3">
                        {blockedUsers.length === 0
                          ? <p className="text-zinc-600 text-sm text-center py-3">Нет заблокированных</p>
                          : blockedUsers.map(b => (
                            <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/3 border border-white/5">
                              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {b.blocked.avatar ? <img src={b.blocked.avatar} className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-zinc-400">{(b.blocked.displayName || b.blocked.username)[0].toUpperCase()}</span>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{b.blocked.displayName || b.blocked.username}</p>
                                <p className="text-xs text-zinc-500">@{b.blocked.username}</p>
                              </div>
                              <button onClick={() => unblockUser(b.blockedId)} className="px-3 py-1 rounded-lg bg-surface-tertiary text-zinc-400 hover:text-white hover:bg-surface-hover text-xs transition-all border border-white/8">Разблок.</button>
                            </div>
                          ))
                        }
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Активные сессии</p>
                  {sessions.filter(s => !s.isCurrent).length > 0 && (
                    <button onClick={terminateAll} className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
                      <LogOut size={12} />Завершить все
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {sessions.map(s => (
                    <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${s.isCurrent ? 'bg-accent/5 border-accent/20' : 'bg-white/3 border-white/5'}`}>
                      <div className={`mt-0.5 ${s.isCurrent ? 'text-accent' : 'text-zinc-500'}`}><DeviceIcon os={s.os} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-white font-medium truncate">{s.browser || 'Браузер'}{s.os ? ` · ${s.os}` : ''}</p>
                          {s.isCurrent && <span className="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-xs flex-shrink-0">Это устройство</span>}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{s.ip}{s.city ? ` · ${s.city}` : ''}{s.country ? `, ${s.country}` : ''}</p>
                        <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(s.lastActiveAt)}</p>
                      </div>
                      {!s.isCurrent && (
                        <button onClick={() => terminateSession(s.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
