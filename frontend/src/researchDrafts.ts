import { useEffect } from 'react';

import type { WatchlistEntry } from './types';
export type WatchlistDraft = Pick<WatchlistEntry, 'thesis' | 'risks' | 'reviewDate' | 'version'> & { status: string; checks: string[]; entryId: string | null };
export const watchlistDrafts = new Map<string, WatchlistDraft>();
export const noteDrafts = new Map<string, string>();

export function useDraftExitWarning() {
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!noteDrafts.size && !watchlistDrafts.size) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
}
