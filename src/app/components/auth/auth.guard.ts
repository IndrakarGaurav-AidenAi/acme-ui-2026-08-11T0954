import { inject } from '@angular/core'
import { toObservable } from '@angular/core/rxjs-interop'
import { Router, type CanActivateFn } from '@angular/router'
import { filter, map, take } from 'rxjs'
import { AppStore } from '../../store'

// Replaces the original App.tsx's inline `RequireAuth` + `useHydrated`. The session is
// rehydrated from the local server / localStorage asynchronously (see AppStore.hydrate()), so
// roleCode is briefly unset on every hard page load — even for an already-logged-in user.
// Without this gate, a refresh on any route would bounce straight to /login before that async
// read resolves. Waits for AppStore's `hydrated` signal before deciding.
export const authGuard: CanActivateFn = () => {
  const store = inject(AppStore)
  const router = inject(Router)

  return toObservable(store.hydrated).pipe(
    filter((hydrated) => hydrated),
    take(1),
    map(() => (store.roleCode() ? true : router.parseUrl('/login'))),
  )
}
