import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { config } from '../config';
import { USER_SELECT } from '../shared';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3,
  message: { error: 'Слишком много регистраций. Попробуйте через час.' },
  validate: false,
  keyGenerator: (req) => req.ip || 'unknown',
});

const twoFaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Слишком много попыток. Подождите 15 минут.' },
  validate: false,
});

const registrationCooldowns = new Map<string, number>();
const REGISTRATION_COOLDOWN_MS = 5 * 60 * 1000;

// ── Parse User-Agent ─────────────────────────────────────────────────
function parseUserAgent(ua: string): { browser: string; os: string; deviceName: string } {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/YaBrowser/.test(ua)) browser = 'Yandex Browser';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  return { browser, os, deviceName: `${browser} на ${os}` };
}

// ── Geo from IP ───────────────────────────────────────────────────────
async function getGeo(ip: string): Promise<{ country: string; city: string }> {
  try {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
      return { country: 'Локальная сеть', city: 'localhost' };
    }
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city&lang=ru`);
    if (!res.ok) return { country: '—', city: '—' };
    const data = await res.json() as { country?: string; city?: string };
    return { country: data.country || '—', city: data.city || '—' };
  } catch {
    return { country: '—', city: '—' };
  }
}

// ── Create session ────────────────────────────────────────────────────
async function createSession(userId: string, token: string, ip: string, ua: string): Promise<void> {
  const { browser, os, deviceName } = parseUserAgent(ua);
  const { country, city } = await getGeo(ip);
  await prisma.session.updateMany({ where: { userId, isCurrent: true }, data: { isCurrent: false } });
  await prisma.session.create({
    data: { userId, token, deviceName, browser, os, ip, country, city, isCurrent: true },
  });
  const all = await prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (all.length > 10) {
    const old = all.slice(0, all.length - 10).map((s) => s.id);
    await prisma.session.deleteMany({ where: { id: { in: old } } });
  }
}

// ── Send email ────────────────────────────────────────────────────────
async function sendEmail(to: string, code: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || 'noreply@zync.app';

  if (!host || !user || !pass) {
    console.log(`\n[ 2FA CODE for ${to} ]: ${code}\n`);
    return;
  }
  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transport.sendMail({
      from: `"Zync" <${from}>`,
      to,
      subject: `Код входа Zync: ${code}`,
      html: `<div style="font-family:sans-serif;max-width:420px;margin:auto;background:#09090b;color:#fff;border-radius:16px;overflow:hidden"><div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px;text-align:center"><b style="font-size:28px">Zync</b></div><div style="padding:28px;text-align:center"><h2 style="margin:0 0 8px">Код подтверждения</h2><p style="color:#a1a1aa;margin:0 0 24px;font-size:14px">Действителен 10 минут</p><div style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:18px;margin-bottom:20px"><span style="font-size:38px;font-weight:900;letter-spacing:10px;color:#6366f1">${code}</span></div><p style="color:#52525b;font-size:12px">Если вы не запрашивали код — проигнорируйте это письмо.</p></div></div>`,
      text: `Ваш код входа в Zync: ${code}. Действителен 10 минут.`,
    });
    console.log(`✓ 2FA code sent to ${to}`);
  } catch (err) {
    console.error('Email error:', err);
    console.log(`[FALLBACK] 2FA code for ${to}: ${code}`);
  }
}

