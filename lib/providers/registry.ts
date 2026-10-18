// Provider registry. Resolves a concrete adapter for a given category
// using the tenant's integration_map (from tenant_pack_installs).
//
// Usage:
//   const cal = resolveCalendar({ calendar: 'cal_com' })
//   await cal.bookSlot({ ... })

import type {
  CalendarProvider,
  SMSProvider,
  CRMProvider,
  LLMProvider,
  PMSProvider,
  ProviderCategory,
} from './types'
import { CalComCalendar } from './calendar-calcom'
import { CalendlyCalendar } from './calendar-calendly'
import { BooksyCalendar } from './calendar-booksy'
import { ServiceTitanCalendar } from './calendar-servicetitan'
import { OpenTableCalendar } from './calendar-opentable'
import { OpenDentalPMS } from './pms-open-dental'
import { ClioPMS } from './pms-clio'
import { TwilioSMS } from './sms-twilio'
import { SupabaseCRM } from './crm-supabase'
import { VinSolutionsCRM } from './crm-vinsolutions'
import { AnthropicLLM } from './llm-anthropic'

export type IntegrationMap = Partial<Record<ProviderCategory, string>>
export type ProviderCredentials = Record<string, string>

type Factory<T> = (credentials?: ProviderCredentials) => T

const calendarFactories: Record<string, Factory<CalendarProvider>> = {
  cal_com: () => new CalComCalendar(),
  calendly: () => new CalendlyCalendar(),
  booksy: () => new BooksyCalendar(),
  servicetitan: () => new ServiceTitanCalendar(),
  opentable: () => new OpenTableCalendar(),
}

const smsFactories: Record<string, Factory<SMSProvider>> = {
  twilio: () => new TwilioSMS(),
}

const crmFactories: Record<string, Factory<CRMProvider>> = {
  supabase: () => new SupabaseCRM(),
  vinsolutions: creds => new VinSolutionsCRM(creds),
}

const llmFactories: Record<string, Factory<LLMProvider>> = {
  anthropic: () => new AnthropicLLM(),
}

const pmsFactories: Record<string, Factory<PMSProvider>> = {
  open_dental: creds => new OpenDentalPMS(creds),
  clio: creds => new ClioPMS(creds),
}

const FALLBACKS: Record<ProviderCategory, string> = {
  calendar: 'cal_com',
  sms: 'twilio',
  crm: 'supabase',
  llm: 'anthropic',
  pms: 'open_dental',
}

function resolve<T>(
  category: ProviderCategory,
  factories: Record<string, Factory<T>>,
  map?: IntegrationMap,
  credentials?: ProviderCredentials,
): T {
  const slug = map?.[category] ?? FALLBACKS[category]
  const factory = factories[slug]
  if (!factory) {
    throw new Error(`No ${category} provider registered for slug "${slug}"`)
  }
  return factory(credentials)
}

export function resolveCalendar(map?: IntegrationMap, creds?: ProviderCredentials): CalendarProvider {
  return resolve('calendar', calendarFactories, map, creds)
}

export function resolveSMS(map?: IntegrationMap, creds?: ProviderCredentials): SMSProvider {
  return resolve('sms', smsFactories, map, creds)
}

export function resolveCRM(map?: IntegrationMap, creds?: ProviderCredentials): CRMProvider {
  return resolve('crm', crmFactories, map, creds)
}

export function resolveLLM(map?: IntegrationMap, creds?: ProviderCredentials): LLMProvider {
  return resolve('llm', llmFactories, map, creds)
}

export function resolvePMS(map?: IntegrationMap, creds?: ProviderCredentials): PMSProvider {
  return resolve('pms', pmsFactories, map, creds)
}

// Allow new pack adapters to register themselves at module init.
export function registerCalendarProvider(slug: string, factory: Factory<CalendarProvider>) {
  calendarFactories[slug] = factory
}
export function registerSMSProvider(slug: string, factory: Factory<SMSProvider>) {
  smsFactories[slug] = factory
}
export function registerCRMProvider(slug: string, factory: Factory<CRMProvider>) {
  crmFactories[slug] = factory
}
export function registerLLMProvider(slug: string, factory: Factory<LLMProvider>) {
  llmFactories[slug] = factory
}
export function registerPMSProvider(slug: string, factory: Factory<PMSProvider>) {
  pmsFactories[slug] = factory
}

export function listRegistered(): Record<ProviderCategory, string[]> {
  return {
    calendar: Object.keys(calendarFactories),
    sms: Object.keys(smsFactories),
    crm: Object.keys(crmFactories),
    llm: Object.keys(llmFactories),
    pms: Object.keys(pmsFactories),
  }
}
