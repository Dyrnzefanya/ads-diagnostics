import type { Metadata } from 'next';
import { DiagnosisApp } from '@/components/DiagnosisApp';

export const metadata: Metadata = { title: 'Diagnosis — Meta Ads Diagnostic' };

export default function Page() {
  return <DiagnosisApp />;
}
