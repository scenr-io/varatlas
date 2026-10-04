/* Windowing math for fixed-height rows: which slice of a long list is on screen. */

export interface Range {
  start: number;
  end: number;
}

export function visibleRange(
  total: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 10,
): Range {
  if (total === 0) return { start: 0, end: 0 };
  const first = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const last = Math.ceil((Math.max(0, scrollTop) + viewportHeight) / rowHeight);
  return {
    start: Math.max(0, Math.min(total - 1, first - overscan)),
    end: Math.min(total, last + overscan),
  };
}
