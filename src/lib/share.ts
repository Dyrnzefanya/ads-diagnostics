import { PATHS } from '../config/meta/paths';
import type { ThOverrides } from '../config/meta/thresholds';
import type { DiagnosisInput } from '../engine/types';

export interface SharedState { input: DiagnosisInput; presetId: string; overrides: ThOverrides }

/** State → base64url (aman untuk query string, mendukung karakter non-ASCII). */
export function encodeState(s: SharedState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const isNumRecord = (o: unknown): o is Record<string, number> =>
  typeof o === 'object' && o !== null && Object.values(o).every((v) => typeof v === 'number');

function isState(s: unknown): s is SharedState {
  const x = s as SharedState;
  const i = x?.input;
  return (
    !!i && typeof i.pathId === 'string' && Object.hasOwn(PATHS, i.pathId) &&
    ['campaign', 'adset', 'ad'].includes(i.level) &&
    (i.days === null || typeof i.days === 'number') && isNumRecord(i.metrics) &&
    (i.economics === undefined || isNumRecord(i.economics)) &&
    typeof x.presetId === 'string' && typeof x.overrides === 'object' && x.overrides !== null
  );
}

/** Kembalikan null untuk link rusak atau hasil edit manual yang tidak valid. */
export function decodeState(raw: string): SharedState | null {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const s = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    if (s?.input && s.input.days === null) s.input.days = NaN; // NaN → null saat JSON
    return isState(s) ? s : null;
  } catch {
    return null;
  }
}
