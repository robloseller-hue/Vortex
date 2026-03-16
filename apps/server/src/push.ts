import webpush from 'web-push';
import { prisma } from './db';

let initialized = false;

function initPush() {
  if (initialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn('⚠ VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы — push отключён');
    return;
  }
  try {
    webpush.setVapidDetails('mailto:admin@zync.app', pub, priv);
    initialized = true;
    console.log('✔ Web Push инициализирован');
  } catch (err) {
    console.warn('⚠ Web Push не инициализирован (неверный VAPID ключ):', err);
  }
}

// Defer init so server starts even if VAPID keys are invalid
setTimeout(initPush, 0);

export async function sendPush(
  userId: string,
  payload: { title: string; body: string; tag?: string; data?: Record<string, string> }
) {
  if (!initialized) return;

  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  if (!tokens.length) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag || 'message',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    data: payload.data || {},
    requireInteraction: payload.tag === 'call',
    vibrate: payload.tag === 'call' ? [500, 200, 500, 200, 500] : [200, 100, 200],
    actions: payload.tag === 'call'
      ? [{ action: 'accept', title: '✅ Принять' }, { action: 'decline', title: '❌ Отклонить' }]
      : [{ action: 'open', title: '💬 Открыть' }],
  });

  const dead: string[] = [];
  await Promise.all(tokens.map(async t => {
    try {
      await webpush.sendNotification(JSON.parse(t.token), message);
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) dead.push(t.id);
    }
  }));

  if (dead.length) await prisma.pushToken.deleteMany({ where: { id: { in: dead } } });
}
