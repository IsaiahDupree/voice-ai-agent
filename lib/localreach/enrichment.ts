/**
 * LocalReach V3 — Business Enrichment Engine
 * Crawls business websites, analyzes with Claude, and saves structured research.
 */
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../supabase'
import { crawlDomain } from '../crawler'
import type { BusinessResearch, LocalReachBusiness } from './types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const ANALYSIS_MODEL = 'claude-sonnet-4-6'
const MAX_CRAWL_PAGES = 10
const MAX_TEXT_LENGTH = 30000

/**
 * Enrich a business by crawling its website and analyzing with Claude.
 * Updates the localreach_business_research table with structured findings.
 */
export async function enrichBusiness(businessId: string): Promise<BusinessResearch> {
  // Fetch the business record
  const { data: business, error: bizError } = await supabaseAdmin
    .from('localreach_businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (bizError || !business) {
    throw new Error(`Business ${businessId} not found: ${bizError?.message}`)
  }

  const biz = business as LocalReachBusiness

  if (!biz.website) {
    // No website — create a minimal research record from available data
    return createMinimalResearch(biz)
  }

  // Mark crawl as in progress
  const researchId = await upsertResearchRecord(businessId, {
    business_id: businessId,
    website_url: biz.website,
    crawl_status: 'crawling',
  })

  let crawlResults: Array<{ url: string; title: string; content: string; status: number }>

  try {
    // Extract domain from website URL
    const domain = extractDomain(biz.website)
    crawlResults = await crawlDomain(domain, { maxPages: MAX_CRAWL_PAGES })
  } catch (crawlError: unknown) {
    const errorMessage = crawlError instanceof Error ? crawlError.message : String(crawlError)
    console.error(`Crawl failed for business ${businessId}:`, errorMessage)

    // Update research record with failure
    await upsertResearchRecord(businessId, {
      business_id: businessId,
      website_url: biz.website,
      crawl_status: 'failed',
    })

    // Fall back to minimal research
    return createMinimalResearch(biz)
  }

  if (crawlResults.length === 0) {
    await upsertResearchRecord(businessId, {
      business_id: businessId,
      website_url: biz.website,
      crawl_status: 'failed',
    })
    return createMinimalResearch(biz)
  }

  // Combine crawled text
  const combinedText = crawlResults
    .map((r) => `--- ${r.title} (${r.url}) ---\n${r.content}`)
    .join('\n\n')
    .slice(0, MAX_TEXT_LENGTH)

  // Analyze with Claude
  let analysis: AnalysisResult

  try {
    analysis = await analyzeWithClaude(biz, combinedText)
  } catch (analysisError: unknown) {
    const errorMessage = analysisError instanceof Error ? analysisError.message : String(analysisError)
    console.error(`Claude analysis failed for business ${businessId}:`, errorMessage)

    // Save what we have from crawl without AI analysis
    const research = await upsertResearchRecord(businessId, {
      business_id: businessId,
      website_url: biz.website,
      crawl_status: 'done',
      crawl_completed_at: new Date().toISOString(),
      page_count: crawlResults.length,
      raw_text: combinedText,
      summary: null,
      services: [],
      pain_points: [],
      tech_stack: [],
      employee_count_estimate: null,
      revenue_estimate: null,
      has_online_booking: false,
      has_chat_widget: false,
      has_reviews_system: false,
      social_profiles: {},
      competitive_landscape: null,
      recommended_offers: [],
      analysis_model: null,
      analysis_tokens_used: 0,
    })

    // Update business status
    await supabaseAdmin
      .from('localreach_businesses')
      .update({ status: 'enriched', updated_at: new Date().toISOString() })
      .eq('id', businessId)

    return research
  }

  // Save full research
  const research = await upsertResearchRecord(businessId, {
    business_id: businessId,
    website_url: biz.website,
    crawl_status: 'done',
    crawl_completed_at: new Date().toISOString(),
    page_count: crawlResults.length,
    raw_text: combinedText,
    summary: analysis.summary,
    services: analysis.services,
    pain_points: analysis.pain_points,
    tech_stack: analysis.tech_stack,
    employee_count_estimate: analysis.employee_count_estimate,
    revenue_estimate: analysis.revenue_estimate,
    has_online_booking: analysis.has_online_booking,
    has_chat_widget: analysis.has_chat_widget,
    has_reviews_system: analysis.has_reviews_system,
    social_profiles: analysis.social_profiles,
    competitive_landscape: analysis.competitive_landscape,
    recommended_offers: analysis.recommended_offers,
    analysis_model: ANALYSIS_MODEL,
    analysis_tokens_used: analysis.tokens_used,
  })

  // Update business status
  await supabaseAdmin
    .from('localreach_businesses')
    .update({ status: 'enriched', updated_at: new Date().toISOString() })
    .eq('id', businessId)

  return research
}

// ─── Internal helpers ───

interface AnalysisResult {
  summary: string
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
  tokens_used: number
}

