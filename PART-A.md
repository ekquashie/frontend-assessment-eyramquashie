## Position Applied For
Senior Frontend Developer

## Q1 Answer

React.memo does a shallow comparison, not deep, that part's wrong. But the rest of the diagnosis holds: a `columns` array rebuilt every render is a new reference even with identical contents, so it correctly fails shallow comparison. memo isn't broken, it's doing its job. The bug is upstream.

useMemo alone won't fix it. It only skips recomputation when its dependencies are stable, and if the parent re-renders every keystroke, those dependencies get recreated too. Fix the parent's re-render frequency instead, move the input's state out, or memoise the parent so its outputs stay stable.

Two other ways to defeat memo here: inline arrow functions as props (`onClick={() => handleDelete(id)}`), and inline object/array literals (`style={{ colour: 'blue' }}`), both new references every render.

Root cause: the parent re-renders on every keystroke, rebuilding `columns` each time, and memo correctly re-renders ProductRow in response.

## Q2 Answer

**The bugs, worst first:**

1. The try/catch is inverted. `await queryFulfilled` is sitting inside the `catch` block instead of the `try` block, so it never actually catches a rejection. If the PATCH request fails, the optimistic update that already flipped the product's status in the cache just stays there. Nothing rolls it back. So an operator marks a product as, say, out of stock, the UI updates immediately, the request fails silently in the background, and the row just keeps showing the wrong status with no error toast, nothing. That's the worst one because it's not a crash or a visible error, it's quietly wrong data that looks correct, and it stays wrong until something else happens to trigger a refetch.

2. The optimistic patch only updates one cache entry, the one for `getProducts` with empty filters. If ops has the table filtered by category or status when they make the change, they won't see their own update reflected until the invalidation-driven refetch comes back. So the same action feels instant on the default view and laggy or broken on any filtered view, which is exactly the kind of "works on my machine" inconsistency that generates support tickets.

3. The try block itself is empty, so structurally this whole thing does nothing until the catch block runs, and per point 1, the catch block never runs on the success path either. It's dead code shaped like error handling.

**The false comment:** `// ignore - the invalidation will refetch anyway` isn't true given how the code is actually written. That comment is only accurate if the catch block reliably runs and does the rollback work, but because `await queryFulfilled` is in the wrong branch, there's no real safety net backing that comment up. It reads as reassuring but describes behaviour the code doesn't have.

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

I removed the `useSupplierName` hook and its local `name` state, reading `data.name` straight from the query. That hook's effect only set `name` when `data?.name` was truthy, it never cleared it back out. So if this component gets reused for a different `supplierId`, say on a re-sort or virtualisation recycling, the old name stays on screen until the new query resolves. That's the actual bug: one row briefly shows another supplier's name. Reading straight from `data` kills that stale window since there's no local state left to go stale.

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
I will reject it.

Virtualisation keeps only the rows near the current scroll position in the DOM, everything else is unmounted. Two things break, both for the warehouse floor worker specifically: Ctrl-F only matches text actually in the DOM, so an order number that's scrolled out of view won't be found even though it's in the filtered list. Ctrl-P prints whatever the browser currently has rendered, not the full dataset, so the sheet that ends up on the clipboard is missing most of the orders. That's not degraded UX, it's a wrong physical document driving warehouse decisions.

Instead I'd leave the DOM full and attack the six seconds directly: virtualise nothing, but cut what's actually slow, paginate or lazy-load the initial fetch so first paint isn't waiting on all 3,000 rows, memoise row rendering properly, and move any per-row computation out of render. If the list itself must stay client-side complete for print and find, the cost of that approach is real, you're still shipping and rendering all 3,000 rows eventually, so the win is bounded to how much of the six seconds was wasted work rather than unavoidable rendering, and it takes more profiling than dropping in a virtualiser.

## Q7 Answer

I'd virtualise the table.

The freeze happens the moment anyone opens the products table, in a 30 minute demo, the supplier will see the app as broken because not being able to do anything for 4 seconds will look weird. The form bug only appears on a validation failure which is unlikely. Shouldn't be a big issue during the demo.

Stays broken: the three forms still silently discard typed input on failure. Someone starting onboarding right after signing can hit that with no warning, mine to fix fast once demo pressure lifts.

To the person who wanted forms fixed first: The form data getting wiped out after validation is a bad bug long-term but a freeze in a room with clients is worse which could lead to losing a deal before the client can even build trust. It's mainly about timing and not severity.

## Q8 Answer

**Conflict 1: Requirement 2 and 3 (Select All vs Confirmation List)**
Cannot both be true: Assuming a user selects 10,000 products, the confirmation cannot display 10,000 SKUs in a dialog. That's too much and will either crash the browser and the UI might end up being unusable.

Decision: I will keep requirement 2 and rather show list count in the dialog

Ticket: "The confirmation will show a "Update 10,000 products?" with a summary instead of individual items.

Business Question: "Is showing the count acceptable or do you need line items?"

---

**Conflict 2: Requirements 4 & 5 (API Batch Limit vs. Atomicity)**

Cannot both be true: If user selects 2500 products and API caps at 500, you need 5 requests. If request 1-3 succeed and request 4 fails, you have partially updated data. This basically violates the "all or nothing" promise.

Decision: Keep Requirement 5. Change Requirement 4.

Ticket: "Backend must support atomic transactions across batches, or frontend must limit selection to 500."

Business question: "Can your API guarantee atomicity across multiple requests, or should we cap user selection at 500?"

