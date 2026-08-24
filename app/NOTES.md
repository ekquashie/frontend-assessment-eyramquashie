# Notes

## Constraints 1 and 2 together

Printing every filtered row and not re-rendering unchanged rows pull in opposite directions if you reach for virtualization: virtualizing solves the render-count problem but unmounts off-screen rows, so `Ctrl-P` only prints whatever's currently scrolled into view. I resolved this by not virtualizing at all — every filtered row stays a real DOM node, so print gets everything for free — and solved the render-count constraint separately, with `React.memo` on `OrderRow` plus `useCallback` on the row-level handlers passed down from `App`. The cost: with no filter applied, all 5,000 rows are mounted at once, so initial paint carries a real (if evidence-backed, see `evidence/`) cost that virtualization would have avoided. I judged the print requirement as non-negotiable and the initial-mount cost as acceptable for 5,000 rows.

## Three decisions

**Full DOM render instead of `@tanstack/react-virtual`.** Rejected virtualization: it would only be correct if the printed sheet only needed to reflect what a human happened to have scrolled to, which contradicts the stated requirement directly.

**`@tanstack/react-table` v8 instead of v9.** v9 (the version npm installs by default) ships a rewritten, largely undocumented API (`useTable`/`createTableHook`) unsuited to a scoped, time-boxed task. v8's `useReactTable` is stable and well-documented, and headless table logic doesn't benefit from whatever v9 changes. Pinned explicitly.

**`useSyncExternalStore` over `useEffect` for the back-button.** Reading the URL on the initial render is just `window.location.search` at render time — no effect needed. Reacting to the back button needs a `popstate` subscription; `useSyncExternalStore` is the built-in primitive for subscribing a component to a value that lives outside React, so it satisfies the "no useEffect" constraint without hand-rolling the same synchronization an effect would have done anyway. It would only be wrong if `popstate` could fire during render, which it can't.

## Row focus without an effect

Moving focus onto the selected row after arrow-key navigation needs to happen after the DOM commits the new `tabIndex`. Rather than an effect, `OrderRow` uses a callback ref: React calls ref callbacks synchronously during commit, so `el.focus()` runs at the right time without waiting a tick.

## Not finished

No automated tests. The status filter and search combine with `AND` only, no exact/partial toggle. The customer-name generator is a fixed name pool with no i18n beyond the two lists included.
