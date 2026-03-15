import { useEffect, useState } from 'react';
import ThemeProvider from './components/ThemeProvider';
import DeepLinkHandler from './components/DeepLinkHandler';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  const { token, user, checkAuth, isLoading } = useAuthStore();
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handler = () => setAdminOpen(true);
    window.addEventListener('open-admin', handler);
    return () => window.removeEventListener('open-admin', handler);
  }, []);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <VortexLoader />
          <p className="text-zinc-500 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <>
      <AnimatePresence mode="wait">
        {token && user ? (
          <ChatPage key="chat" />
        ) : (
          <AuthPage key="auth" />
        )}
      </AnimatePresence>
      {adminOpen && ['amebo4ka'].includes(user?.username || '') && (
        <AdminPage onClose={() => setAdminOpen(false)} />
      )}
      {token && user && <DeepLinkHandler />}
    </>
    </ThemeProvider>
  );
}

function VortexLoader() {
  return (
    <div className="relative w-12 h-12">
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-vortex-500 animate-spin" />
      <div
        className="absolute inset-1 rounded-full border-2 border-transparent border-t-vortex-400 animate-spin"
        style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}
      />
      <div
        className="absolute inset-2 rounded-full border-2 border-transparent border-t-vortex-300 animate-spin"
        style={{ animationDuration: '0.6s' }}
      />
    </div>
  );
}
