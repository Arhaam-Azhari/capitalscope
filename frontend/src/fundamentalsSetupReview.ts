import { csvCell } from './csvCell';
import { peerMeasures } from './peerMeasures';
import type { Company } from './types';

export type FundamentalsSetup = { id: string; name: string; tickers: string[]; measure: string; createdAt: string; modelVersion: string };
export function fundamentalsSetupCompatible(item: FundamentalsSetup, companies: Company[]) {
  return item.modelVersion === 'fundamentals-comparison-v1' && item.tickers.length >= 2 && item.tickers.length <= 4 && new Set(item.tickers).size === item.tickers.length && item.tickers.every(ticker => companies.some(company => company.ticker === ticker)) && Object.prototype.hasOwnProperty.call(peerMeasures, item.measure);
}
export function setupMeasureLabel(measure: string) {
  return Object.prototype.hasOwnProperty.call(peerMeasures, measure) ? peerMeasures[measure as keyof typeof peerMeasures] : 'Unsupported measure';
}
export function searchFundamentalsSetups(items: FundamentalsSetup[], query: string, companies: Company[]) {
  const search = query.trim().toLocaleLowerCase();
  return items.filter(item => [item.name, item.measure, setupMeasureLabel(item.measure), ...item.tickers.flatMap(ticker => [ticker, companies.find(company => company.ticker === ticker)?.name || ''])].join(' ').toLocaleLowerCase().includes(search));
}
export function fundamentalsSetupsCsv(items: FundamentalsSetup[], companies: Company[], updatedAt: string, exportedAt: string) {
  const header = ['export_model_version', 'setup_id', 'setup_name', ...[1, 2, 3, 4].flatMap(position => [`peer_${position}_ticker`, `peer_${position}_company`]), 'measure_key', 'measure_label', 'saved_at', 'setup_model_version', 'can_open', 'list_updated_in_view_at', 'exported_at', 'scope'];
  const scope = 'All currently loaded setups, including records hidden by search or unavailable to open. Shared database selections only; peer order is preserved. No financial figures or results. List-update time records the last successful read/save/delete in this view. Opening requests current reports. Export does not refresh the database or SEC data.';
  return [header, ...items.map(item => ['saved-fundamentals-setup-export-v1', item.id, item.name, ...[0, 1, 2, 3].flatMap(index => { const ticker = item.tickers[index] || ''; return [ticker, companies.find(company => company.ticker === ticker)?.name || '']; }), item.measure, setupMeasureLabel(item.measure), item.createdAt, item.modelVersion, String(fundamentalsSetupCompatible(item, companies)), updatedAt, exportedAt, scope])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
