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