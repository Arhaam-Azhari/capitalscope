import type { priceDrawdown } from './priceDrawdown';

export default function PriceDrawdownChart({ result }: { result: ReturnType<typeof priceDrawdown> }) {
  const scale = result.maximumDeclinePercent || 1;
  const points = result.rows.map((row, i) => `${45 + i / (result.rows.length - 1) * 440},${35 + row.declinePercent / scale * 130}`).join(' ');
  return <div className="trend"><svg viewBox="0 0 520 220" role="img" aria-label="Decline below the running raw-close peak; exact percentages are in the observations table">
    <line className="zero-line" x1="45" x2="485" y1="35" y2="35" />
    <text x="45" y="25">0% · At running peak</text>
    <polygon fill="var(--accent)" opacity="0.12" points={`45,35 ${points} 485,35`} />
    <polyline fill="none" stroke="var(--accent)" strokeWidth="3" points={points} />
    <text x="45" y="190">{scale.toFixed(2)}% decline</text>
    <text x="45" y="215">{result.rows[0].date}</text><text x="485" y="215" textAnchor="end">{result.rows[result.rows.length - 1].date}</text>
  </svg><p className="muted small">Deeper points mean larger price declines. Vertical scale runs from zero to {scale.toFixed(2)}%; dates are spaced by observation order, so gaps are not proportional to calendar time.</p></div>;
}
