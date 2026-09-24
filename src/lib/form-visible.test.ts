import { describe, expect, it } from 'vitest';
import { emptyForm, parseForm } from './form';

describe('parseForm only reads visible fields', () => {
  it('ignores economics of another path', () => {
    const f = { ...emptyForm(), days: '7', eco: { price: 'abc' } };
    expect(parseForm(f).bad).toContain('price');
    expect(parseForm({ ...f, pathId: 'leads_whatsapp' }).bad).not.toContain('price');
  });
  it('drops metrics not shown for path/level', () => {
    const f = { ...emptyForm(), days: '7', metrics: { calls: '5', spend: '100' } };
    const { input } = parseForm(f);
    expect(input.metrics).not.toHaveProperty('calls');
    expect(input.metrics.spend).toBe(100);
  });
  it('still reports bad visible field', () => {
    const f = { ...emptyForm(), days: '7', metrics: { spend: 'x1' } };
    expect(parseForm(f).bad).toContain('spend');
  });
});
