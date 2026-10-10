import { allocationSectorPlan } from './portfolioRebalance';
import type { Company, PortfolioMarks } from './types';

function shockPercent(value: string) {
  const trimmed = value.trim();
  if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(trimmed) || Math.abs(Number(trimmed)) > 100)
    throw new Error('Enter price changes from -100 to 100, using up to two decimal places.');
  return Number(trimmed);
}

export function allocationShock(marks: PortfolioMarks, targets: string[], companies: Company[], defaultShock: string, overrides: Record<string, string>) {
  const groups = allocationSectorPlan(marks, targets, companies);
  const defaultPercent = shockPercent(defaultShock);
  if (Object.keys(overrides).some(label => !groups.some(group => group.kind === 'sector' && group.label === label)))
    throw new Error('A sector override does not match this allocation plan.');
  const rows = groups.map(group => {
    const shock = group.kind === 'cash' ? 0 : overrides[group.label]?.trim() ? shockPercent(overrides[group.label]) : defaultPercent;
    // I hold each mix's cash fixed and apply the same sector shock once to its dollar allocation.
    const currentStressedValue = group.currentValue * (1 + shock / 100);
    const targetStressedValue = group.targetValue * (1 + shock / 100);
    return { ...group, shockPercent: shock, currentStressedValue, targetStressedValue,
      currentChange: currentStressedValue - group.currentValue, targetChange: targetStressedValue - group.targetValue };
  });
  const currentTotal = rows.reduce((sum, row) => sum + row.currentStressedValue, 0);
  const targetTotal = rows.reduce((sum, row) => sum + row.targetStressedValue, 0);
  if (![currentTotal, targetTotal].every(Number.isFinite)) throw new Error('Shock values exceed the supported numeric range.');
  const baselineTotal = marks.totalValue!;
  const currentChange = currentTotal - baselineTotal, targetChange = targetTotal - baselineTotal;
  return { defaultShockPercent: defaultPercent, baselineTotal, rows, currentTotal, targetTotal, currentChange, targetChange,
    currentChangePercent: currentChange / baselineTotal * 100, targetChangePercent: targetChange / baselineTotal * 100,
    targetMinusCurrent: targetTotal - currentTotal };
}
