import { annualFundamentals, comparisonRatio } from './companyFundamentals';
import { money } from './api';
import EvidenceTable from './EvidenceTable';
import type { FinancialReport } from './types';

const percent = (value: number | undefined) => value === undefined ? '—' : `${(value * 100).toFixed(1)}%`;

export default function FinancialRatios({ report }: { report: FinancialReport }) {
  const rows = annualFundamentals(report);
  return <section className="panel financial-ratios" aria-labelledby="ratio-history-heading">
    <div className="panel-title"><div><span className="eyebrow">ANNUAL PERFORMANCE</span><h2 id="ratio-history-heading">Growth, margins & cash flow</h2></div><span className="pill">Matched periods</span></div>
    <p className="muted small">Margins use the same start and end dates as each annual revenue period. Growth compares revenue with a period ending 300–400 days earlier and requires positive prior revenue. Missing or mismatched inputs stay unavailable. Cash after capex is operating cash flow minus capex, not the unlevered cash flow used by the valuation model.</p>
    {!rows.length ? <p>No supported annual revenue periods are available for ratio history.</p> : <EvidenceTable label="Annual performance history"><table><caption>Annual ratios and matched-period input evidence</caption><thead><tr><th>Period ended</th><th>Revenue growth</th><th>Net income margin</th><th>Operating cash flow margin</th><th>Cash after capex</th><th>Inputs</th></tr></thead><tbody>
      {rows.map(({ revenue, income, operating, capex, prior, afterCapex }) => <tr key={revenue!.periodEnd}>
        <th scope="row">{revenue!.periodEnd}</th>
        <td>{percent(comparisonRatio(revenue && prior ? revenue.value - prior.value : undefined, prior?.value))}</td>
        <td>{percent(comparisonRatio(income?.value, revenue?.value))}</td>
        <td>{percent(comparisonRatio(operating?.value, revenue?.value))}</td>
        <td>{afterCapex === undefined ? '—' : money(afterCapex)}</td>
        <td><details><summary>Evidence for {revenue!.periodEnd}</summary><ul className="ratio-inputs">
          {([['Revenue', revenue], ['Prior revenue', prior], ['Net income', income], ['Operating cash flow', operating], ['Capital expenditure', capex]] as const).map(([name, point]) => <li key={name}><strong>{name}</strong>{point ? <><span>{money(point.value, false)} · USD</span><span>{point.periodStart || 'Start unavailable'} to {point.periodEnd}</span><span>Filed {point.filed || 'unavailable'} · {point.tag}</span>{report.dataMode === 'example' ? <span>Invented example</span> : point.sourceUrl ? <a href={point.sourceUrl} target="_blank" rel="noreferrer">{name} filing ↗</a> : <span>Filing link unavailable</span>}</> : <span>No matching annual input</span>}</li>)}
        </ul></details></td>
      </tr>)}
    </tbody></table></EvidenceTable>}
    <p className="muted small">Different fiscal periods and accounting changes can affect year-to-year comparisons. A missing ratio is not zero.</p>
  </section>;
}
