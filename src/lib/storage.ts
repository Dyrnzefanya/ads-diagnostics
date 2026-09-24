import type { Level } from '../engine/types';
import type { ThOverrides } from '../config/meta/thresholds';

const HISTORY_KEY = 'ads-diag:history:v1';
const SETTINGS_KEY = 'ads-diag:settings:v1';
export const MAX_HISTORY = 50;

export interface HistoryEntry {
  id: string;
  at: string;
  label: string;
  kondisi: string;
  pathLabel: string;
  level: Level;
  /** encodeState(...) — dibuka lewat /diagnosis?s=<state>. */
  state: string;
}

export interface Settings { presetId: string; overrides: ThOverrides }

// localStorage bisa melempar error (mode privat, data situs diblokir); semuanya dianggap "kosong".
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* abaikan */ }
}

export function loadHistory(): HistoryEntry[] {
  const list = read<unknown>(HISTORY_KEY, []);
  return Array.isArray(list) ? (list as HistoryEntry[]) : [];
}

export function addHistory(e: Omit<HistoryEntry, 'id' | 'at'>): void {
  const entry: HistoryEntry = { ...e, id: crypto.randomUUID(), at: new Date().toISOString() };
  write(HISTORY_KEY, [entry, ...loadHistory()].slice(0, MAX_HISTORY));
}

export const removeHistory = (id: string) => write(HISTORY_KEY, loadHistory().filter((h) => h.id !== id));
export const clearHistory = () => write(HISTORY_KEY, []);

export function loadSettings(): Settings {
  const s = read<unknown>(SETTINGS_KEY, null) as Settings | null;
  const ok = typeof s === 'object' && s !== null && typeof s.presetId === 'string' && typeof s.overrides === 'object' && s.overrides !== null;
  return ok ? s : { presetId: 'ecommerce', overrides: {} };
}
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);
