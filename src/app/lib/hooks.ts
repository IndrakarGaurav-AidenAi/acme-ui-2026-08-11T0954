import { signal } from '@angular/core'

/** Toggleable selection set — reused by bulk-select tables, expandable lists, etc. */
export function useToggleSet<T>(initial: T[] = []) {
  const items = signal<T[]>(initial)
  const has = (v: T) => items().includes(v)
  const toggle = (v: T) => items.update((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))
  const clear = () => items.set([])
  return { items, has, toggle, clear }
}

/** Single-open accordion / drill selection. */
export function useSingleOpen<T>(initial: T | null = null) {
  const open = signal<T | null>(initial)
  const toggle = (v: T) => open.update((cur) => (cur === v ? null : v))
  const isOpen = (v: T) => open() === v
  return { open, toggle, isOpen }
}
