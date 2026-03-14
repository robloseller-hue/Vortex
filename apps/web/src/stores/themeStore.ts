import { create } from 'zustand';
import { api } from '../lib/api';

export type ChatTheme = 'midnight' | 'ocean' | 'forest' | 'sunset' | 'classic' | 'neon' | 'aurora' | 'cyber' | 'glass' | 'void' | 'custom';
export type ColorScheme = 'dark' | 'light' | 'auto';
export type FontSize = 'small' | 'medium' | 'large';
export type BubbleSize = 'compact' | 'normal' | 'comfortable';

export interface ThemeSettings {
  theme: ChatTheme;
  accentColor: string;      // hex color
  fontSize: FontSize;
  bubbleSize: BubbleSize;
  colorScheme: ColorScheme;
  chatBg: string;           // 'default' | 'gradient:...' | 'pattern:...' | 'image:...'
}

const DEFAULTS: ThemeSettings = {
  theme: 'midnight',
  accentColor: '#6366f1',
  fontSize: 'medium',
  bubbleSize: 'normal',
  colorScheme: 'dark',
  chatBg: 'default',
};

function loadLocal(): ThemeSettings {
  try {
    const raw = localStorage.getItem('zync-theme');
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { return DEFAULTS; }
}

function saveLocal(s: ThemeSettings) {
  localStorage.setItem('zync-theme', JSON.stringify(s));
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null;

interface ThemeState {
  settings: ThemeSettings;
  syncing: boolean;
  // Legacy compat
  chatTheme: ChatTheme;
  setChatTheme: (theme: ChatTheme) => void;
  // New
  update: (patch: Partial<ThemeSettings>) => void;
  syncToServer: () => void;
  loadFromServer: (raw: unknown) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  settings: loadLocal(),
  syncing: false,
  // Legacy compat
  chatTheme: loadLocal().theme,
  setChatTheme: (theme) => get().update({ theme }),

  update: (patch) => {
    const next = { ...get().settings, ...patch };
    saveLocal(next);
    set({ settings: next, chatTheme: next.theme });
    applyTheme(next);
    // Debounced server sync
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => get().syncToServer(), 1000);
  },

  syncToServer: async () => {
    set({ syncing: true });
    try {
      await api.updateSettings({ themeSettings: get().settings });
    } catch { /* silent */ }
    set({ syncing: false });
  },

  loadFromServer: (raw) => {
    if (!raw || typeof raw !== 'object') return;
    const merged = { ...DEFAULTS, ...(raw as Partial<ThemeSettings>) };
    saveLocal(merged);
    set({ settings: merged, chatTheme: merged.theme });
    applyTheme(merged);
  },
}));

// ── Apply theme to DOM ────────────────────────────────────────────────
export function applyTheme(s: ThemeSettings) {
  const root = document.documentElement;

  // Accent color + derived shades
  const accent = s.accentColor || DEFAULTS.accentColor;
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-hover', lighten(accent, 15));
  root.style.setProperty('--color-accent-light', hexToRgba(accent, 0.15));

  // Also update vortex-500 so existing classes work
  root.style.setProperty('--color-vortex-400', lighten(accent, 10));
  root.style.setProperty('--color-vortex-500', accent);
  root.style.setProperty('--color-vortex-600', darken(accent, 10));

  // Color scheme (dark/light/auto)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = s.colorScheme === 'dark' || (s.colorScheme === 'auto' && prefersDark);

  if (isDark) {
    root.style.setProperty('--color-surface', '#09090b');
    root.style.setProperty('--color-surface-secondary', '#111113');
    root.style.setProperty('--color-surface-tertiary', '#1a1a1e');
    root.style.setProperty('--color-surface-hover', '#222226');
    root.style.setProperty('--color-border', 'rgba(255,255,255,0.08)');
    root.style.setProperty('--msg-bg', hexToRgba(accent, 0.18));
    root.style.setProperty('--msg-text', '#ffffff');
    root.style.setProperty('--msg-other-bg', '#1e1e22');
    document.body.style.background = '#09090b';
    document.body.style.color = '#fafafa';
  } else {
    root.style.setProperty('--color-surface', '#f4f4f5');
    root.style.setProperty('--color-surface-secondary', '#ffffff');
    root.style.setProperty('--color-surface-tertiary', '#e4e4e7');
    root.style.setProperty('--color-surface-hover', '#d4d4d8');
    root.style.setProperty('--color-border', 'rgba(0,0,0,0.1)');
    root.style.setProperty('--msg-bg', hexToRgba(accent, 0.85));
    root.style.setProperty('--msg-text', '#ffffff');
    root.style.setProperty('--msg-other-bg', '#ffffff');
    document.body.style.background = '#f4f4f5';
    document.body.style.color = '#09090b';
  }

  // Font size
  const fontMap: Record<FontSize, string> = { small: '13px', medium: '15px', large: '17px' };
  root.style.setProperty('--font-size-base', fontMap[s.fontSize]);
  document.body.style.fontSize = fontMap[s.fontSize];

  // Bubble size
  const paddingMap: Record<BubbleSize, string> = { compact: '6px 10px', normal: '8px 12px', comfortable: '12px 16px' };
  root.style.setProperty('--bubble-padding', paddingMap[s.bubbleSize]);

  // Chat background
  applyChatBg(s.chatBg, isDark);
}

function applyChatBg(chatBg: string, isDark: boolean) {
  const root = document.documentElement;
  if (!chatBg || chatBg === 'default') {
    root.style.removeProperty('--chat-bg');
    root.style.removeProperty('--chat-bg-image');
    return;
  }
  if (chatBg.startsWith('gradient:')) {
    root.style.setProperty('--chat-bg', chatBg.slice(9));
    root.style.removeProperty('--chat-bg-image');
  } else if (chatBg.startsWith('pattern:')) {
    const patterns: Record<string, string> = {
      dots: isDark
        ? 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)'
        : 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
      grid: isDark
        ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)'
        : 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
      waves: isDark
        ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 20px)'
        : 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)',
    };
    const name = chatBg.slice(8);
    root.style.setProperty('--chat-bg', patterns[name] || 'none');
    if (name === 'grid') root.style.setProperty('--chat-bg-size', '20px 20px');
    else root.style.setProperty('--chat-bg-size', '20px 20px');
  } else if (chatBg.startsWith('image:')) {
    root.style.setProperty('--chat-bg', `url("${chatBg.slice(6)}")`);
    root.style.setProperty('--chat-bg-size', 'cover');
  }
}

// ── Color helpers ─────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function lighten(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = pct / 100;
  return `#${[r, g, b].map(c => Math.min(255, Math.round(c + (255 - c) * f)).toString(16).padStart(2, '0')).join('')}`;
}
function darken(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - pct / 100;
  return `#${[r, g, b].map(c => Math.max(0, Math.round(c * f)).toString(16).padStart(2, '0')).join('')}`;
}
