/**
 * Business Context Engine — shared types + brief compressor
 */
import { z } from 'zod'

// ─── BusinessProfile Schema ───

export const BusinessProfileSchema = z.object({
  company_name: z.string(),
  one_sentence_summary: z.string(),
  elevator_pitch: z.string(),
  services: z.array(z.string()),
  industries_served: z.array(z.string()),
  locations_served: z.array(z.string()),
  ideal_customers: z.string(),
  primary_value_prop: z.string(),
  differentiators: z.array(z.string()),
  brand_voice: z.array(z.string()),
  testimonials: z.array(z.string()),
  metrics: z.array(z.string()),
  booking_link: z.string().nullable(),
  contact_methods: z.array(z.string()),
  cta_phrases: z.array(z.string()),
  pricing_found: z.boolean(),
  pain_points_inferred: z.array(z.string()),
  objections_inferred: z.array(z.string()),
  keywords: z.array(z.string()),
  pages_used: z.array(z.string()),
  unknowns: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  last_crawled_at: z.string(),
})

export type BusinessProfile = z.infer<typeof BusinessProfileSchema>

// ─── ContextResponse (compact brief for Vapi) ───

export interface ContextResponse {
  company_name: string
  brief: string
  services_summary: string
  brand_tone: string
  ideal_customers: string
  booking_link: string | null
  key_facts: string[]
}

// ─── CrawlResult ───

export interface CrawlResult {
  url: string
  title: string
  content: string
  status: number
}

// ─── CallOutcome ───

export interface CallOutcome {
  outcome: string
  pain_points_mentioned: string[]
  objections_raised: string[]
  next_step: string
  booking_confirmed: boolean
  follow_up_needed: boolean
  notes: string
}

// ─── Brief Compressor ───

const MAX_BRIEF_WORDS = 600

export function compressToBrief(profile: BusinessProfile): ContextResponse {
  // Build key_facts: top 3 differentiators + top 2 metrics + top 2 pain_points
  const keyFacts: string[] = [
    ...profile.differentiators.slice(0, 3),
    ...profile.metrics.slice(0, 2),
    ...profile.pain_points_inferred.slice(0, 2),
  ].slice(0, 8) // cap at 8

  const servicesSummary = profile.services.join(', ')
  const brandTone = profile.brand_voice.join(', ')

  // Build brief text
  const sections = [
    profile.one_sentence_summary,
    '',
    `Elevator Pitch: ${profile.elevator_pitch}`,
    '',
    `Services: ${servicesSummary}`,
    '',
    `Value Proposition: ${profile.primary_value_prop}`,
    '',
    `Ideal Customers: ${profile.ideal_customers}`,
    '',
    `Differentiators: ${profile.differentiators.join('; ')}`,
    '',
    profile.metrics.length > 0 ? `Key Metrics: ${profile.metrics.join('; ')}` : '',
    '',
    profile.pain_points_inferred.length > 0
      ? `Customer Pain Points: ${profile.pain_points_inferred.join('; ')}`
      : '',
    '',
    profile.objections_inferred.length > 0
      ? `Common Objections: ${profile.objections_inferred.join('; ')}`
      : '',
    '',
    `Brand Voice: ${brandTone}`,
    '',
    profile.booking_link ? `Booking: ${profile.booking_link}` : '',
    profile.contact_methods.length > 0
      ? `Contact: ${profile.contact_methods.join(', ')}`
      : '',
  ]
    .filter(Boolean)

  let brief = sections.join('\n')

  // Enforce word limit
  const words = brief.split(/\s+/)
  if (words.length > MAX_BRIEF_WORDS) {
    brief = words.slice(0, MAX_BRIEF_WORDS).join(' ') + '…'
  }

  return {
    company_name: profile.company_name,
    brief,
    services_summary: servicesSummary,
    brand_tone: brandTone,
    ideal_customers: profile.ideal_customers,
    booking_link: profile.booking_link,
    key_facts: keyFacts,
  }
}
