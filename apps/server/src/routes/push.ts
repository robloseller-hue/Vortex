import { Router } from 'express';
import { prisma } from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Return VAPID public key to frontend
router.get('/vapid-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) { res.status(503).json({ error: 'Push not configured' }); return; }
  res.json({ key });
});

// Register push subscription
router.post('/register', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) { res.status(400).json({ error: 'Subscription required' }); return; }
    const token = JSON.stringify(subscription);
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: req.userId! },
      create: { userId: req.userId!, token },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Push register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Unregister
router.post('/unregister', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { subscription } = req.body;
    if (subscription) {
      const token = JSON.stringify(subscription);
      await prisma.pushToken.deleteMany({ where: { token, userId: req.userId! } });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
