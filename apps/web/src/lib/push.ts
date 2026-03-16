async function getVapidKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-key');
    if (!res.ok) return null;
    const { key } = await res.json();
    return key;
  } catch { return null; }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}

export async function registerPushToken(authToken: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const vapidKey = await getVapidKey();
    if (!vapidKey) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ subscription }),
    });

    console.log('✔ Push подписка зарегистрирована');
  } catch (err) {
    console.warn('Push registration failed:', err);
  }
}

export function listenForegroundPush(): void {
  // Foreground notifications handled by SW - nothing to do here
}
