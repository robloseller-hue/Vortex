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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city&lang=ru`, { signal: controller.signal });
    clearTimeout(timer);
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
      select: { ...USER_SELECT, password: true },
    });
    if (!user) { res.status(400).json({ error: 'Неверный username или пароль' }); return; }
    if (!await bcrypt.compare(password, user.password)) { res.status(400).json({ error: 'Неверный username или пароль' }); return; }
    await prisma.user.update({ where: { id: user.id }, data: { isOnline: true, lastSeen: new Date() } });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    const ip = String(req.ip || '');
    const ua = String(req.headers['user-agent'] || '');
    await createSession(user.id, token, ip, ua);
    const { password: _p, ...clean } = user;
    res.json({ token, user: { ...clean, isOnline: true } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Ошибка сервера' }); }
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
    res.json({ sessions });
  } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Revoke one session ────────────────────────────────────────────────
router.delete('/sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionId = String(req.params.id);
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId: req.userId! } });
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