---

**Conflict 3: Requirements 5 & 6 (Atomicity vs. Partial Reporting)**

Cannot both be true: If operation is atomic (all succeed or all fail), there's no scenario where some succeed and some fail. A toast saying "500 succeeded, 200 failed" is incompatible with atomicity.

Decision: Keep Requirement 5. Change Requirement 6 to report only "Success: 2000 products updated" or "Failed: a rolled back operation, 0 products updated."

Business question: "When you say you want 'successes and failures,' do you expect partial updates? Or should we treat it as all-or-nothing?"

## Q9 Answer

## Q10 Answer

**Actions in Order (First 60 Minutes):**

**Minutes 0-10:** Stop. Don't panic. SSH into a CI/CD machine or local clone and run `git reflog`. Find the commit hash of the old HEAD before the force push. Note it down. Confirm production branch is untouched.

**Minutes 10-20:** Recover the development branch. Force push the old HEAD back to dev: `git push -f origin HEAD~11`. This restores the 11 commits. Verify the PR branches still exist on developers' local machines (they do—only the remote was wiped).

**Minutes 20-30:** Message the two blocked developers immediately: "Dev branch was accidentally rewound. It's fixed now—pull the latest. If your PR branches disappeared from GitHub, they're still on your machine. Run `git branch -a` and push them back."

**Minutes 30-40:** Interview the developer whose IDE synced. Get specifics: which IDE, what settings, what did they click. Was it VSCode's git sync? GitKraken? Something else?

**Minutes 40-60:** Document what happened. Verify all four PRs are back on remote.

---

**What You Tell the Blocked Developers:**

At minute 10: "Dev branch got force-pushed accidentally. I've recovered it and pushed it back. Pull now. If your PR branches aren't showing on GitHub, they're still local—just push them."

---

**What You Tell the Business Owner:**

At minute 60 (after resolution): "The development branch was accidentally force-pushed this morning by an IDE automation. We recovered it within an hour. No impact to production or shipping. We're implementing branch protection to prevent this happening again."

You do NOT tell them before it's resolved. It's noise until it's fixed, and production is safe.

---

**What Changes Permanently:**

**Require:** Branch protection rules on the development branch. Only allow direct pushes from one release branch or explicitly protected accounts. Force push is disabled. All changes go through PRs.

**Who agrees:** Tech lead + engineering manager. You don't ask the business owner—this is a control.

**Secondary change:** Audit which IDEs or tools developers use for git. If VSCode is auto-syncing in dangerous ways, document the safe settings and send them to the team.

## Q11 Answer
Message to developer: I value your work and how fast you move and the quality of code you ship. 900-line PRs with no tests is a risk we can't take even under deadline pressure. Trying to figure things out or fix bugs when production crashes will take  a lot of time and resources to solve which is slower than splitting now. Splitting PRs now will save us 24 hours of debugging later. Going forward, 400 lines of code will need tests before review. Ansd I am not asking becuase it is how we operate. Could there be a reason why you can't test? Is there a blocker?

Message to business owner: I know shipping faster is the goal but the untested code that was shipped is now in production. If there is a bug that needs to be fixed, we would spend a lot of time trying to fix that bug since no tests were done and it'll be difficult to locate the bug. We would also have to rebuild trust. Test might take a few hours to write but fixing those bugs could take double or triple the amount of time. Our fastest path forward is smaller, tested code. That's the standard here now.

## Q12 Answer

**The Bug:**

I built a product search page that fired an API request on every keystroke, no debouncing. Each character typed triggered a backend query, so a 10-character search meant 10+ requests. It wasn't just slow, it cascaded: the browser froze rendering results mid-flight while users kept typing, which ended up with lots of requests in a queue.

**Discovery:**
Two fronts at once. Users reported the browser freezing while searching, and backend monitoring flagged a spike in requests during peak search hours, traced back to that endpoint. I reproduced it locally and confirmed: keystroke equals request, no throttling.

**Time Live:**
Roughly 3 days before monitoring caught the pattern and escalated.

**What Changed in My Process:**
I stopped assuming "it's just a search input" is safe. Now any input field that triggers a network request is a performance risk until proven otherwise. Before shipping input handlers that call APIs, I ask myself: is this debounced, could a fast typer hammer the backend? I also started checking backend metrics during launches myself, watching the Network tab, rather than waiting for monitoring to flag it.

## Q13 Answer
### Waste Management Admin Dashboard — waste-ms-admin

Internal admin tool for waste collection orgs: manages customers, collection schedules, invoicing, payments, areas, and staff roles/permissions. Used daily by org admins and dispatch staff. I built and deployed both ends solo, Spring Boot backend, Next.js frontend, so there was no formal contract negotiation, just fast iteration between API and UI. The hardest part was reconciling recurring collection schedules (day/week/month cadences) with real calendar dates and billing periods without drifting out of sync.

### WhatPay - Trading platform for Buyers and Suppliers

A dashboard widget for buyers/suppliers on a trade-escrow platform, surfacing what needs action: pending KYB verification, missing payout destinations, orders awaiting confirmation, open disputes, and failed payouts. Used by every merchant on login.

I built and deployed both the Next.js frontend and the Spring Boot backend/API myself, so the "contract" was just internal consistency between the two as I built.

Hardest part: coordinating 7 independent, conditionally-enabled queries (gated by verification/role state) into one coherent loading/error/empty state, without showing a false "all caught up" while data was still loading or partially failed.