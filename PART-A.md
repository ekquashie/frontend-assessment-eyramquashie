## Position Applied For
Senior Frontend Developer

## Q1 Answer

**Factually Wrong Parts:**

React.memo does shallow comparisons not deep. The developer is correct that a rebuilt columns array fails shallow comparison, but that's the point—shallow comparison catches.

**Will useMemo Fix It?**

No. Wrapping columns in useMemo helps only if the parent stops rebuilding on every keystroke. If the parent re-renders, the dependency array changes and useMemo returns a new array anyway. The fix requires the parent to be memoized with useCallback or to not rebuild columns at all.

**Two Other Things That Defeat React.memo:**
1. Passing inline functions as props as props: `onClick={() => handleDelete(id)}`

2. Passing object literals as props: `style={{ color: blue }}` or `className={{ active: true }}`

**Actual Cause:**
The parent re-renders on every keystroke, so shallow comparison always sees a new columns reference and allows ProductRow to re-render.

## Q2 Answer

**Defects, ranked by severity:**

1. **No rollback on failed status update.** The `try`/`catch` is backwards: `await queryFulfilled` sits inside `catch` instead of `try`, so the promise's rejection is never caught there. When the PATCH fails, the optimistic patch stays applied and no rollback runs. The user sees a product's status change and stick, even though the server rejected it. This ranks first because it silently corrupts what the user believes is ground truth, with no error shown and no recovery until an unrelated refetch happens to overwrite it.

2. **Optimistic update only patches one cache entry.** `updateQueryData('getProducts', {} as ProductFilters, ...)` only touches the cache keyed on empty filters. An operator viewing a filtered list won't see the row update until `invalidatesTags` triggers a refetch, so the same action looks instant on the unfiltered table and delayed on every filtered view. Reads as inconsistent, flaky behavior.

3. **Empty `try` block is dead code.** `try {} catch { await queryFulfilled; ... }`. The try body does nothing, so this construct doesn't do what its comment implies.

**False comment claim:**
`// ignore - the invalidation will refetch anyway` is false. Because `await queryFulfilled` sits in `catch` rather than `try`, the rejection handling this comment is justifying never actually runs as designed. There is no confirmed refetch-covers-it safety net here.

**Looks like a defect but isn't:**
Using a shared `'Product'` tag for both `getProducts` and `updateProductStatus`, instead of per-id tags, looks lazy but is fine here. It just means any status update invalidates the whole list, which is acceptable for a small admin table and guarantees eventual consistency regardless of filters.