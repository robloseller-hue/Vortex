import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db';
import { config } from '../config';
import { USER_SELECT } from '../shared';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

// ── Rate limiters ────────────────────────────────────────────────────
const registerLimiter = rateLimit({ windowMs: 60*60*1000, max: 3, message: { error: 'Слишком много регистраций. Попробуйте через час.' }, validate: false, keyGenerator: (req) => req.ip || 'unknown' });
const twoFaLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, message: { error: 'Слишком много попыток. Подождите 15 минут.' }, validate: false });

const registrationCooldowns = new Map<string, number>();
const REGISTRATION_COOLDOWN_MS = 5 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────
function parseUserAgent(ua: string): { browser: string; os: string; deviceName: string } {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // OS detection
  if (/Windows NT 10/.test(ua)) os = 'Windows 10';
  else if (/Windows NT 11/.test(ua)) os = 'Windows 11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/iPad/.test(ua)) os = 'iPad';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Linux/.test(ua)) os = 'Linux';

  // Browser detection
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/YaBrowser/.test(ua)) browser = 'Yandex Browser';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

  const deviceName = `${browser} на ${os}`;
  return { browser, os, deviceName };
}

async function getGeoFromIp(ip: string): Promise<{ country: string; city: string }> {
  try {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168') || ip.startsWith('10.')) {
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

async function createSession(userId: string, token: string, req: { ip?: string; headers: Record<string, string | string[] | undefined> }): Promise<void> {
  const ip = String(req.ip || '—');
  const ua = String(req.headers['user-agent'] || '');
  const { browser, os, deviceName } = parseUserAgent(ua);
  const { country, city } = await getGeoFromIp(ip);

  // Mark all previous sessions as not current
  await prisma.session.updateMany({ where: { userId, isCurrent: true }, data: { isCurrent: false } });

  await prisma.session.create({
    data: { userId, token, deviceName, browser, os, ip, country, city, isCurrent: true },
  });

  // Keep max 10 sessions per user
  const sessions = await prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (sessions.length > 10) {
    const toDelete = sessions.slice(0, sessions.length - 10).map(s => s.id);
    await prisma.session.deleteMany({ where: { id: { in: toDelete } } });
  }
}

async function sendEmail(to: string, code: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser || 'noreply@zync.app';

  if (!smtpHost || !smtpUser || !smtpPass) {
    // Fallback: log to console if SMTP not configured
    console.log(`\n╔══════════════════════════════╗`);
    console.log(`║  2FA КОД для ${to}`);
    console.log(`║  Код: ${code}`);
    console.log(`║  Действителен 10 минут`);
    console.log(`╚══════════════════════════════╝\n`);
    return;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Zync Messenger" <${smtpFrom}>`,
      to,
      subject: `Ваш код входа в Zync: ${code}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;background:#09090b;color:#fff;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center">
            <div style="font-size:32px;font-weight:900;letter-spacing:-1px">Zync</div>
            <div style="font-size:14px;opacity:0.8;margin-top:4px">Messenger</div>
          </div>
          <div style="padding:32px;text-align:center">
            <h2 style="font-size:18px;font-weight:600;margin:0 0 8px">Код подтверждения входа</h2>
            <p style="color:#a1a1aa;font-size:14px;margin:0 0 28px">Используйте этот код для входа в аккаунт. Он действует 10 минут.</p>
            <div style="background:#18181b;border:1px solid #3f3f46;border-radius:12px;padding:20px;margin-bottom:24px">
              <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#6366f1">${code}</span>
            </div>
            <p style="color:#52525b;font-size:12px;margin:0">Если вы не запрашивали этот код — проигнорируйте письмо.</p>
          </div>
        </div>
      `,
      text: `Ваш код входа в Zync: ${code}\n\nДействителен 10 минут. Если вы не запрашивали код — проигнорируйте это письмо.`,
    });
    console.log(`✓ 2FA код отправлен на ${to}`);
  } catch (err) {
    console.error('Email send error:', err);
    // Still log the code as fallback so admin can help users
    console.log(`[FALLBACK] 2FA code for ${to}: ${code}`);
  }
}

