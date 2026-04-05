/**
 * LocalReach V3 — Offer Matching Engine
 * Scores and ranks offers against business research data.
 */
import type { BusinessResearch, LocalReachOffer, OfferMatch } from './types'

// ─── Scoring weights ───

const NICHE_TAG_MATCH_SCORE = 3
const PAIN_POINT_MATCH_SCORE = 2
const SERVICE_RELEVANCE_SCORE = 1

// ─── Pain point → offer keyword mapping ───

const PAIN_POINT_KEYWORDS: Record<string, string[]> = {
  'missed-call-text-back': ['missed call', 'unanswered', 'voicemail', 'after hours', 'missed leads', 'phone tag'],
  'ai-receptionist': ['receptionist', 'front desk', 'phone answering', 'hold time', 'call volume', 'staffing'],
  'review-generation': ['reviews', 'reputation', 'google reviews', 'yelp reviews', 'online reputation', 'star rating'],
  'appointment-booking-ai': ['scheduling', 'appointment', 'booking', 'no-show', 'calendar', 'double-booked'],
  'no-show-reduction': ['no-show', 'cancellation', 'missed appointment', 'reminder', 'confirmation'],
  'quote-follow-up-ai': ['quote', 'estimate', 'follow up', 'proposal', 'bid', 'close rate'],
  'ai-outbound-caller': ['outbound', 'cold call', 'prospecting', 'lead gen', 'outreach'],
  'crm-cleanup-reactivation': ['crm', 'dead leads', 'database', 'reactivation', 'old contacts', 'dormant'],
  'website-chat-to-book': ['website', 'chat', 'visitor', 'conversion', 'bounce rate', 'online booking'],
  'lead-intake-automation': ['intake', 'qualify', 'routing', 'lead form', 'screening', 'triage'],
  '24-7-support-agent': ['support', 'customer service', 'ticket', 'helpdesk', 'after hours support', 'response time'],
  'monthly-retainer-bundle': ['automation', 'all-in-one', 'multiple', 'comprehensive', 'full service'],
}

// ─── Service relevance keywords ───

const SERVICE_KEYWORDS: Record<string, string[]> = {
  'missed-call-text-back': ['phone', 'call', 'text', 'sms'],
  'ai-receptionist': ['phone', 'reception', 'office', 'clinic'],
  'review-generation': ['review', 'feedback', 'testimonial'],
  'appointment-booking-ai': ['appointment', 'booking', 'schedule', 'calendar'],
  'no-show-reduction': ['appointment', 'booking', 'schedule'],
  'quote-follow-up-ai': ['estimate', 'quote', 'service call', 'job'],
  'ai-outbound-caller': ['sales', 'outbound', 'prospecting'],
  'crm-cleanup-reactivation': ['crm', 'database', 'contact', 'client list'],
  'website-chat-to-book': ['website', 'online', 'web', 'digital'],
  'lead-intake-automation': ['lead', 'intake', 'form', 'inquiry'],
  '24-7-support-agent': ['support', 'service', 'help', 'customer'],
  'monthly-retainer-bundle': ['business', 'automation', 'growth'],
}

/**
 * Score a single offer against business research
 */
function scoreOffer(research: BusinessResearch, offer: LocalReachOffer): OfferMatch {
  let score = 0
  const matchReasons: string[] = []

  // 1. Niche tag match (+3 per matching tag)
  const researchTags = (research.recommended_offers || []).map((t) => t.toLowerCase())
  for (const tag of offer.niche_tags) {
    if (tag === 'all') {
      score += NICHE_TAG_MATCH_SCORE
      matchReasons.push(`Universal offer (all niches)`)
      break
    }
    // Check if any research tag contains the offer tag or vice versa
    const tagLower = tag.toLowerCase()
    if (researchTags.some((rt) => rt.includes(tagLower) || tagLower.includes(rt))) {
      score += NICHE_TAG_MATCH_SCORE
      matchReasons.push(`Niche match: ${tag}`)
    }
  }

  // 2. Pain point match (+2 per matching pain point)
  const painPoints = (research.pain_points || []).map((p) => p.toLowerCase())
  const offerPainKeywords = PAIN_POINT_KEYWORDS[offer.slug] || []

  for (const keyword of offerPainKeywords) {
    const keywordLower = keyword.toLowerCase()
    if (painPoints.some((pp) => pp.includes(keywordLower))) {
      score += PAIN_POINT_MATCH_SCORE
      matchReasons.push(`Pain point match: "${keyword}"`)
      break // Only count once per offer
    }
  }

  // Also check pain points in the summary
  if (research.summary) {
    const summaryLower = research.summary.toLowerCase()
    for (const keyword of offerPainKeywords) {
      if (summaryLower.includes(keyword.toLowerCase())) {
        score += 1 // Weaker signal from summary
        matchReasons.push(`Summary mentions: "${keyword}"`)
        break
      }
    }
  }

  // 3. Service relevance (+1 per matching service keyword)
  const services = (research.services || []).map((s) => s.toLowerCase())
  const offerServiceKeywords = SERVICE_KEYWORDS[offer.slug] || []

  for (const keyword of offerServiceKeywords) {
    const keywordLower = keyword.toLowerCase()
    if (services.some((svc) => svc.includes(keywordLower))) {
      score += SERVICE_RELEVANCE_SCORE
      matchReasons.push(`Service relevance: "${keyword}"`)
      break
    }
  }

  // 4. Negative signals — reduce score if business already has the capability
  if (offer.slug === 'website-chat-to-book' && research.has_chat_widget) {
    score -= 2
    matchReasons.push('Already has chat widget (-2)')
  }
  if (offer.slug === 'review-generation' && research.has_reviews_system) {
    score -= 1
    matchReasons.push('Already has review system (-1)')
  }
  if (offer.slug === 'appointment-booking-ai' && research.has_online_booking) {
    score -= 1
    matchReasons.push('Already has online booking (-1)')
  }

  return {
    offer,
    score: Math.max(score, 0),
    match_reasons: matchReasons,
  }
}

