import { inject } from '@angular/core'
import { Router, type CanActivateFn } from '@angular/router'
import type { RoleCode } from '../../types'
import { AppStore } from '../../store'

// Frontend-only RBAC: blocks a route to specific logged-in roles, even if the user reaches the
// URL directly (nav already hides it, but the URL itself must be gated too — otherwise any
// authenticated user could type it in).
//
// The original React version rendered <Forbidden/> in place, at the same URL, since it was a
// wrapper component around the routed element rather than a router-level guard. As an Angular
// route guard this redirects to /forbidden instead (the URL changes) — the idiomatic Angular
// equivalent, and the one deliberate behavior difference from the original in this conversion.
export function requireRole(allow: RoleCode[]): CanActivateFn {
  return () => {
    const store = inject(AppStore)
    const router = inject(Router)
    const roleCode = store.roleCode()
    if (!roleCode || !allow.includes(roleCode)) {
      return router.parseUrl('/forbidden')
    }
    return true
  }
}
