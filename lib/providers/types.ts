// Provider interface layer for Industry Packs.
// Pack tools resolve concrete adapters via tenant integration_map at runtime.
// See INDUSTRY-PACKS.md → "Provider adapter layer".

export type ProviderCategory = 'calendar' | 'sms' | 'crm' | 'llm' | 'pms'

export interface ProviderHealth {
  healthy: boolean
  message?: string
}

// ─── Calendar ─────────────────────────────────────────────────────────
export interface CalendarSlot {
  start: string // ISO
  end: string
  available: boolean
}

export interface CalendarBookingInput {
  eventTypeId?: string | number
  start: string
  end?: string
  attendeeName: string
  attendeeEmail: string
  attendeePhone?: string
  notes?: string
  metadata?: Record<string, unknown>
}

export interface CalendarBooking {
  id: string
  start: string
  end: string
  status: 'confirmed' | 'pending' | 'cancelled'
  raw?: unknown
}

export interface CalendarProvider {
  readonly slug: string
  listSlots(opts: { eventTypeId?: string | number; date: string }): Promise<CalendarSlot[]>
  bookSlot(input: CalendarBookingInput): Promise<CalendarBooking>
  cancelBooking(id: string, reason?: string): Promise<void>
  rescheduleBooking?(id: string, newStart: string): Promise<CalendarBooking>
  healthCheck(): Promise<ProviderHealth>
}

// ─── SMS ──────────────────────────────────────────────────────────────
export interface SendSMSInput {
  to: string
  body: string
  from?: string
  mediaUrl?: string[]
}

export interface SendSMSResult {
  id: string
  status: string
  raw?: unknown
}

export interface SMSProvider {
  readonly slug: string
  send(input: SendSMSInput): Promise<SendSMSResult>
  healthCheck(): Promise<ProviderHealth>
}

// ─── CRM ──────────────────────────────────────────────────────────────
export interface CRMContact {
  id: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  metadata?: Record<string, unknown>
}

export interface CRMProvider {
  readonly slug: string
  lookupByPhone(phone: string): Promise<CRMContact | null>
  upsertContact(contact: Partial<CRMContact> & { phone: string }): Promise<CRMContact>
  healthCheck(): Promise<ProviderHealth>
}

// ─── LLM ──────────────────────────────────────────────────────────────
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCompletionInput {
  model?: string
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
}

export interface LLMCompletionResult {
  text: string
  model: string
  usage?: { input: number; output: number }
}

export interface LLMProvider {
  readonly slug: string
  complete(input: LLMCompletionInput): Promise<LLMCompletionResult>
  healthCheck(): Promise<ProviderHealth>
}

// ─── PMS (Practice Management System) ─────────────────────────────────
// Used by clinical packs (dental, vet, chiropractic) where the PMS — not
// Cal.com — is the source of truth for scheduling, recall types, and
// patient identity. Generic enough to cover Open Dental, Dentrix,
// ezyVet, etc.

export interface PMSPatient {
  id: string
  firstName?: string
  lastName?: string
  dob?: string
  phone?: string
  email?: string
  status?: 'active' | 'inactive' | 'archived'
  /** Vertical-specific labels — e.g., 'perio_maintenance', 'prophy', 'new_patient' */
  recallType?: string
  /** ISO date of last hygiene/visit */
  lastVisitAt?: string
  /** Months between recall visits, per patient (perio=3-4mo, prophy=6mo) */
  recallIntervalMonths?: number
  metadata?: Record<string, unknown>
}

export interface PMSAppointment {
  id: string
  patientId: string
  providerId?: string
  start: string
  end: string
  appointmentType?: string
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
}

export interface PMSProvider {
  readonly slug: string
  lookupPatientByPhone(phone: string): Promise<PMSPatient | null>
  /** Some PMSes need name+DOB for HIPAA-grade verification */
  lookupPatientByIdentity(input: {
    firstName: string
    lastName: string
    dob: string
  }): Promise<PMSPatient | null>
  listAppointments(patientId: string, opts?: { since?: string }): Promise<PMSAppointment[]>
  createAppointment(input: {
    patientId: string
    providerId?: string
    start: string
    end: string
    appointmentType?: string
    notes?: string
  }): Promise<PMSAppointment>
  cancelAppointment(id: string, reason?: string): Promise<void>
  healthCheck(): Promise<ProviderHealth>
}
