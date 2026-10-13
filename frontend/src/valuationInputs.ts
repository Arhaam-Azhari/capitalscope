import type { Assumptions } from './types';

export type ValuationInputs = Record<keyof Assumptions, string>;

// I retain only editable inputs during navigation; results must be calculated again.
export const sessionValuationInputs = new Map<string, ValuationInputs>();
