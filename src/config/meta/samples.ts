import type { DiagnosisInput } from '../../engine/types';

export interface Sample { id: string; label: string; input: DiagnosisInput }

const economics = { price: 149000, cost: 45000 };
const base = { pathId: 'sales_website', level: 'campaign', days: 5, economics } as const;

/** Skenario Website Purchase untuk tombol "Coba Skenario". Urutan = urutan putar. */
export const SAMPLES: Sample[] = [
  {
    id: 'sehat', label: 'Semua sehat',
    input: { ...base, days: 6, metrics: { spend: 520000, impressions: 15000, reach: 8333, linkClicks: 250, lpv: 200, initiateCheckout: 50, purchases: 20 } },
  },
  {
    id: 'lp', label: 'Bottleneck landing page',
    input: { ...base, metrics: { spend: 350000, impressions: 30000, reach: 22000, linkClicks: 400, lpv: 260, initiateCheckout: 24, purchases: 6 } },
  },
  {
    id: 'checkout', label: 'Bottleneck checkout',
    input: { ...base, metrics: { spend: 400000, impressions: 20000, reach: 15000, linkClicks: 300, lpv: 240, initiateCheckout: 60, purchases: 5 } },
  },
  {
    id: 'rugi', label: 'Rugi',
    input: { ...base, metrics: { spend: 600000, impressions: 30000, reach: 22000, linkClicks: 300, lpv: 240, initiateCheckout: 20, purchases: 5 } },
  },
];
