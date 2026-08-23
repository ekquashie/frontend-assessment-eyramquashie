## Position Applied For
Senior Frontend Developer

## Q1 Answer

**Factually Wrong Parts:**

Firstly, React.memo does not do a deep comparison. This is the critical error. The columns array rebuilding on every render is expected to happen. The main purpose of the error getting caught early is due to shallow comparison.

**Will useMemo Fix It?**

It depends. If we wrap columns in useMemo inside the parent, it could help, but only if the parent doesn't also rebuild on every keystroke. This will affect the dependency array as well and will return a new arrya every time. For the fix to work, the parent must be memoized with useCallback.

**Two Other Things That Defeat React.memo:**

1. Inline functions passed as props: `onClick={() => handleDelete(id)}` - creates a new function every render
2. Object literals passed as props: `style={{ color: blue }}` or `className={{ active: true }}` - new object reference every render

**Actual Cause:**
The parent component re-renders on every search keystroke, and shallow comparison sees the new columns array reference, so memo allows ProductRow to re-render even though the row's data hasn't changed.