export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  let body;
  try { body = await response.json(); }
  catch { throw new Error('The research service is unavailable. Try again shortly.'); }
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body as T;
}

export const money = (value: number, compact = true) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', notation: compact ? 'compact' : 'standard',
  maximumFractionDigits: compact ? 2 : 2
}).format(value);
