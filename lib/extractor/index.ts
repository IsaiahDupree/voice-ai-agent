/**
 * LLM Extractor — crawled pages → BusinessProfile JSON via Claude (OpenAI fallback)
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { BusinessProfileSchema, type BusinessProfile, type CrawlResult } from '../business-context'

const anthropic = new Anthropic()
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

const SYSTEM_PROMPT = `You are a business intelligence analyst. Given the crawled web pages of a company's website, extract a structured business profile as JSON.

Return ONLY valid JSON matching this exact schema — no markdown, no code fences, no explanation:

{
  "company_name": "string — official company name",
  "one_sentence_summary": "string — what the company does in one sentence",
  "elevator_pitch": "string — 2-3 sentence pitch",
  "services": ["array of services/products offered"],
  "industries_served": ["array of industries they serve"],
  "locations_served": ["array of locations/regions"],
  "ideal_customers": "string — who their ideal customer is",
  "primary_value_prop": "string — main value proposition",
  "differentiators": ["what makes them unique vs competitors"],
  "brand_voice": ["adjectives describing their brand tone, e.g. professional, friendly, technical"],
  "testimonials": ["notable testimonials or social proof quotes"],
  "metrics": ["quantifiable achievements, e.g. 500+ clients, 99.9% uptime"],
  "booking_link": "string or null — URL to book a call/demo if found",
  "contact_methods": ["email, phone, form URL, etc."],
  "cta_phrases": ["call-to-action phrases used on the site"],
  "pricing_found": false,
  "pain_points_inferred": ["customer problems this company solves"],
  "objections_inferred": ["likely objections a prospect might raise"],
  "keywords": ["SEO/industry keywords relevant to this business"],
  "pages_used": ["URLs of pages that provided useful information"],
  "unknowns": ["information that could not be determined from the site"],
  "confidence": "high|medium|low — overall confidence in the extracted profile",
  "last_crawled_at": "ISO 8601 timestamp"
}

Rules:
- Use ONLY information found in the provided pages. Do not fabricate.
- If information is not found, use empty arrays/null/unknowns as appropriate.
- Set confidence based on how much useful content was available.
- Infer pain_points and objections from context — these are analytical inferences, not fabrications.`

function prepareContent(pages: CrawlResult[], maxTokenEstimate = 150000): string {
  // Rough estimate: 4 chars per token
  const maxChars = maxTokenEstimate * 4
  const seen = new Set<string>()
  const parts: string[] = []
  let totalChars = 0

  for (const page of pages) {
    // Deduplicate by content hash (first 200 chars)
    const hash = page.content.slice(0, 200)
    if (seen.has(hash)) continue
    seen.add(hash)

    const section = `--- PAGE: ${page.url} ---\nTitle: ${page.title}\n\n${page.content}\n`
    if (totalChars + section.length > maxChars) break
    parts.push(section)
    totalChars += section.length
  }

  return parts.join('\n')
}

export async function extractBusinessProfile(
  pages: CrawlResult[],
  domain: string
): Promise<BusinessProfile> {
  const content = prepareContent(pages)

  let text = ''
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract a business profile for the domain "${domain}" from these crawled pages:\n\n${content}`,
        },
      ],
    })
    text = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('')
  } catch (anthropicErr: unknown) {
    const errMsg = anthropicErr instanceof Error ? anthropicErr.message : String(anthropicErr)
    console.warn('[extractor] Anthropic failed, trying OpenAI fallback:', errMsg)
    if (!openai) throw anthropicErr
    const fallback = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract a business profile for the domain "${domain}" from these crawled pages:\n\n${content}`,
        },
      ],
    })
    text = fallback.choices[0]?.message?.content ?? ''
  }

  // Parse and strip any markdown fences
  const jsonStr = text.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()

  try {
    const parsed = JSON.parse(jsonStr)
    // Set last_crawled_at if not present
    if (!parsed.last_crawled_at) {
      parsed.last_crawled_at = new Date().toISOString()
    }
    const validated = BusinessProfileSchema.parse(parsed)
    return validated
  } catch (error) {
    console.error('[extractor] Validation failed:', error)
    // Return partial profile with low confidence
    try {
      const partial = JSON.parse(jsonStr)
      return {
        company_name: partial.company_name || domain,
        one_sentence_summary: partial.one_sentence_summary || '',
        elevator_pitch: partial.elevator_pitch || '',
        services: partial.services || [],
        industries_served: partial.industries_served || [],
        locations_served: partial.locations_served || [],
        ideal_customers: partial.ideal_customers || '',
        primary_value_prop: partial.primary_value_prop || '',
        differentiators: partial.differentiators || [],
        brand_voice: partial.brand_voice || [],
        testimonials: partial.testimonials || [],
        metrics: partial.metrics || [],
        booking_link: partial.booking_link || null,
        contact_methods: partial.contact_methods || [],
        cta_phrases: partial.cta_phrases || [],
        pricing_found: partial.pricing_found || false,
        pain_points_inferred: partial.pain_points_inferred || [],
        objections_inferred: partial.objections_inferred || [],
        keywords: partial.keywords || [],
        pages_used: partial.pages_used || [],
        unknowns: partial.unknowns || ['Profile extraction had validation errors'],
        confidence: 'low',
        last_crawled_at: new Date().toISOString(),
      }
    } catch {
      // Complete failure to parse
      return {
        company_name: domain,
        one_sentence_summary: '',
        elevator_pitch: '',
        services: [],
        industries_served: [],
        locations_served: [],
        ideal_customers: '',
        primary_value_prop: '',
        differentiators: [],
        brand_voice: [],
        testimonials: [],
        metrics: [],
        booking_link: null,
        contact_methods: [],
        cta_phrases: [],
        pricing_found: false,
        pain_points_inferred: [],
        objections_inferred: [],
        keywords: [],
        pages_used: [],
        unknowns: ['Complete extraction failure — could not parse LLM response'],
        confidence: 'low',
        last_crawled_at: new Date().toISOString(),
      }
    }
  }
}
