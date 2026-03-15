/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const ADMIN_USERNAMES = ['amebo4ka', 'abob4ek'];

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
  if (!user || !ADMIN_USERNAMES.includes(user.username)) {
    res.status(403).json({ error: 'Доступ запрещён' });
    return;
  }
  next();
}

// ── Stats ──────────────────────────────────────────────────────────────
router.get('/stats', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalMessages, totalChats, onlineUsers, totalStories, totalMedia] = await Promise.all([
      prisma.user.count(),
      prisma.message.count({ where: { isDeleted: false } }),
      prisma.chat.count(),
      prisma.user.count({ where: { isOnline: true } }),
      prisma.story.count(),
      prisma.media.count(),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const week = new Date(); week.setDate(week.getDate() - 7);
    const [newUsersToday, newMessagesToday, newUsersWeek, newMessagesWeek] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.message.count({ where: { isDeleted: false, createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: week } } }),
      prisma.message.count({ where: { isDeleted: false, createdAt: { gte: week } } }),
    ]);
    // Top active users
    const topUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { messages: { _count: 'desc' } },
      select: { id: true, username: true, displayName: true, _count: { select: { messages: true } } },
    });
    res.json({ totalUsers, totalMessages, totalChats, onlineUsers, totalStories, totalMedia, newUsersToday, newMessagesToday, newUsersWeek, newMessagesWeek, topUsers });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Users list ─────────────────────────────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const search = String(req.query.search || '');
    const limit = 20;
    const where: any = search
      ? { OR: [{ username: { contains: search, mode: 'insensitive' } }, { displayName: { contains: search, mode: 'insensitive' } }] }
      : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, username: true, displayName: true, avatar: true, bio: true, email: true, isOnline: true, lastSeen: true, createdAt: true, registrationIp: true, _count: { select: { messages: true, stories: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── User detail ────────────────────────────────────────────────────────
router.get('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, username: true, displayName: true, avatar: true, bio: true,
        email: true, phone: true, birthday: true, isOnline: true, lastSeen: true,
        createdAt: true, registrationIp: true,
        _count: { select: { messages: true, stories: true, chatMembers: true } },
      },
    });
    if (!user) { res.status(404).json({ error: 'Не найден' }); return; }
    // Find duplicate IP accounts
    const sameIpCount = user.registrationIp
      ? await prisma.user.count({ where: { registrationIp: user.registrationIp, id: { not: user.id } } })
      : 0;
    res.json({ user, sameIpCount });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Edit user ──────────────────────────────────────────────────────────
router.patch('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { displayName, bio } = req.body;
    const data: any = {};
    if (displayName !== undefined) data.displayName = String(displayName).slice(0, 50);
    if (bio !== undefined) data.bio = String(bio).slice(0, 500);
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, username: true, displayName: true, bio: true } });
    res.json({ user });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Delete user ────────────────────────────────────────────────────────
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id }, select: { username: true } });
    if (!target) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    if (ADMIN_USERNAMES.includes(target.username)) { res.status(400).json({ error: 'Нельзя удалить администратора' }); return; }

    // Delete sessions (no cascade in schema)
    await prisma.session.deleteMany({ where: { userId: id } });

    // Delete personal chats of this user (cascades messages/members)
    const personalChats = await prisma.chat.findMany({
      where: { type: 'personal', members: { some: { userId: id } } },
      select: { id: true },
    });
    if (personalChats.length > 0) {
      await prisma.chat.deleteMany({ where: { id: { in: personalChats.map(c => c.id) } } });
    }

    // Remove from group chats
    await prisma.chatMember.deleteMany({ where: { userId: id } });

    // Delete messages in group chats
    await prisma.message.deleteMany({ where: { senderId: id } });

    // Delete user (remaining relations cascade)
    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ── Messages ───────────────────────────────────────────────────────────
router.get('/messages', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const search = String(req.query.search || '');
    const limit = 30;
    const where: any = { isDeleted: false };
    if (search) where.content = { contains: search, mode: 'insensitive' };
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, username: true, displayName: true } },
          chat: { select: { id: true, name: true, type: true } },
          media: { select: { type: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);
    res.json({ messages, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/messages/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.message.update({ where: { id: String(req.params.id) }, data: { isDeleted: true } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Chats ──────────────────────────────────────────────────────────────
router.get('/chats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = 20;
    const [chats, total] = await Promise.all([
      prisma.chat.findMany({
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: { _count: { select: { messages: true, members: true } } },
      }),
      prisma.chat.count(),
    ]);
    res.json({ chats, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/chats/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.chat.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Stories ────────────────────────────────────────────────────────────
router.get('/stories', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = 20;
    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, displayName: true } },
          _count: { select: { views: true } },
        },
      }),
      prisma.story.count(),
    ]);
    res.json({ stories, total, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/stories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.story.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── IPs with multiple accounts ─────────────────────────────────────────
router.get('/duplicate-ips', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { registrationIp: { not: null } },
      select: { id: true, username: true, displayName: true, createdAt: true, registrationIp: true },
      orderBy: { createdAt: 'desc' },
    });
    const ipMap: Record<string, any[]> = {};
    for (const u of users) {
      if (!u.registrationIp) continue;
      if (!ipMap[u.registrationIp]) ipMap[u.registrationIp] = [];
      ipMap[u.registrationIp].push(u);
    }
    const duplicates = Object.entries(ipMap)
      .filter(([, arr]) => arr.length > 1)
      .map(([ip, accounts]) => ({ ip, accounts }));
    res.json({ duplicates });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

export default router;
