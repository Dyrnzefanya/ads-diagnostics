import type { MetricKey } from '../../engine/types';

export interface MetricDef { label: string; unit: 'rp' | 'num'; hint: string }

export const METRICS: Record<MetricKey, MetricDef> = {
  spend: { label: 'Ad Spend', unit: 'rp', hint: 'Ads Manager → kolom "Amount spent" untuk rentang tanggal yang sama.' },
  impressions: { label: 'Impressions', unit: 'num', hint: 'Kolom "Impressions".' },
  reach: { label: 'Reach', unit: 'num', hint: 'Kolom "Reach". Wajib di level Ad Set untuk membaca frequency.' },
  linkClicks: { label: 'Link Clicks', unit: 'num', hint: 'Kolom "Link clicks" (bukan "Clicks (all)").' },
  lpv: { label: 'Landing Page Views', unit: 'num', hint: 'Kolom "Landing page views".' },
  initiateCheckout: { label: 'Initiate Checkout', unit: 'num', hint: 'Kolom "Checkouts initiated".' },
  addToCart: { label: 'Add to Cart', unit: 'num', hint: 'Kolom "Adds to cart".' },
  purchases: { label: 'Purchases', unit: 'num', hint: 'Kolom "Website purchases" atau "Purchases".' },
  leads: { label: 'Leads', unit: 'num', hint: 'Kolom "Leads" (instant form atau website).' },
  conversations: { label: 'Messaging Conversations Started', unit: 'num', hint: 'Kolom "Messaging conversations started".' },
  calls: { label: 'Calls Placed', unit: 'num', hint: 'Kolom "Calls placed".' },
  installs: { label: 'App Installs', unit: 'num', hint: 'Kolom "Mobile app installs".' },
  appEvents: { label: 'App Events', unit: 'num', hint: 'Jumlah event utama aplikasi yang kamu optimasi (mis. registrasi, purchase).' },
  engagements: { label: 'Post Engagements', unit: 'num', hint: 'Kolom "Post engagements".' },
  sharesSaves: { label: 'Shares + Saves', unit: 'num', hint: 'Jumlah "Post shares" ditambah "Post saves".' },
  plays3s: { label: '3-sec Video Plays', unit: 'num', hint: 'Kolom "3-second video plays".' },
  thruPlays: { label: 'ThruPlays', unit: 'num', hint: 'Kolom "ThruPlays".' },
};

export const GLOBAL_FIELDS: MetricKey[] = ['spend', 'impressions'];
