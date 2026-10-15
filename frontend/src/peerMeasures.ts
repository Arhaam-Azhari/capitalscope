export const peerMeasures = {
  revenue: 'Revenue',
  growth: 'Annual revenue growth',
  'net-margin': 'Net income margin',
  'ocf-margin': 'Operating cash flow margin',
  'cash-after-capex': 'Cash after capex',
  'cash-margin': 'Cash after capex / revenue'
} as const;
export type PeerMeasure = keyof typeof peerMeasures;
export const defaultPeerMeasure: PeerMeasure = 'net-margin';