async function analyzeWithClaude(
  business: LocalReachBusiness,
  crawledText: string
): Promise<AnalysisResult> {
  const systemPrompt = `You are a business intelligence analyst for a B2B AI automation sales team.
Analyze the crawled website content for a local business and extract structured data.
Your analysis will be used to match the business with relevant AI automation offers.

Respond ONLY with valid JSON matching this exact schema:
{
  "summary": "2-3 sentence overview of the business, what they do, who they serve",
  "services": ["list of services/products offered"],
  "pain_points": ["likely operational pain points based on their business type and website gaps"],
  "tech_stack": ["visible technologies: booking systems, chat widgets, CRM mentions, etc."],
  "employee_count_estimate": "e.g. '5-10' or '20-50' or null if unknown",
  "revenue_estimate": "e.g. '$500K-$1M' or null if unknown",
  "has_online_booking": false,
  "has_chat_widget": false,
  "has_reviews_system": false,
  "social_profiles": {"platform": "url"},
  "competitive_landscape": "brief note on competitive position or null",
  "recommended_offers": ["niche tags that apply to this business, e.g. 'dental', 'hvac', 'salon'"]
}`

  const userPrompt = `Analyze this business:
Name: ${business.name}
Niche: ${business.niche}
Location: ${business.city || ''}, ${business.state || ''}
Google Rating: ${business.google_rating || 'N/A'} (${business.google_review_count || 0} reviews)
Website: ${business.website || 'N/A'}

Crawled website content:
${crawledText}`

  const response = await anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2000,
    messages: [
      { role: 'user', content: userPrompt },
    ],
    system: systemPrompt,
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)

  // Parse the JSON response
  let parsed: Record<string, unknown>
  try {
    // Extract JSON from potential markdown code fences
    let jsonText = textContent.text.trim()
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim()
    }
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${textContent.text.slice(0, 200)}`)
  }

  return {
    summary: (parsed.summary as string) || '',
    services: Array.isArray(parsed.services) ? parsed.services as string[] : [],
    pain_points: Array.isArray(parsed.pain_points) ? parsed.pain_points as string[] : [],
    tech_stack: Array.isArray(parsed.tech_stack) ? parsed.tech_stack as string[] : [],
    employee_count_estimate: (parsed.employee_count_estimate as string) || null,
    revenue_estimate: (parsed.revenue_estimate as string) || null,
    has_online_booking: Boolean(parsed.has_online_booking),
    has_chat_widget: Boolean(parsed.has_chat_widget),
    has_reviews_system: Boolean(parsed.has_reviews_system),
    social_profiles: (parsed.social_profiles as Record<string, string>) || {},
    competitive_landscape: (parsed.competitive_landscape as string) || null,
    recommended_offers: Array.isArray(parsed.recommended_offers) ? parsed.recommended_offers as string[] : [],
    tokens_used: tokensUsed,
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname
  } catch {
    // If URL parsing fails, assume it's already a domain
    return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  }
}

async function upsertResearchRecord(
  businessId: string,
  data: Partial<BusinessResearch> & { business_id: string }
): Promise<BusinessResearch> {
  const now = new Date().toISOString()

  // Check for existing record
  const { data: existing } = await supabaseAdmin
    .from('localreach_business_research')
    .select('id')
    .eq('business_id', businessId)
    .limit(1)
    .single()

  if (existing) {
    const { data: updated, error } = await supabaseAdmin
      .from('localreach_business_research')
      .update({ ...data, updated_at: now })
      .eq('business_id', businessId)
      .select('*')
      .single()

    if (error) {
      throw new Error(`Failed to update research for ${businessId}: ${error.message}`)
    }
    return updated as BusinessResearch
  }

  const { data: inserted, error } = await supabaseAdmin
    .from('localreach_business_research')
    .insert({
      ...data,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    throw new Error(`Failed to insert research for ${businessId}: ${error.message}`)
  }
  return inserted as BusinessResearch
}

async function createMinimalResearch(business: LocalReachBusiness): Promise<BusinessResearch> {
  const nichePainPoints: Record<string, string[]> = {
    dental: ['missed calls during procedures', 'no-show appointments', 'review management', 'after-hours inquiries'],
    medical: ['high call volume', 'scheduling complexity', 'patient follow-up', 'after-hours triage'],
    legal: ['intake qualification', 'lead follow-up', 'client communication', 'after-hours inquiries'],
    salon: ['booking management', 'no-show appointments', 'review requests', 'off-hours scheduling'],
    hvac: ['quote follow-up', 'seasonal demand spikes', 'emergency dispatching', 'review generation'],
    roofing: ['estimate follow-up', 'lead qualification', 'seasonal outreach', 'review generation'],
    plumbing: ['emergency call handling', 'quote follow-up', 'review requests', 'after-hours dispatching'],
    electrical: ['quote follow-up', 'scheduling coordination', 'emergency dispatch', 'review generation'],
    landscaping: ['seasonal scheduling', 'quote follow-up', 'crew coordination', 'review requests'],
    real_estate: ['lead qualification', 'showing scheduling', 'follow-up sequences', 'client nurturing'],
    insurance: ['lead intake', 'policy renewals', 'claim follow-up', 'quote comparison'],
    fitness: ['class booking', 'membership follow-up', 'no-show reduction', 'trial conversion'],
    spa: ['appointment booking', 'no-show management', 'review generation', 'membership upsell'],
  }

  const painPoints = nichePainPoints[business.niche] || ['missed calls', 'lead follow-up', 'scheduling', 'review generation']

  return upsertResearchRecord(business.id, {
    business_id: business.id,
    website_url: business.website,
    crawl_status: business.website ? 'failed' : 'done',
    crawl_completed_at: new Date().toISOString(),
    page_count: 0,
    raw_text: null,
    summary: `${business.name} is a ${business.niche} business located in ${business.city || 'unknown city'}, ${business.state || ''}. No website data available for detailed analysis.`,
    services: [],
    pain_points: painPoints,
    tech_stack: [],
    employee_count_estimate: null,
    revenue_estimate: null,
    has_online_booking: false,
    has_chat_widget: false,
    has_reviews_system: false,
    social_profiles: {},
    competitive_landscape: null,
    recommended_offers: [business.niche],
    analysis_model: null,
    analysis_tokens_used: 0,
  })
}
