import { Router } from 'express';
import { prisma } from '../db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get my block list
router.get('/', async (req: AuthRequest, res) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.userId! },
      include: { blocked: { select: { id: true, username: true, displayName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(blocks);
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Block a user
router.post('/:userId', async (req: AuthRequest, res) => {
  try {
    const blockedId = String(req.params.userId);
    if (blockedId === req.userId) { res.status(400).json({ error: 'Нельзя заблокировать себя' }); return; }

    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId!, blockedId } },
      create: { blockerId: req.userId!, blockedId },
      update: {},
    });
    res.json({ blocked: true });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Unblock a user
router.delete('/:userId', async (req: AuthRequest, res) => {
  try {
    const blockedId = String(req.params.userId);
    await prisma.block.deleteMany({
      where: { blockerId: req.userId!, blockedId },
    });
    res.json({ blocked: false });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Check if user is blocked (by either side)
router.get('/check/:userId', async (req: AuthRequest, res) => {
  try {
    const otherId = String(req.params.userId);
    const [iBlocked, theyBlocked] = await Promise.all([
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: req.userId!, blockedId: otherId } } }),
      prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: otherId, blockedId: req.userId! } } }),
    ]);
    res.json({ iBlocked: !!iBlocked, theyBlocked: !!theyBlocked });
  } catch { res.status(500).json({ error: 'Ошибка сервера' }); }
});

export default router;
