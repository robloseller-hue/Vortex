import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Monitor, Smartphone, Globe, Trash2, Clock, MapPin, X, Mail, Check, AlertTriangle, ChevronRight } from 'lucide-react';

interface Session {
  id: string;
  deviceName: string;
  browser: string;
  os: string;
  ip: string;
  country: string;
  city: string;
  isCurrent: boolean;
  createdAt: string;
  lastActiveAt: string;
}

interface Props {
  onBack: () => void;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  return `${days} дн. назад`;
}

function getDeviceIcon(os: string) {
  if (/iPhone|iPad|Android/.test(os)) return <Smartphone size={20} />;
  return <Monitor size={20} />;
}

export default function SecuritySettings({ onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [twoFa, setTwoFa] = useState({ enabled: false, email: null as string | null });
  const [loading, setLoading] = useState(true);

  // 2FA setup flow
  const [view, setView] = useState<'main' | 'setup-email' | 'setup-code' | 'disable'>('main');
  const [email, setEmail] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [code, setCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blockedId: string; blocked: { id: string; username: string; displayName: string; avatar?: string } }[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);

  const token = localStorage.getItem('zync_token') || localStorage.getItem('vortex_token') || '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions', { headers });
      const data = await res.json();
      setSessions(data.sessions || []);
      try {
        const token2 = localStorage.getItem('zync_token') || localStorage.getItem('vortex_token') || '';
        const blocksRes = await fetch('/api/blocks', { headers: { 'Authorization': `Bearer ${token2}` } });
        const blocksData = await blocksRes.json();
        setBlockedUsers(Array.isArray(blocksData) ? blocksData : []);
      } catch {}
      setTwoFa(data.twoFa || { enabled: false, email: null });
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const revokeSession = async (id: string) => {
    try {
      await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE', headers });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {}
  };

  const revokeAll = async () => {
    setWorking(true);
    try {
      await fetch('/api/auth/sessions', { method: 'DELETE', headers });
      setSessions(prev => prev.filter(s => s.isCurrent));
      setMsg({ text: 'Все другие сессии завершены', type: 'success' });
    } catch { setMsg({ text: 'Ошибка', type: 'error' }); }
    setWorking(false);
  };

  const sendSetupCode = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg({ text: 'Введите корректный email', type: 'error' }); return;
    }
    setWorking(true); setMsg(null);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST', headers,
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailHint(data.emailHint);
      setView('setup-code');
      setMsg({ text: `Код отправлен на ${data.emailHint}`, type: 'success' });
    } catch (e: any) { setMsg({ text: e.message, type: 'error' }); }
    setWorking(false);
  };

  const confirmEnable = async () => {
    setWorking(true); setMsg(null);
    try {
      const res = await fetch('/api/auth/2fa/enable', {
        method: 'POST', headers,
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTwoFa({ enabled: true, email: data.email });
      setView('main');
      setCode(''); setEmail('');
      setMsg({ text: '2FA успешно включена!', type: 'success' });
    } catch (e: any) { setMsg({ text: e.message, type: 'error' }); }
    setWorking(false);
  };

  const disableTwoFa = async () => {
    setWorking(true); setMsg(null);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST', headers,
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTwoFa({ enabled: false, email: null });
      setView('main');
      setDisablePassword('');
      setMsg({ text: '2FA отключена', type: 'success' });
    } catch (e: any) { setMsg({ text: e.message, type: 'error' }); }
    setWorking(false);
  };

  const Notification = () => msg ? (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className={`p-3 rounded-xl text-sm ${msg.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-green-500/10 border border-green-500/20 text-green-400'}`}>
      {msg.text}
    </motion.div>
  ) : null;

  return (
    <motion.div key="security" className="flex flex-col h-full"
      initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
        <button onClick={view !== 'main' ? () => { setView('main'); setMsg(null); } : onBack}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">
          {view === 'main' ? 'Безопасность' : view === 'setup-email' ? 'Включить 2FA' : view === 'setup-code' ? 'Подтверждение' : 'Отключить 2FA'}
        </h3>
        {view !== 'main' && <button onClick={() => { setView('main'); setMsg(null); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"><X size={16}/></button>}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* ── Main view ─────────────────────────────────────── */}
          {view === 'main' && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              <AnimatePresence>{msg && <Notification />}</AnimatePresence>

              {/* 2FA block */}
              <div className="bg-surface-tertiary/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Двухфакторная аутентификация</p>
                </div>
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${twoFa.enabled ? 'bg-green-500/15 text-green-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                      <Shield size={20}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white">Защита входа</p>
                        {twoFa.enabled
                          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium">Включена</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400 font-medium">Выключена</span>
                        }
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {twoFa.enabled
                          ? `Email: ${twoFa.email?.replace(/(.{2})(.*)(@.*)/, '$1***$3')}`
                          : 'При входе будет запрашиваться код с email'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => { setMsg(null); setView(twoFa.enabled ? 'disable' : 'setup-email'); }}
                    className={`mt-4 w-full py-2.5 rounded-xl text-sm font-medium transition-all ${twoFa.enabled ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' : 'bg-vortex-500/15 text-vortex-300 hover:bg-vortex-500/25 border border-vortex-500/20'}`}>
                    {twoFa.enabled ? 'Отключить 2FA' : 'Включить 2FA'}
                  </button>
                </div>
              </div>

              {/* Sessions */}
              <div className="bg-surface-tertiary/50 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Активные сессии</p>
                  {sessions.filter(s => !s.isCurrent).length > 0 && (
                    <button onClick={revokeAll} disabled={working}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors">
                      Завершить все другие
                    </button>
                  )}
                </div>
                {loading ? (
                  <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-vortex-500 border-t-transparent rounded-full animate-spin"/></div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {sessions.map(s => (
                      <div key={s.id} className="p-4 flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${s.isCurrent ? 'bg-vortex-500/15 text-vortex-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                          {getDeviceIcon(s.os)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white">{s.deviceName || 'Неизвестное устройство'}</p>
                            {s.isCurrent && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-vortex-500/15 text-vortex-400 font-semibold uppercase tracking-wide">Текущая</span>}
                          </div>
                          <div className="mt-1 space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                              <Globe size={11}/>
                              <span>{s.ip}</span>
                              {s.country && s.country !== '—' && <><span>·</span><MapPin size={11}/><span>{s.city}, {s.country}</span></>}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                              <Clock size={11}/>
                              <span>Активна {timeAgo(s.lastActiveAt)}</span>
                              <span>·</span>
                              <span>Создана {new Date(s.createdAt).toLocaleDateString('ru')}</span>
                            </div>
                          </div>
                        </div>
                        {!s.isCurrent && (
                          <button onClick={() => revokeSession(s.id)}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0">
                            <Trash2 size={15}/>
                          </button>
                        )}
                      </div>
                    ))}
                    {sessions.length === 0 && <div className="text-center text-zinc-600 text-sm py-6">Нет активных сессий</div>}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Setup email ───────────────────────────────────── */}
          {view === 'setup-email' && (
            <motion.div key="setup-email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-vortex-500/15 flex items-center justify-center">
                  <Mail size={32} className="text-vortex-400"/>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Укажите email</h3>
                  <p className="text-zinc-500 text-sm mt-1">На него будут приходить коды при каждом входе</p>
                </div>
              </div>
              <AnimatePresence>{msg && <Notification />}</AnimatePresence>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Email адрес</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && sendSetupCode()}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none"/>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-3 flex gap-2.5">
                <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5"/>
                <p className="text-xs text-zinc-400">Убедитесь что у вас есть доступ к этому email — без него вы не сможете войти если потеряете доступ к аккаунту</p>
              </div>
              <button onClick={sendSetupCode} disabled={!email || working}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-vortex-500 to-purple-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {working ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><Mail size={16}/>Отправить код</>}
              </button>
            </motion.div>
          )}

          {/* ── Confirm code ──────────────────────────────────── */}
          {view === 'setup-code' && (
            <motion.div key="setup-code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-green-500/15 flex items-center justify-center">
                  <Check size={32} className="text-green-400"/>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Введите код</h3>
                  <p className="text-zinc-500 text-sm mt-1">Отправлен на <span className="text-vortex-400">{emailHint}</span></p>
                </div>
              </div>
              <AnimatePresence>{msg && <Notification />}</AnimatePresence>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">6-значный код</label>
                <input type="text" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" onKeyDown={e => e.key === 'Enter' && code.length === 6 && confirmEnable()}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none text-center text-2xl tracking-[0.5em] font-mono" maxLength={6}/>
              </div>
              <button onClick={confirmEnable} disabled={code.length !== 6 || working}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-vortex-500 to-purple-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {working ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><Shield size={16}/>Включить 2FA</>}
              </button>
              <button onClick={() => { setView('setup-email'); setMsg(null); setCode(''); }}
                className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                Изменить email
              </button>
            </motion.div>
          )}

          {/* ── Disable 2FA ───────────────────────────────────── */}
          {view === 'disable' && (
            <motion.div key="disable" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
                  <Shield size={32} className="text-red-400"/>
                </div>
                <div>
                  <h3 className="text-white font-semibold">Отключить 2FA?</h3>
                  <p className="text-zinc-500 text-sm mt-1">Введите пароль для подтверждения</p>
                </div>
              </div>
              <AnimatePresence>{msg && <Notification />}</AnimatePresence>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Ваш пароль</label>
                <input type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)}
                  placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && disableTwoFa()}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none"/>
              </div>
              <button onClick={disableTwoFa} disabled={!disablePassword || working}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {working ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : 'Отключить 2FA'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