// ── Register ─────────────────────────────────────────────────────────
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, displayName, password, bio } = req.body;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    const lastReg = registrationCooldowns.get(clientIp);
    if (lastReg && Date.now() - lastReg < REGISTRATION_COOLDOWN_MS) {
      const waitMinutes = Math.ceil((REGISTRATION_COOLDOWN_MS - (Date.now() - lastReg)) / 60000);
      res.status(429).json({ error: `Подождите ${waitMinutes} мин.` }); return;
    }

    const accountsFromIp = await prisma.user.count({ where: { registrationIp: clientIp } });
    if (accountsFromIp >= config.maxRegistrationsPerIp) {
      res.status(403).json({ error: `Максимум ${config.maxRegistrationsPerIp} аккаунта с одного IP.` }); return;
    }

    if (!username || !password) { res.status(400).json({ error: 'Username и пароль обязательны' }); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { res.status(400).json({ error: 'Username: 3-20 символов, только латиница, цифры, _' }); return; }
    if (password.length < config.minPasswordLength) { res.status(400).json({ error: `Пароль минимум ${config.minPasswordLength} символов` }); return; }
    if (!/[a-zA-Zа-яА-Я]/.test(password) || !/\d/.test(password)) { res.status(400).json({ error: 'Пароль должен содержать буквы и цифры' }); return; }

    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (existing) { res.status(400).json({ error: 'Этот username уже занят' }); return; }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName: (displayName || username).slice(0, 50),
        password: hashedPassword,
        bio: bio ? bio.slice(0, 500) : null,
        registrationIp: clientIp,
      },
      select: USER_SELECT,
    });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    await createSession(user.id, token, req as any);
    registrationCooldowns.set(clientIp, Date.now());
    res.json({ token, user: { ...user, isOnline: true } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
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
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) { res.status(400).json({ error: 'Неверный username или пароль' }); return; }

    // If 2FA enabled — send code, don't return token yet
    if (user.twoFaEnabled && user.twoFaEmail) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const exp = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFaCode: code, twoFaCodeExp: exp },
      });

      await sendEmail(user.twoFaEmail, code);

      res.json({
        twoFaRequired: true,
        userId: user.id,
        emailHint: user.twoFaEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      });
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { isOnline: true, lastSeen: new Date() } });
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    await createSession(user.id, token, req as any);

    const { password: _, twoFaEnabled: __, twoFaEmail: ___, ...userClean } = user;
    res.json({ token, user: { ...userClean, isOnline: true } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Verify 2FA code ───────────────────────────────────────────────────
router.post('/2fa/verify', twoFaLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) { res.status(400).json({ error: 'userId и code обязательны' }); return; }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...USER_SELECT, twoFaCode: true, twoFaCodeExp: true },
    });

    if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    if (!user.twoFaCode || !user.twoFaCodeExp) { res.status(400).json({ error: 'Код не запрошен' }); return; }
    if (new Date() > user.twoFaCodeExp) { res.status(400).json({ error: 'Код истёк. Войдите снова.' }); return; }
    if (user.twoFaCode !== String(code).trim()) { res.status(400).json({ error: 'Неверный код' }); return; }

    // Clear code
    await prisma.user.update({ where: { id: userId }, data: { twoFaCode: null, twoFaCodeExp: null, isOnline: true, lastSeen: new Date() } });

    const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
    await createSession(user.id, token, req as any);

    const { twoFaCode: _, twoFaCodeExp: __, ...userClean } = user;
    res.json({ token, user: { ...userClean, isOnline: true } });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Setup 2FA — step 1: send code to email ────────────────────────────
router.post('/2fa/setup', authenticateToken, twoFaLimiter, async (req: AuthRequest, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Укажите корректный email' }); return;
    }

    // Check email not taken
    const existing = await prisma.user.findFirst({ where: { twoFaEmail: email, NOT: { id: req.userId } } });
    if (existing) { res.status(400).json({ error: 'Email уже используется другим аккаунтом' }); return; }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const exp = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: req.userId },
      data: { twoFaEmail: email, twoFaCode: code, twoFaCodeExp: exp },
    });

    await sendEmail(email, code);
    res.json({ success: true, emailHint: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Setup 2FA — step 2: confirm code and enable ───────────────────────
router.post('/2fa/enable', authenticateToken, twoFaLimiter, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { twoFaCode: true, twoFaCodeExp: true, twoFaEmail: true },
    });

    if (!user?.twoFaCode || !user.twoFaCodeExp) { res.status(400).json({ error: 'Сначала запросите код' }); return; }
    if (new Date() > user.twoFaCodeExp) { res.status(400).json({ error: 'Код истёк. Запросите новый.' }); return; }
    if (user.twoFaCode !== String(code).trim()) { res.status(400).json({ error: 'Неверный код' }); return; }

    await prisma.user.update({
      where: { id: req.userId },
      data: { twoFaEnabled: true, twoFaCode: null, twoFaCodeExp: null },
    });

    res.json({ success: true, email: user.twoFaEmail });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Disable 2FA ────────────────────────────────────────────────────────
router.post('/2fa/disable', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { password: true } });
    if (!user) { res.status(404).json({ error: 'Не найден' }); return; }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(400).json({ error: 'Неверный пароль' }); return; }

    await prisma.user.update({
      where: { id: req.userId },
      data: { twoFaEnabled: false, twoFaEmail: null, twoFaCode: null, twoFaCodeExp: null },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Get sessions ───────────────────────────────────────────────────────
router.get('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentToken = String(req.headers.authorization || '').split(' ')[1];

    // Update current session last active
    if (currentToken) {
      await prisma.session.updateMany({
        where: { token: currentToken },
        data: { lastActiveAt: new Date(), isCurrent: true },
      });
      // Mark others as not current
      await prisma.session.updateMany({
        where: { userId: req.userId!, token: { not: (currentToken as string) || '' }
        data: { isCurrent: false },
      });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: req.userId! },
      orderBy: [{ isCurrent: 'desc' }, { lastActiveAt: 'desc' }],
      select: { id: true, deviceName: true, browser: true, os: true, ip: true, country: true, city: true, isCurrent: true, createdAt: true, lastActiveAt: true },
    });

    // Get 2FA status
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { twoFaEnabled: true, twoFaEmail: true },
    });

    res.json({ sessions, twoFa: { enabled: user?.twoFaEnabled || false, email: user?.twoFaEmail || null } });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Revoke session ──────────────────────────────────────────────────────
router.delete('/sessions/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const session = await prisma.session.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!session) { res.status(404).json({ error: 'Сессия не найдена' }); return; }
    if (session.isCurrent) { res.status(400).json({ error: 'Нельзя завершить текущую сессию' }); return; }
    await prisma.session.delete({ where: { id: session.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Revoke ALL other sessions ───────────────────────────────────────────
router.delete('/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const currentToken = String(req.headers.authorization || '').split(' ')[1];
    await prisma.session.deleteMany({ where: { userId: req.userId!, token: { not: (currentToken as string) } },
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Me ──────────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: USER_SELECT });
    if (!user) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;
