/**
 * LocalReach V3 — TypeScript types
 * Matches all localreach_* Supabase tables
 */

// ─── Core Business ───

export interface LocalReachBusiness {
  id: string
  campaign_id: string
  name: string
  phone: string
  phone_e164: string
  email: string | null
  website: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  latitude: number | null
  longitude: number | null
  niche: string
  niche_tags: string[]
  google_place_id: string | null
  google_rating: number | null
  google_review_count: number | null
  source: 'google_places' | 'yelp' | 'manual' | 'csv_import' | 'api'
  status: 'new' | 'enriched' | 'queued' | 'called' | 'converted' | 'suppressed' | 'dnc'
  call_attempts: number
  last_called_at: string | null
  next_call_after: string | null
  assigned_offer_id: string | null
  ring_index: number
  created_at: string
  updated_at: string
}

// ─── Business Research (enrichment output) ───

export interface BusinessResearch {
  id: string
  business_id: string
  website_url: string | null
  crawl_status: 'pending' | 'crawling' | 'done' | 'failed'
  crawl_completed_at: string | null
  page_count: number
  raw_text: string | null
  summary: string | null
  services: string[]
  pain_points: string[]
  tech_stack: string[]
  employee_count_estimate: string | null
  revenue_estimate: string | null
  has_online_booking: boolean
  has_chat_widget: boolean
  has_reviews_system: boolean
  social_profiles: Record<string, string>
  competitive_landscape: string | null
  recommended_offers: string[]
  analysis_model: string | null
  analysis_tokens_used: number
  created_at: string
  updated_at: string
}

// ─── Offers ───

export interface LocalReachOffer {
  id: string
  name: string
  slug: string
  description: string
  niche_tags: string[]
  price_cents: number
  billing_interval: 'monthly' | 'one_time' | 'annual'
  discount_threshold_percent: number
  elevator_pitch: string
  features: string[]
  stripe_price_id: string
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

// ─── Campaigns ───

export interface LocalReachCampaign {
  id: string
  name: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  center_lat: number
  center_lng: number
  center_address: string
  current_ring_index: number
  niche_filter: string[]
  daily_call_quota: number
  calls_today: number
  total_calls: number
  total_conversions: number
  total_revenue_cents: number
  vapi_assistant_id: string | null
  vapi_phone_number_id: string | null
  calendly_event_url: string | null
  stripe_account_id: string | null
  timezone: string
  calling_hours_start: number
  calling_hours_end: number
  owner_id: string | null
  created_at: string
  updated_at: string
}

// ─── Call Attempts ───

export interface CallAttempt {
  id: string
  campaign_id: string
  business_id: string
  offer_id: string | null
  vapi_call_id: string | null
  phone_dialed: string
  status: 'initiated' | 'ringing' | 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'failed' | 'completed'
  outcome: 'no_answer' | 'voicemail_left' | 'callback_requested' | 'interested' | 'objection' | 'booked' | 'converted' | 'not_interested' | 'wrong_number' | 'dnc_requested' | null
  duration_seconds: number | null
  recording_url: string | null
  transcript: string | null
  sentiment_score: number | null
  objections_encountered: string[]
  sms_sent: boolean
  sms_content: string | null
  compliance_checks_passed: boolean
  ring_index: number
  attempt_number: number
  cost_cents: number | null
  created_at: string
  updated_at: string
}

// ─── Objections ───

export interface Objection {
  id: string
  campaign_id: string | null
  category: string
  trigger_phrase: string
  response_script: string
  success_rate: number
  times_used: number
  times_succeeded: number
  active: boolean
  created_at: string
  updated_at: string
}

// ─── Conversions ───

export interface Conversion {
  id: string
  campaign_id: string
  business_id: string
  call_attempt_id: string | null
  offer_id: string
  conversion_type: 'booking' | 'payment' | 'trial' | 'demo'
  calendly_event_id: string | null
  stripe_payment_intent_id: string | null
  stripe_checkout_url: string | null
  amount_cents: number
  discount_applied_percent: number
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded'
  follow_up_scheduled: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Compliance ───

export interface ComplianceEvent {
  id: string
  business_id: string | null
  phone: string
  event_type: 'call_allowed' | 'call_blocked' | 'dnc_added' | 'dnc_removed' | 'suppression_hit' | 'hours_violation' | 'b2b_check_failed'
  reason: string
  details: Record<string, unknown> | null
  created_at: string
}

export interface SuppressionEntry {
  id: string
  phone_e164: string
  business_id: string | null
  reason: 'dnc_requested' | 'converted' | 'wrong_number' | 'complaint' | 'manual'
  suppressed_until: string
  created_at: string
}

// ─── Niche Schedule ───

export interface NicheScheduleEntry {
  id: string
  campaign_id: string
  niche: string
  day_of_week: number
  preferred_hour_start: number
  preferred_hour_end: number
  priority: number
  active: boolean
  created_at: string
}

// ─── Geo Coverage ───

export interface GeoCoverage {
  id: string
  campaign_id: string
  ring_index: number
  inner_radius_miles: number
  outer_radius_miles: number
  quarter: string
  businesses_found: number
  businesses_called: number
  businesses_converted: number
  status: 'pending' | 'active' | 'completed' | 'skipped'
  started_at: string | null
  completed_at: string | null
  created_at: string
}

// ─── Utility Types ───

export interface GeoSpiralRing {
  inner: number
  outer: number
}

export interface CampaignStats {
  campaign_id: string
  total_businesses: number
  businesses_enriched: number
  businesses_called: number
  businesses_converted: number
  total_calls: number
  calls_today: number
  answer_rate: number
  conversion_rate: number
  total_revenue_cents: number
  avg_call_duration_seconds: number
  top_objections: Array<{ category: string; count: number }>
  ring_breakdown: Array<{
    ring_index: number
    businesses: number
    called: number
    converted: number
  }>
}

export interface ComplianceCheck {
  check: string
  passed: boolean
  reason: string
}

export interface ComplianceResult {
  allowed: boolean
  reason: string
  checks: ComplianceCheck[]
}

export interface CalendlySlot {
  start_time: string
  end_time: string
  status: 'available'
}

export interface OfferMatch {
  offer: LocalReachOffer
  score: number
  match_reasons: string[]
}
