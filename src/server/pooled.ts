/** Map `items` through `fn` with at most `limit` calls in flight. Preserves order. */
export async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  const queue = items.map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      results[next.index] = await fn(next.item);
    }
  });
  await Promise.all(workers);
  return results;
}
