export interface SupportAccount {
  name: string
  org: string
  status: 'locked' | 'active' | 'activation_pending'
  phoneMask: string
}

// Hardcoded demo dataset for the login-page support chatbot's email-lookup step. Intentionally
// not wired to the real Partners/Users tables — this only needs to make the scripted
// troubleshooting flow feel like it's checking a real account.
export const SUPPORT_ACCOUNTS: Record<string, SupportAccount> = {
  'vinothj@aidenai.com': { name: 'Vinoth J', org: 'AidenAI', status: 'active', phoneMask: '•••• 4821' },
  'kiran@aidenai.com': { name: 'Kiran', org: 'AidenAI', status: 'active', phoneMask: '•••• 7734' },
}

export function lookupSupportAccount(email: string): SupportAccount | null {
  return SUPPORT_ACCOUNTS[email.trim().toLowerCase()] ?? null
}
