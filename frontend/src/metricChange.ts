import type { Metric, Point } from './types';

function day(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time / 86400000 : undefined;
}
function duration(point: Point) {
  const start = day(point.periodStart), end = day(point.periodEnd);
  return start === undefined || end === undefined ? undefined : end - start + 1;
}
type Change = { latest?: Point; prior?: Point; amount?: number; percentage?: number; reason: string; percentageReason: string; balance: boolean };
export function metricChange(metric: Metric): Change {
  const result: Change = { reason: '', percentageReason: '', balance: metric.name === 'Cash and equivalents' };
  if (metric.unit !== 'USD') return { ...result, reason: 'This comparison supports reported USD values only.' };
  if (!metric.annualValues.length) return { ...result, reason: 'No reported annual values are available.' };
  if (metric.annualValues.some(point => day(point.periodEnd) === undefined)
    || new Set(metric.annualValues.map(point => point.periodEnd)).size !== metric.annualValues.length)
    return { ...result, reason: 'Reporting dates are invalid or duplicated; check the source facts.' };
  const ordered = [...metric.annualValues].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  result.latest = ordered[0];
  const candidates = ordered.slice(1).filter(point => {
    const gap = day(result.latest!.periodEnd)! - day(point.periodEnd)!;
    return gap >= 300 && gap <= 400;
  });
  if (candidates.length !== 1) return { ...result, reason: candidates.length ? 'More than one prior period ends 300–400 days earlier; a unique comparison is unavailable.' : 'No prior period ends 300–400 days earlier. Older gaps are not treated as one year.' };
  result.prior = candidates[0];
  if (!result.balance) {
    const currentDays = duration(result.latest), priorDays = duration(result.prior);
    // I compare full annual flows with similar lengths, allowing a 52/53-week calendar difference.
    if (currentDays === undefined || priorDays === undefined || currentDays < 300 || currentDays > 400
      || priorDays < 300 || priorDays > 400 || Math.abs(currentDays - priorDays) > 7)
      return { ...result, reason: 'Annual flow windows must have known starts, span 300–400 days each, and differ by no more than 7 days. These windows do not qualify.' };
  }
  const amount = result.latest.value - result.prior.value;
  if (![result.latest.value, result.prior.value, amount].every(Number.isFinite)) return { ...result, reason: 'The reported values or difference are outside the supported numeric range.' };
  result.amount = amount;
  const percentage = amount / result.prior.value * 100;
  if (result.prior.value <= 0) result.percentageReason = 'Percentage change needs a positive prior value. The dollar change remains available for zero or negative baselines.';
  else if (!Number.isFinite(percentage)) result.percentageReason = 'Percentage change is outside the supported numeric range.';
  else result.percentage = percentage;
  return result;
}