// ── Register ──────────────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, displayName, password, bio } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const lastReg = registrationCooldowns.get(clientIp);
    if (lastReg && Date.now() - lastReg < REGISTRATION_COOLDOWN_MS) {
      const wait = Math.ceil((REGISTRATION_COOLDOWN_MS - (Date.now() - lastReg)) / 60000);
      res.status(429).json({ error: `Подождите ${wait} мин.` }); return;
    }
    const fromIp = await prisma.user.count({ where: { registrationIp: clientIp } });
    if (fromIp >= config.maxRegistrationsPerIp) {
      res.status(403).json({ error: `Максимум ${config.maxRegistrationsPerIp} аккаунта с одного IP.` }); return;
    }
    if (!username || !password) { res.status(400).json({ error: 'Username и пароль обязательны' }); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { res.status(400).json({ error: 'Username: 3-20 символов, латиница, цифры, _' }); return; }
    if (password.length < config.minPasswordLength) { res.status(400).json({ error: `Пароль минимум ${config.minPasswordLength} символов` }); return; }
    if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) { res.status(400).json({ error: 'Пароль должен содержать буквы и цифры' }); return; }
    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) { res.status(400).json({ error: 'Этот username уже занят' }); return; }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username: username.toLowerCase(), displayName: (displayName || username).slice(0, 50), password: hashed, bio: bio ? bio.slice(0, 500) : null, registrationIp: clientIp },
      select: USER_SELECT,
    });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    const ip = clientIp;
    const ua = String(req.headers['user-agent'] || '');
    await createSession(user.id, token, ip, ua);
    registrationCooldowns.set(clientIp, Date.now());
    res.json({ token, user: { ...user, isOnline: true } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Login ─────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) { res.status(400).json({ error: 'Username и пароль обязательны' }); return; }
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: { ...USER_SELECT, password: true, twoFaEnabled: true, twoFaEmail: true },
    });
    if (!user) { res.status(400).json({ error: 'Неверный username или пароль' }); return; }
    if (!await bcrypt.compare(password, user.password)) { res.status(400).json({ error: 'Неверный username или пароль' }); return; }
    if (user.twoFaEnabled && user.twoFaEmail) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await prisma.user.update({ where: { id: user.id }, data: { twoFaCode: code, twoFaCodeExp: new Date(Date.now() + 10 * 60 * 1000) } });
      await sendEmail(user.twoFaEmail, code);
      res.json({ twoFaRequired: true, userId: user.id, emailHint: user.twoFaEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { isOnline: true, lastSeen: new Date() } });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    const ip = String(req.ip || '');
    const ua = String(req.headers['user-agent'] || '');
    await createSession(user.id, token, ip, ua);
    const { password: _p, twoFaEnabled: _t, twoFaEmail: _e, ...clean } = user;
    res.json({ token, user: { ...clean, isOnline: true } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── 2FA verify (login) ────────────────────────────────────────────────
router.post('/2fa/verify', twoFaLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) { res.status(400).json({ error: 'userId и code обязательны' }); return; }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...USER_SELECT, twoFaCode: true, twoFaCodeExp: true } });
    if (!user) { res.status(404).json({ error: 'Не найден' }); return; }
    if (!user.twoFaCode || !user.twoFaCodeExp) { res.status(400).json({ error: 'Код не запрошен' }); return; }
    if (new Date() > user.twoFaCodeExp) { res.status(400).json({ error: 'Код истёк. Войдите снова.' }); return; }
    if (user.twoFaCode !== String(code).trim()) { res.status(400).json({ error: 'Неверный код' }); return; }
    await prisma.user.update({ where: { id: userId }, data: { twoFaCode: null, twoFaCodeExp: null, isOnline: true, lastSeen: new Date() } });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    const ip = String(req.ip || '');
    const ua = String(req.headers['user-agent'] || '');
    await createSession(user.id, token, ip, ua);
    const { twoFaCode: _c, twoFaCodeExp: _e, ...clean } = user;
    res.json({ token, user: { ...clean, isOnline: true } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── 2FA setup step 1 (send code) ──────────────────────────────────────
router.post('/2fa/setup', authenticateToken, twoFaLimiter, async (req: AuthRequest, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Некорректный email' }); return; }
    const taken = await prisma.user.findFirst({ where: { twoFaEmail: email, NOT: { id: req.userId } } });
    if (taken) { res.status(400).json({ error: 'Email уже используется' }); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma.user.update({ where: { id: req.userId }, data: { twoFaEmail: email, twoFaCode: code, twoFaCodeExp: new Date(Date.now() + 10 * 60 * 1000) } });
    await sendEmail(email, code);
    res.json({ success: true, emailHint: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── 2FA setup step 2 (enable) ─────────────────────────────────────────
router.post('/2fa/enable', authenticateToken, twoFaLimiter, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { twoFaCode: true, twoFaCodeExp: true, twoFaEmail: true } });
    if (!user?.twoFaCode || !user.twoFaCodeExp) { res.status(400).json({ error: 'Сначала запросите код' }); return; }
    if (new Date() > user.twoFaCodeExp) { res.status(400).json({ error: 'Код истёк' }); return; }
    if (user.twoFaCode !== String(code).trim()) { res.status(400).json({ error: 'Неверный код' }); return; }
    await prisma.user.update({ where: { id: req.userId }, data: { twoFaEnabled: true, twoFaCode: null, twoFaCodeExp: null } });
    res.json({ success: true, email: user.twoFaEmail });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── 2FA disable ───────────────────────────────────────────────────────
router.post('/2fa/disable', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { password: true } });
    if (!user) { res.status(404).json({ error: 'Не найден' }); return; }
    if (!await bcrypt.compare(password, user.password)) { res.status(400).json({ error: 'Неверный пароль' }); return; }
    await prisma.user.update({ where: { id: req.userId }, data: { twoFaEnabled: false, twoFaEmail: null, twoFaCode: null, twoFaCodeExp: null } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Get sessions ──────────────────────────────────────────────────────
router.get('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Update all sessions for this user - mark all as not current first, then find by userId
    // We identify current session by looking it up fresh each time
    await prisma.session.updateMany({ where: { userId: req.userId! }, data: { isCurrent: false } });
    // Find the most recently active session for this user as "current"
    const latest = await prisma.session.findFirst({ where: { userId: req.userId! }, orderBy: { lastActiveAt: 'desc' } });
    if (latest) {
      await prisma.session.update({ where: { id: latest.id }, data: { lastActiveAt: new Date(), isCurrent: true } });
    }
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId! },
      orderBy: [{ isCurrent: 'desc' }, { lastActiveAt: 'desc' }],
      select: { id: true, deviceName: true, browser: true, os: true, ip: true, country: true, city: true, isCurrent: true, createdAt: true, lastActiveAt: true },
    });
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { twoFaEnabled: true, twoFaEmail: true } });
    res.json({ sessions, twoFa: { enabled: user?.twoFaEnabled || false, email: user?.twoFaEmail || null } });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Revoke one session ────────────────────────────────────────────────
router.delete('/sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const session = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!session) { res.status(404).json({ error: 'Не найдена' }); return; }
    if (session.isCurrent) { res.status(400).json({ error: 'Нельзя завершить текущую сессию' }); return; }
    await prisma.session.delete({ where: { id: session.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Revoke all other sessions ─────────────────────────────────────────
router.delete('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Keep only the most recent (current) session, delete all others
    const current = await prisma.session.findFirst({ where: { userId: req.userId!, isCurrent: true } });
    if (current) {
      await prisma.session.deleteMany({ where: { userId: req.userId!, NOT: { id: current.id } } });
    } else {
      await prisma.session.deleteMany({ where: { userId: req.userId! } });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Me ────────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT });
    if (!user) { res.status(404).json({ error: 'Не найден' }); return; }
    res.json({ user });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

export default router;
