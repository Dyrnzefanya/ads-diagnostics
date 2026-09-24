/** a * k / b; null bila data kosong atau pembagi <= 0. Nilai 0 tetap valid. */
export const per = (a?: number, b?: number, k = 1): number | null =>
  a == null || b == null || b <= 0 ? null : (a * k) / b;
