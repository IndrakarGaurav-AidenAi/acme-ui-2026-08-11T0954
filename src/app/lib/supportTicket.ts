export interface TranscriptMessage {
  role: 'bot' | 'user'
  text: string
}

export interface SupportTicketRequest {
  name: string
  email: string
  phone: string
  issueSummary: string
  scenario: string
  transcript: TranscriptMessage[]
}

export interface SupportTicketResponse {
  ticketNumber: string
  priority: string
  targetResponse: string
  assignedTeam: string
}
