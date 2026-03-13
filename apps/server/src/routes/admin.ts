/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const ADMIN_USERNAMES = ['amebo4ka', 'abob4ek'];

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    if (!user || !ADMIN_USERNAMES.includes(user.username)) {
      res.status(403).json({ error: 'Доступ запрещён' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
}

// ── Stats ──────────────────────────────────────────────────────────────
router.get('/stats', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalUsers, totalMessages, totalChats, onlineUsers, totalStories, verifiedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.message.count({ where: { isDeleted: false } }),
      prisma.chat.count(),
      prisma.user.count({ where: { isOnline: true } }),
      prisma.story.count(),
      prisma.user.count({ where: { isVerified: true } }),
    ]);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const week = new Date(); week.setDate(week.getDate() - 7);
    const [newUsersToday, newMessagesToday, newUsersWeek, newMessagesWeek] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.message.count({ where: { isDeleted: false, createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: week } } }),
      prisma.message.count({ where: { isDeleted: false, createdAt: { gte: week } } }),
    ]);
    const topUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { messages: { _count: 'desc' } },
      select: { id: true, username: true, displayName: true, isVerified: true, _count: { select: { messages: true } } },
    });
    res.json({ totalUsers, totalMessages, totalChats, onlineUsers, totalStories, verifiedUsers, newUsersToday, newMessagesToday, newUsersWeek, newMessagesWeek, topUsers });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Users list ─────────────────────────────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const search = String(req.query.search || '');
    const filter = String(req.query.filter || 'all'); // all | online | verified
    const limit = 20;
    const where: any = {};
    if (search) where.OR = [
      { username: { contains: search, mode: 'insensitive' as const } },
      { displayName: { contains: search, mode: 'insensitive' as const } },
    ];
    if (filter === 'online') where.isOnline = true;
    if (filter === 'verified') where.isVerified = true;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, username: true, displayName: true, avatar: true, isOnline: true, isVerified: true, createdAt: true, registrationIp: true, _count: { select: { messages: true, stories: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total, pages: Math.ceil(total / limit) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Toggle verified ────────────────────────────────────────────────────
router.patch('/users/:id/verify', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id }, select: { isVerified: true } });
    if (!user) { res.status(404).json({ error: 'Не найден' }); return; }
    const updated = await prisma.user.update({ where: { id }, data: { isVerified: !user.isVerified }, select: { id: true, isVerified: true } });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Edit user ──────────────────────────────────────────────────────────
router.patch('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { displayName, bio } = req.body;
    const data: any = {};
    if (displayName !== undefined) data.displayName = String(displayName).slice(0, 50);
    if (bio !== undefined) data.bio = String(bio).slice(0, 500);
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, username: true, displayName: true } });
    res.json({ user });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Delete user ────────────────────────────────────────────────────────
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const target = await prisma.user.findUnique({ where: { id }, select: { username: true } });
    if (!target) { res.status(404).json({ error: 'Пользователь не найден' }); return; }
    if (ADMIN_USERNAMES.includes(target.username)) { res.status(400).json({ error: 'Нельзя удалить администратора' }); return; }
    // Manual cleanup to avoid cascade issues
    await prisma.$transaction([
      prisma.reaction.deleteMany({ where: { userId: id } }),
      prisma.readReceipt.deleteMany({ where: { userId: id } }),
      prisma.storyView.deleteMany({ where: { userId: id } }),
      prisma.hiddenMessage.deleteMany({ where: { userId: id } }),
      prisma.friendship.deleteMany({ where: { OR: [{ userId: id }, { friendId: id }] } }),
    ]);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) { console.error('Delete user error:', e); res.status(500).json({ error: 'Ошибка удаления: ' + String(e) }); }
});

// ── Messages ───────────────────────────────────────────────────────────
router.get('/messages', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const search = String(req.query.search || '');
    const limit = 30;
    const where: any = { isDeleted: false };
    if (search) where.content = { contains: search, mode: 'insensitive' as const };
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, username: true, displayName: true, isVerified: true } },
          chat: { select: { id: true, name: true, type: true } },
          media: { select: { type: true } },
        },
      }),
      prisma.message.count({ where }),
    ]);
    res.json({ messages, total, pages: Math.ceil(total / limit) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/messages/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.message.update({ where: { id: String(req.params.id) }, data: { isDeleted: true, content: null } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/chats/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.chat.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
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
          user: { select: { id: true, username: true, displayName: true, isVerified: true } },
          _count: { select: { views: true } },
        },
      }),
      prisma.story.count(),
    ]);
    res.json({ stories, total, pages: Math.ceil(total / limit) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

router.delete('/stories/:id', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.story.delete({ where: { id: String(req.params.id) } });
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

// ── Duplicate IPs ──────────────────────────────────────────────────────
router.get('/duplicate-ips', authenticateToken, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { registrationIp: { not: null } },
      select: { id: true, username: true, isVerified: true, createdAt: true, registrationIp: true },
      orderBy: { createdAt: 'desc' },
    });
    const ipMap: Record<string, any[]> = {};
    for (const u of users) {
      if (!u.registrationIp) continue;
      if (!ipMap[u.registrationIp]) ipMap[u.registrationIp] = [];
      ipMap[u.registrationIp].push(u);
    }
    const duplicates = Object.entries(ipMap).filter(([, arr]) => arr.length > 1).map(([ip, accounts]) => ({ ip, accounts }));
    res.json({ duplicates });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Ошибка сервера' }); }
});

export default router;
