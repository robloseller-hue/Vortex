import { useState, FormEvent, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useLang } from '../lib/i18n';
import { Eye, EyeOff, ArrowRight, UserPlus, LogIn, Shield } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [twoFaCode, setTwoFaCode] = useState(['', '', '', '', '', '']);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { login, register, verify2fa, pending2fa, error } = useAuthStore();
  const { t } = useLang();

  // Auto-focus first code input when 2FA appears
  useEffect(() => {
    if (pending2fa) {
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    }
  }, [pending2fa]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, displayName || username, password, bio);
      }
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeInput = (idx: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...twoFaCode];
    next[idx] = val.slice(-1);
    setTwoFaCode(next);
    if (val && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (next.every(d => d !== '')) submitCode(next.join(''));
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !twoFaCode[idx] && idx > 0) {
      codeRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setTwoFaCode(pasted.split(''));
      submitCode(pasted);
    }
  };

  const submitCode = async (code: string) => {
    setIsSubmitting(true);
    setLocalError('');
    try {
      await verify2fa(code);
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Неверный код');
      setTwoFaCode(['', '', '', '', '', '']);
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error || '';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="h-full flex items-center justify-center relative overflow-hidden bg-surface">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-20">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-vortex-600/30 to-purple-600/30 blur-[120px] animate-pulse" />
        </div>
        <div className="absolute top-20 left-20 w-72 h-72 bg-vortex-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
      </div>

      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }} className="relative z-10 w-full max-w-md mx-4">
        <div className="glass-strong rounded-3xl p-8 shadow-2xl shadow-vortex-500/5">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div initial={{ rotate: -180, scale: 0 }} animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}>
              <img src="/zync.svg" alt="Zync"
                className="w-20 h-20 rounded-2xl shadow-lg shadow-vortex-500/30 object-cover" />
            </motion.div>
            <h1 className="text-2xl font-bold gradient-text mt-4">Zync</h1>
            <p className="text-zinc-500 text-sm mt-1">{t('modernMessengerShort')}</p>
          </div>

          <AnimatePresence mode="wait">
            {/* ── 2FA Screen ── */}
            {pending2fa ? (
              <motion.div key="2fa" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }} className="space-y-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-vortex-500/15 flex items-center justify-center">
                    <Shield size={28} className="text-vortex-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold text-lg">Двухфакторная защита</h2>
                    <p className="text-zinc-500 text-sm mt-1">
                      Код отправлен на <span className="text-vortex-400">{pending2fa.emailHint}</span>
                    </p>
                  </div>
                </div>

                {/* 6 digit inputs */}
                <div className="flex gap-2 justify-center">
                  {twoFaCode.map((digit, i) => (
                    <input key={i}
                      ref={el => { codeRefs.current[i] = el; }}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digit}
                      onChange={e => handleCodeInput(i, e.target.value)}
                      onKeyDown={e => handleCodeKeyDown(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      disabled={isSubmitting}
                      className="w-11 h-14 text-center text-xl font-bold rounded-xl bg-white/5 border border-white/10 text-white focus:border-vortex-500/70 focus:ring-2 focus:ring-vortex-500/25 outline-none transition-all disabled:opacity-50"
                    />
                  ))}
                </div>

                <AnimatePresence>
                  {displayError && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                      {displayError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button onClick={() => submitCode(twoFaCode.join(''))}
                  disabled={twoFaCode.some(d => !d) || isSubmitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-vortex-500 to-purple-600 text-white font-medium shadow-lg shadow-vortex-500/25 disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSubmitting
                    ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><Shield size={16} />Войти</>}
                </button>

                <button
                  onClick={() => { useAuthStore.setState({ pending2fa: null, error: null }); setLocalError(''); setTwoFaCode(['','','','','','']); }}
                  className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
                  ← Назад
                </button>
              </motion.div>
            ) : (
              /* ── Login / Register ── */
              <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex rounded-xl bg-white/5 p-1 mb-6">
                  <button onClick={() => { setIsLogin(true); setLocalError(''); }}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${isLogin ? 'bg-gradient-to-r from-vortex-500 to-purple-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    <LogIn size={16} />{t('login')}
                  </button>
                  <button onClick={() => { setIsLogin(false); setLocalError(''); }}
                    className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${!isLogin ? 'bg-gradient-to-r from-vortex-500 to-purple-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-200'}`}>
                    <UserPlus size={16} />{t('register')}
                  </button>
                </div>

                <AnimatePresence>
                  {displayError && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {displayError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                      Username {!isLogin && <span className="text-zinc-600">{t('latinOnly')}</span>}
                    </label>
                    <input type="text" value={username}
                      onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                      placeholder="username"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none"
                      required autoFocus autoComplete="off" />
                  </div>

                  <AnimatePresence>
                    {!isLogin && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">{t('displayNameLabel')}</label>
                        <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                          placeholder={t('displayNamePlaceholder')}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">{t('password')}</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)} placeholder={t('passwordPlaceholder')}
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none pr-12"
                        required autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={6} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {!isLogin && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">{t('aboutMe')}</label>
                        <input type="text" value={bio} onChange={e => setBio(e.target.value)}
                          placeholder={t('bioPlaceholder')}
                          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-600 focus:border-vortex-500/50 focus:ring-1 focus:ring-vortex-500/25 transition-all outline-none" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    disabled={isSubmitting} type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-vortex-500 to-purple-600 text-white font-medium shadow-lg shadow-vortex-500/25 hover:shadow-vortex-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {isSubmitting
                      ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <>{isLogin ? t('loginBtn') : t('createAccount')}<ArrowRight size={18} /></>}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
