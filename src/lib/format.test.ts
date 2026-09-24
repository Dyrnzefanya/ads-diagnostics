import { describe, expect, it } from 'vitest';
import { fmtRp, fmtUnit, parseID } from './format';

describe('parseID', () => {
  it.each([
    ['Rp1.250.000', 1250000], ['1.250.000', 1250000], ['1250000', 1250000], ['12,5', 12.5],
    ['1.234,56', 1234.56], ['12.5', 12.5], ['1.250', 1250], ['0', 0], ['  Rp 500.000 ', 500000],
  ])('%s → %d', (raw, n) => expect(parseID(raw)).toBe(n));

  it.each(['', '   ', 'abc', '1,2,3', 'Rp'])('menolak %j', (raw) => expect(parseID(raw)).toBeNull());
});

describe('format', () => {
  it('Rupiah memakai titik ribuan', () => expect(fmtRp(1250000)).toBe('Rp1.250.000'));
  it('null tampil strip', () => expect(fmtUnit(null, 'rp')).toBe('—'));
  it('persen memakai koma desimal', () => expect(fmtUnit(9.2307, 'pct')).toBe('9,2%'));
});
