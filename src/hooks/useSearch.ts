import { useState, useEffect } from 'react'

/**
 * useSearch — controlled search input with 300 ms debounce.
 *
 * Returns:
 *   value          — the live input value (bind to <input>)
 *   debouncedQuery — the debounced string to pass to filter logic
 *   setValue       — setter (use as onChange handler value)
 *   clear          — resets both value and debounced query immediately
 */
export function useSearch(initial = '') {
  const [value, setValue] = useState(initial)
  const [debouncedQuery, setDebouncedQuery] = useState(initial)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(value.trim()), 300)
    return () => clearTimeout(id)
  }, [value])

  function clear() {
    setValue('')
    setDebouncedQuery('')
  }

  return { value, setValue, debouncedQuery, clear }
}
