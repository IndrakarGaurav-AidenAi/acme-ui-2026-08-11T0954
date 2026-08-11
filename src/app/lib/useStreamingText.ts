import { effect, signal } from '@angular/core'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export interface StreamingTextOptions {
  speed?: number
  chunk?: number
  start?: boolean
}

/**
 * Streams `full()` text token-by-token to create a "typing" agent effect.
 * Honors prefers-reduced-motion (renders instantly). Deterministic — no randomness.
 *
 * Must be called from an injection context (a component/directive constructor or field
 * initializer) — it registers an `effect()` that re-streams whenever `full()`/`opts()` change.
 *
 * @param full     function returning the complete text to reveal
 * @param opts     function returning { speed: ms per chunk (default 18), chunk: chars per tick (default 2), start: begin streaming when true (default true) }
 */
export function useStreamingText(full: () => string, opts: () => StreamingTextOptions = () => ({})) {
  const text = signal('')
  const done = signal(false)

  effect((onCleanup) => {
    const value = full()
    const { speed = 18, chunk = 2, start = true } = opts()

    text.set('')
    done.set(false)
    if (!start) return

    if (prefersReducedMotion()) {
      text.set(value)
      done.set(true)
      return
    }

    let i = 0
    const timer = setInterval(() => {
      i += chunk
      if (i >= value.length) {
        text.set(value)
        done.set(true)
        clearInterval(timer)
      } else {
        text.set(value.slice(0, i))
      }
    }, speed)

    onCleanup(() => clearInterval(timer))
  })

  return { text, done }
}
