import { csvCell } from './csvCell';
import type { PriceComparisonSetup } from './SavedPriceComparisonSetups';
import type { Company } from './types';

export function priceSetupCompatible(item: PriceComparisonSetup, currentTicker: string, companies: Company[]) {
  return item.currentTicker === currentTicker && item.modelVersion === 'price-comparison-setup-v1' && item.referenceTicker !== currentTicker && companies.some(company => company.ticker === item.referenceTicker);
}

export function searchPriceSetups(items: PriceComparisonSetup[], query: string, companies: Company[]) {
  const search = query.trim().toLocaleLowerCase();
  return items.filter(item => [item.name, item.referenceTicker, companies.find(company => company.ticker === item.referenceTicker)?.name || '', item.startDate, item.endDate].join(' ').toLocaleLowerCase().includes(search));
}

export function priceSetupsCsv(items: PriceComparisonSetup[], currentTicker: string, companies: Company[], updatedAt: string, exportedAt: string) {
  const header = ['export_model_version', 'setup_id', 'setup_name', 'current_ticker', 'reference_ticker', 'reference_company', 'start_date', 'end_date', 'saved_at', 'setup_model_version', 'can_load_in_current_view', 'list_updated_in_view_at', 'exported_at', 'scope'];
  const scope = 'All currently loaded saved setup records, regardless of search, including unavailable or unsupported setups. Shared database inputs only; no prices, calculated results, or historical valuation evidence. List-update time records the last successful read/save/delete in this view. Loading requires a new price comparison; old windows may no longer overlap stored history. CSV does not refresh the database or prices.';
  return [header, ...items.map(item => [ 'saved-price-setup-export-v1', item.id, item.name, item.currentTicker, item.referenceTicker,
    companies.find(company => company.ticker === item.referenceTicker)?.name || '', item.startDate, item.endDate, item.createdAt, item.modelVersion,
    String(priceSetupCompatible(item, currentTicker, companies)), updatedAt, exportedAt, scope ])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
