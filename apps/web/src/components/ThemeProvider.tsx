import { useEffect } from 'react';
import { useThemeStore, applyTheme } from '../stores/themeStore';
import { useAuthStore } from '../stores/authStore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, loadFromServer } = useThemeStore();
  const { user } = useAuthStore();

  // Apply theme on mount and whenever settings change
  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // Load theme from server when user logs in
  useEffect(() => {
    if (user && (user as any).themeSettings) {
      loadFromServer((user as any).themeSettings);
    }
  }, [user?.id]);

  // Listen for system color scheme changes when using 'auto'
  useEffect(() => {
    if (settings.colorScheme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(settings);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.colorScheme]);

  return <>{children}</>;
}
