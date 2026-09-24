import type { Metadata } from 'next';
import { HistoryList } from '@/components/HistoryList';

export const metadata: Metadata = { title: 'Riwayat — Meta Ads Diagnostic' };

export default function Page() {
  return <HistoryList />;
}
