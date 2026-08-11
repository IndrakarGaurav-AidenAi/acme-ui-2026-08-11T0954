import { Routes } from '@angular/router'
import { authGuard } from './components/auth/auth.guard'
import { requireRole } from './components/auth/RequireRole'
import { ShellComponent } from './components/shell/Shell'
import { LoginComponent } from './screens/login.component'
import { ForbiddenComponent } from './screens/forbidden.component'
import { DocumentViewerComponent } from './screens/document-viewer.component'
import { ReportsComponent } from './screens/reports.component'
import { TemplatesComponent } from './screens/templates.component'
import { DashboardComponent } from './screens/dashboard.component'
import { IntakeInboxComponent } from './screens/intake-inbox.component'
import { IntakeReviewComponent } from './screens/intake-review.component'
import { DocumentAuthenticityComponent } from './screens/document-authenticity.component'
import { LeadsComponent } from './screens/leads.component'
import { DistributorProfileComponent } from './screens/distributor-profile.component'
import { NewApplicationComponent } from './screens/new-application.component'
import { ApprovalsComponent } from './screens/approvals.component'
import { DocumentsComponent } from './screens/documents.component'
import { CommunicationComponent } from './screens/communication.component'
import { GrievancesComponent } from './screens/grievances.component'
import { AnalyticsComponent } from './screens/analytics.component'
import { GtmCoverageComponent } from './screens/gtm-coverage.component'
import { PartnersComponent } from './screens/partners.component'
import { AdminComponent } from './screens/admin.component'
import { MySettingsComponent } from './screens/my-settings.component'
import { AuditLogComponent } from './screens/audit-log.component'

// Mirrors the original App.tsx route table. Every module now has its converted component wired
// in directly — PlaceholderComponent (title/blurb/bullets bound from route `data`) is no longer
// used by any route but is kept around for any future screen still being converted.
//
// '/agents' is deliberately NOT routed here, matching the original App.tsx, which has it
// commented out ("needs a design pass") even though Agents.tsx/agents.component.ts exists.
export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  // No Shell chrome — this is the "View full document" destination, opened in its own tab.
  {
    path: 'document-viewer',
    component: DocumentViewerComponent,
    canActivate: [authGuard],
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'intake-inbox', component: IntakeInboxComponent },
      { path: 'intake/:id', component: IntakeReviewComponent },
      { path: 'document-authenticity', component: DocumentAuthenticityComponent },
      { path: 'leads', component: LeadsComponent },
      {
        // Detail route reachable from within modules (not in the sidebar) — bypasses Shell's
        // module-access guard the same way it did in the original.
        path: 'distributor',
        component: DistributorProfileComponent,
      },
      { path: 'new-application', component: NewApplicationComponent },
      { path: 'approvals', component: ApprovalsComponent },
      { path: 'documents', component: DocumentsComponent },
      { path: 'communication', component: CommunicationComponent },
      { path: 'grievances', component: GrievancesComponent },
      { path: 'analytics', component: AnalyticsComponent },
      { path: 'gtm-coverage', component: GtmCoverageComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'partners', component: PartnersComponent },
      { path: 'templates', component: TemplatesComponent, canActivate: [requireRole(['admin'])] },
      { path: 'settings', component: AdminComponent, canActivate: [requireRole(['admin'])] },
      { path: 'my-settings', component: MySettingsComponent },
      // Audit trail is shared — every persona can read it; only Templates/Settings stay admin-gated.
      { path: 'audit-log', component: AuditLogComponent },
      // Not part of the original route table (Forbidden was rendered in place by RequireRole,
      // never navigated to by URL) — needed now that RequireRole is a redirecting route guard.
      { path: 'forbidden', component: ForbiddenComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
]
