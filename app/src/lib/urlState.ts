import { useSyncExternalStore } from 'react';
import type { OrderStatus } from '../data/generateOrders';

export type FilterState = {
  search: string;
  statuses: OrderStatus[];
};

function parseSearch(qs: string): FilterState {
  const params = new URLSearchParams(qs);
  const statuses = params.get('status');
  return {
    search: params.get('q') ?? '',
    statuses: statuses ? (statuses.split(',') as OrderStatus[]) : [],
  };
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}

function getSnapshot(): string {
  return window.location.search;
}

export function useFilterState(): [FilterState, (next: FilterState) => void] {
  const qs = useSyncExternalStore(subscribe, getSnapshot, () => '');
  const state = parseSearch(qs);

  const setState = (next: FilterState) => {
    const params = new URLSearchParams();
    if (next.search) params.set('q', next.search);
    if (next.statuses.length) params.set('status', next.statuses.join(','));
    const query = params.toString();
    const url = query ? `?${query}` : window.location.pathname;
    window.history.pushState(null, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return [state, setState];
}
