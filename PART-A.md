## Position Applied For
Senior Frontend Developer

## Q1 Answer

React.memo does a shallow comparison, not deep, that part's wrong. But the rest of the diagnosis holds: a `columns` array rebuilt every render is a new reference even with identical contents, so it correctly fails shallow comparison. memo isn't broken, it's doing its job. The bug is upstream.

useMemo alone won't fix it. It only skips recomputation when its dependencies are stable, and if the parent re-renders every keystroke, those dependencies get recreated too. Fix the parent's re-render frequency instead, move the input's state out, or memoize the parent so its outputs stay stable.

Two other ways to defeat memo here: inline arrow functions as props (`onClick={() => handleDelete(id)}`), and inline object/array literals (`style={{ color: 'blue' }}`), both new references every render.

Root cause: the parent re-renders on every keystroke, rebuilding `columns` each time, and memo correctly re-renders ProductRow in response.

## Q2 Answer

**The bugs, worst first:**

1. The try/catch is inverted. `await queryFulfilled` is sitting inside the `catch` block instead of the `try` block, so it never actually catches a rejection. If the PATCH request fails, the optimistic update that already flipped the product's status in the cache just stays there. Nothing rolls it back. So an operator marks a product as, say, out of stock, the UI updates immediately, the request fails silently in the background, and the row just keeps showing the wrong status with no error toast, nothing. That's the worst one because it's not a crash or a visible error, it's quietly wrong data that looks correct, and it stays wrong until something else happens to trigger a refetch.

2. The optimistic patch only updates one cache entry, the one for `getProducts` with empty filters. If ops has the table filtered by category or status when they make the change, they won't see their own update reflected until the invalidation-driven refetch comes back. So the same action feels instant on the default view and laggy or broken on any filtered view, which is exactly the kind of "works on my machine" inconsistency that generates support tickets.

3. The try block itself is empty, so structurally this whole thing does nothing until the catch block runs, and per point 1, the catch block never runs on the success path either. It's dead code shaped like error handling.

**The false comment:** `// ignore - the invalidation will refetch anyway` isn't true given how the code is actually written. That comment is only accurate if the catch block reliably runs and does the rollback work, but because `await queryFulfilled` is in the wrong branch, there's no real safety net backing that comment up. It reads as reassuring but describes behavior the code doesn't have.

**Not actually a bug:** using one shared `'Product'` tag instead of per-id tags looks sloppy at first glance, but for a table this size it's a reasonable tradeoff. It just means one status update invalidates the whole list rather than a single row, which costs an extra refetch but guarantees every view of the data, filtered or not, eventually converges to the truth. I wouldn't flag this as a defect.

## Q3 Answer

```tsx
export const SupplierBadge = memo(function SupplierBadge({
  supplierId,
}: {
  supplierId: string;
}) {
  const { data, isLoading, isError } = useGetSupplierQuery(supplierId);
  const label = data?.name ? data.name.toUpperCase() : '';

  if (isLoading) return <Skeleton className="h-5 w-24" />;
  if (isError) return null;
  return <span className="rounded bg-muted px-2 py-0.5 text-xs">{label}</span>;
});
```

I removed the `useSupplierName` hook and its local `name` state, reading `data.name` straight from the query. That hook's effect only set `name` when `data?.name` was truthy, it never cleared it back out. So if this component gets reused for a different `supplierId`, say on a re-sort or virtualization recycling, the old name stays on screen until the new query resolves. That's the actual bug: one row briefly shows another supplier's name. Reading straight from `data` kills that stale window since there's no local state left to go stale.

I also dropped the useMemo around `.toUpperCase()`, it cost more than the string transform it wrapped.

Not fixed here: at 200 rows that's 200 separate `useGetSupplierQuery` calls, real request volume hitting the API. memo stops re-renders, not that. The fix belongs at the data-fetching layer, batch the supplier ids into one request instead of resolving per row.