/**
 * Match and rank offers against business research.
 * Returns top 3 offers sorted by score descending.
 */
export function matchOffers(
  research: BusinessResearch,
  offers: LocalReachOffer[]
): OfferMatch[] {
  const activeOffers = offers.filter((o) => o.active)

  const scored = activeOffers.map((offer) => scoreOffer(research, offer))

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

/**
 * Returns the 12 seed offers with real data.
 */
export function getDefaultOffers(): LocalReachOffer[] {
  const now = new Date().toISOString()

  return [
    {
      id: 'offer_missed_call_text_back',
      name: 'Missed-Call Text-Back',
      slug: 'missed-call-text-back',
      description: 'Automatically sends a text message to any caller you miss, capturing the lead before they call a competitor.',
      niche_tags: ['all'],
      price_cents: 29700,
      billing_interval: 'monthly',
      discount_threshold_percent: 15,
      elevator_pitch: 'Never miss a lead again. When you can\'t answer the phone, our AI instantly texts the caller back within 30 seconds so they stay engaged instead of calling the next business on Google.',
      features: [
        'Instant SMS reply within 30 seconds of missed call',
        'Customizable text templates per time of day',
        'Lead capture and CRM integration',
        'After-hours auto-response',
        'Call-back scheduling link in SMS',
        'Real-time notifications to your phone',
      ],
      stripe_price_id: 'price_missed_call_text_back_297',
      active: true,
      sort_order: 1,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_ai_receptionist',
      name: 'AI Receptionist',
      slug: 'ai-receptionist',
      description: 'A 24/7 AI-powered phone receptionist that answers calls, books appointments, and routes inquiries — no hold music, no missed calls.',
      niche_tags: ['dental', 'medical', 'legal', 'salon'],
      price_cents: 49700,
      billing_interval: 'monthly',
      discount_threshold_percent: 10,
      elevator_pitch: '24/7 phone answering that sounds human. Your AI receptionist picks up every call, answers common questions, books appointments, and only transfers to your staff when it truly needs a human touch.',
      features: [
        '24/7 live call answering by AI',
        'Natural-sounding voice with custom personality',
        'Appointment booking directly into your calendar',
        'FAQ handling from your knowledge base',
        'Warm transfer to staff with context summary',
        'HIPAA-compliant for medical/dental offices',
        'Multi-language support',
        'Call recording and transcript access',
      ],
      stripe_price_id: 'price_ai_receptionist_497',
      active: true,
      sort_order: 2,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_review_generation',
      name: 'Review Generation System',
      slug: 'review-generation',
      description: 'Automated review request sequences via SMS and email after every service, driving your Google rating up consistently.',
      niche_tags: ['all'],
      price_cents: 19700,
      billing_interval: 'monthly',
      discount_threshold_percent: 20,
      elevator_pitch: 'Automated review requests that actually work. After every appointment or service, your customers get a friendly text with a direct link to leave a Google review. Most businesses see a 3x increase in review volume within 60 days.',
      features: [
        'Automated post-service SMS review requests',
        'Email follow-up sequences',
        'Direct links to Google, Yelp, Facebook review pages',
        'Negative review interception and private feedback routing',
        'Review monitoring dashboard',
        'Weekly reputation report',
      ],
      stripe_price_id: 'price_review_generation_197',
      active: true,
      sort_order: 3,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_appointment_booking_ai',
      name: 'Appointment Booking AI',
      slug: 'appointment-booking-ai',
      description: 'AI handles appointment scheduling via phone and text, syncing directly to your calendar with zero back-and-forth.',
      niche_tags: ['dental', 'medical', 'salon', 'spa', 'fitness'],
      price_cents: 39700,
      billing_interval: 'monthly',
      discount_threshold_percent: 15,
      elevator_pitch: 'Let AI handle scheduling so your staff can focus on patients. Our booking AI answers calls, checks real-time availability, and books appointments directly into your calendar — no more phone tag or double-bookings.',
      features: [
        'AI-powered phone and SMS scheduling',
        'Real-time calendar sync (Google, Outlook, custom)',
        'Intelligent slot optimization to reduce gaps',
        'Automatic confirmation and reminder sequences',
        'Rescheduling and cancellation handling',
        'New patient intake form collection',
        'Insurance verification pre-check',
      ],
      stripe_price_id: 'price_appointment_booking_397',
      active: true,
      sort_order: 4,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_no_show_reduction',
      name: 'No-Show Reduction System',
      slug: 'no-show-reduction',
      description: 'Multi-touch confirmation and reminder sequences that reduce appointment no-shows by up to 60%.',
      niche_tags: ['dental', 'medical', 'salon', 'fitness'],
      price_cents: 24700,
      billing_interval: 'monthly',
      discount_threshold_percent: 15,
      elevator_pitch: 'Reduce no-shows by 60% with intelligent reminder sequences. Your patients get a text 48 hours before, a call 24 hours before, and a final confirmation 2 hours before — with easy one-tap rescheduling if they can\'t make it.',
      features: [
        'Multi-channel reminders (SMS, call, email)',
        'Configurable reminder timing sequences',
        'One-tap confirm or reschedule',
        'Waitlist auto-fill for cancelled slots',
        'No-show tracking and reporting',
        'Deposit collection for repeat offenders',
      ],
      stripe_price_id: 'price_no_show_reduction_247',
      active: true,
      sort_order: 5,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_quote_follow_up_ai',
      name: 'Quote Follow-Up AI',
      slug: 'quote-follow-up-ai',
      description: 'AI automatically follows up on every quote and estimate you send, nurturing leads until they convert or decline.',
      niche_tags: ['hvac', 'roofing', 'plumbing', 'electrical', 'landscaping'],
      price_cents: 34700,
      billing_interval: 'monthly',
      discount_threshold_percent: 15,
      elevator_pitch: 'Automatically follow up on every quote you send. Most home service businesses lose 40% of jobs because they never follow up. Our AI calls and texts each prospect on a smart schedule until they book or say no — so you close more jobs without chasing.',
      features: [
        'Automated follow-up calls and texts after quote delivery',
        'Smart timing based on job type and urgency',
        'Objection handling with trained responses',
        'Price anchoring and urgency creation',
        'Direct booking link for approved quotes',
        'CRM integration for pipeline tracking',
        'Win/loss analytics dashboard',
      ],
      stripe_price_id: 'price_quote_follow_up_347',
      active: true,
      sort_order: 6,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_ai_outbound_caller',
      name: 'AI Outbound Caller',
      slug: 'ai-outbound-caller',
      description: 'AI makes outbound calls to your leads, past customers, and prospects — qualifying, nurturing, and booking on autopilot.',
      niche_tags: ['all'],
      price_cents: 59700,
      billing_interval: 'monthly',
      discount_threshold_percent: 10,
      elevator_pitch: 'AI makes outbound calls for you. Upload a list or connect your CRM, and our AI caller reaches out to each lead with a natural conversation — qualifying interest, overcoming objections, and booking meetings directly on your calendar.',
      features: [
        'AI-powered outbound calling at scale',
        'Natural conversation with dynamic scripting',
        'Lead qualification and scoring',
        'Calendar booking during the call',
        'Voicemail drop with callback tracking',
        'CRM auto-update after each call',
        'A/B testing on scripts and timing',
        'Compliance-first with DNC list checking',
      ],
      stripe_price_id: 'price_ai_outbound_caller_597',
      active: true,
      sort_order: 7,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_crm_cleanup_reactivation',
      name: 'CRM Cleanup & Reactivation',
      slug: 'crm-cleanup-reactivation',
      description: 'One-time deep clean of your contact database plus AI-powered reactivation campaign to wake up dormant leads.',
      niche_tags: ['all'],
      price_cents: 49700,
      billing_interval: 'one_time',
      discount_threshold_percent: 20,
      elevator_pitch: 'Reactivate dead leads sitting in your CRM. We clean up your database, identify your warmest dormant contacts, then run an AI-powered reactivation campaign via call and text. Most businesses recover 10-15% of lost leads within 30 days.',
      features: [
        'Full CRM database audit and deduplication',
        'Contact scoring based on engagement history',
        'AI-powered reactivation call campaign',
        'SMS re-engagement sequences',
        'Win-back offer creation and delivery',
        'Detailed reactivation report with ROI metrics',
      ],
      stripe_price_id: 'price_crm_cleanup_497_once',
      active: true,
      sort_order: 8,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_website_chat_to_book',
      name: 'Website Chat-to-Book',
      slug: 'website-chat-to-book',
      description: 'AI chat widget on your website that engages visitors, answers questions, and books appointments in real-time.',
      niche_tags: ['dental', 'medical', 'legal', 'real_estate'],
      price_cents: 29700,
      billing_interval: 'monthly',
      discount_threshold_percent: 15,
      elevator_pitch: 'Convert website visitors into booked appointments. Our AI chat widget engages every visitor, answers their questions using your knowledge base, and books them directly into your calendar — turning your website into a 24/7 booking machine.',
      features: [
        'AI chat widget with custom branding',
        'Knowledge base powered responses',
        'Real-time appointment booking',
        'Lead capture for non-booking visitors',
        'After-hours mode with smart follow-up',
        'Multi-page tracking and engagement triggers',
        'Mobile-optimized design',
      ],
      stripe_price_id: 'price_website_chat_297',
      active: true,
      sort_order: 9,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_lead_intake_automation',
      name: 'Lead Intake Automation',
      slug: 'lead-intake-automation',
      description: 'AI qualifies and routes inbound leads from all channels — phone, web, email — to the right team member instantly.',
      niche_tags: ['legal', 'insurance', 'real_estate'],
      price_cents: 39700,
      billing_interval: 'monthly',
      discount_threshold_percent: 15,
      elevator_pitch: 'Qualify and route leads automatically. When a potential client calls or fills out a form, our AI runs them through your intake questions, scores their fit, and routes qualified leads to the right person on your team — in real-time.',
      features: [
        'Multi-channel lead capture (phone, web, email)',
        'Custom qualification questionnaire',
        'AI-powered lead scoring',
        'Automatic routing based on case type, location, urgency',
        'Conflict of interest pre-screening',
        'Intake form auto-population',
        'Real-time notification to assigned team member',
        'Integration with practice management software',
      ],
      stripe_price_id: 'price_lead_intake_397',
      active: true,
      sort_order: 10,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_24_7_support_agent',
      name: '24/7 Support Agent',
      slug: '24-7-support-agent',
      description: 'Always-on AI customer support agent that handles inquiries, troubleshoots issues, and escalates when needed.',
      niche_tags: ['saas', 'ecommerce', 'all'],
      price_cents: 69700,
      billing_interval: 'monthly',
      discount_threshold_percent: 10,
      elevator_pitch: 'Always-on customer support that never sleeps. Your AI support agent handles common questions, troubleshoots issues, processes returns, and only escalates to your team when a human touch is truly needed — cutting support costs by 40%.',
      features: [
        '24/7 AI-powered support via phone and chat',
        'Knowledge base integration with auto-learning',
        'Ticket creation and tracking',
        'Smart escalation to human agents with full context',
        'Order status and return processing',
        'Multi-language support',
        'CSAT survey after resolution',
        'Analytics dashboard with resolution metrics',
      ],
      stripe_price_id: 'price_24_7_support_697',
      active: true,
      sort_order: 11,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'offer_monthly_retainer_bundle',
      name: 'Monthly Retainer Bundle',
      slug: 'monthly-retainer-bundle',
      description: 'All-in-one AI automation package combining receptionist, booking, reviews, and follow-up into a single retainer.',
      niche_tags: ['all'],
      price_cents: 149700,
      billing_interval: 'monthly',
      discount_threshold_percent: 12,
      elevator_pitch: 'All-in-one AI automation for your entire business. Get our AI receptionist, appointment booking, review generation, missed-call text-back, and follow-up system bundled into one retainer — saving you over $500/month compared to buying each separately.',
      features: [
        'AI Receptionist (24/7 phone answering)',
        'Appointment Booking AI',
        'Review Generation System',
        'Missed-Call Text-Back',
        'Quote/Lead Follow-Up Sequences',
        'Monthly performance report',
        'Dedicated account manager',
        'Priority support',
        'Custom integrations',
        'Quarterly strategy review call',
      ],
      stripe_price_id: 'price_retainer_bundle_1497',
      active: true,
      sort_order: 12,
      created_at: now,
      updated_at: now,
    },
  ]
}
