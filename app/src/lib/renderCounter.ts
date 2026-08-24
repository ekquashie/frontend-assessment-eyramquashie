declare global {
  interface Window {
    __renderCounts?: Record<string, number>;
  }
}

export function countRender(id: string) {
  if (typeof window === 'undefined') return;
  window.__renderCounts ??= {};
  window.__renderCounts[id] = (window.__renderCounts[id] ?? 0) + 1;
}
