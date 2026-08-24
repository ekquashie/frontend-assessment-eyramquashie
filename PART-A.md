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

## Q4 Answer

**Values painted:** `idle`, then `saving`, then `idle`.

Click fires, `setLabel('saving')` paints before the await. After the 400ms await resolves, `setLabel('saved')` and `setLabel(label === 'saving' ? 'done' : label)` both run synchronously, no await between them, so React 18 batches them and only the last result paints.

**Why `saved` and `done` never show:** `label` in `onClick` is captured from the render that created the closure, before this click's updates committed, so it's still `'idle'`. `label === 'saving'` is false, so the ternary returns `label`, i.e. `'idle'`. That overwrites the `setLabel('saved')` right before it, and since both are in the same batch, only `'idle'` paints. `saved` is assigned but never rendered; `done` is unreachable since the condition is always false against a stale closure.

**Final state:** the button reads `idle`, same as before the click. No confirmation, no error, nothing visibly changed despite the mutation succeeding.

**Fix:** delete the last line. `setLabel('saved')` in the try block is already the correct terminal state; that extra line is the only thing breaking it.

## Q5 Answer

```ts
type ApiError = { code: ErrorCode; message: string; field?: string };

type ErrorHandlers = {
  onField?: (field: string, message: string) => void;
  onToast?: (message: string) => void;
  onSilent?: (error: ApiError) => void;
};

function handleApiError(error: ApiError, handlers: ErrorHandlers): void {
  switch (error.code) {
    case 'VALIDATION_FAILED':
      error.field && handlers.onField
        ? handlers.onField(error.field, error.message)
        : handlers.onToast?.(error.message);
      return;
    case 'SUPPLIER_LOCKED':
    case 'STOCK_NEGATIVE':
    case 'IMPORT_IN_PROGRESS':
    case 'RATE_LIMITED':
      handlers.onToast?.(error.message);
      return;
    default:
      assertUnreachable(error.code, handlers);
  }
}

function assertUnreachable(code: never, handlers: ErrorHandlers): void {
  handlers.onToast?.('Something went wrong.');
}
```

Each consumer calls `handleApiError(response.error, { onField, onToast })`, passing only the callbacks it needs. The poll passes `{}`, so nothing fires, staying silent by construction rather than by remembering to suppress anything.

1. `data` is non-null on success because the type is a discriminated union on `error`, not a cast: TypeScript narrows `data: T` once you check `error === null`, so no assertion is needed, the compiler proves it.

2. Adding a new `ErrorCode` breaks the `switch`'s `default` branch, since `assertUnreachable` requires `never`, an unhandled code no longer satisfies that parameter and the build fails.

3. Point 2 is a compile-time guarantee for known codes; point 3 is different, a code the frontend has never seen still satisfies the `default` case's runtime fallthrough, so `assertUnreachable` still fires and still calls `onToast`, so the user sees a generic message instead of silence, even though `never` is technically violated by real data.

4. If `field` doesn't match a real input name, `onField` fires with a name the form doesn't recognize, and the message never attaches to anything visible, silently dropped. That's fixed inside the form's `onField` implementation, falling back to a toast when the field name isn't registered, not by every consumer re-deriving that logic.

## Q6 Answer

Reject it.

Virtualization keeps only the rows near the current scroll position in the DOM, everything else is unmounted. Two things break, both for the warehouse floor worker specifically: Ctrl-F only matches text actually in the DOM, so an order number that's scrolled out of view won't be found even though it's in the filtered list. Ctrl-P prints whatever the browser currently has rendered, not the full dataset, so the sheet that ends up on the clipboard is missing most of the orders. That's not degraded UX, it's a wrong physical document driving warehouse decisions.

Instead I'd leave the DOM full and attack the six seconds directly: virtualize nothing, but cut what's actually slow, paginate or lazy-load the initial fetch so first paint isn't waiting on all 3,000 rows, memoize row rendering properly, and move any per-row computation out of render. If the list itself must stay client-side complete for print and find, the cost of that approach is real, you're still shipping and rendering all 3,000 rows eventually, so the win is bounded to how much of the six seconds was wasted work rather than unavoidable rendering, and it takes more profiling than dropping in a virtualizer.
