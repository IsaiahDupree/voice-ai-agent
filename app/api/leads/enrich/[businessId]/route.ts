import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { Anthropic } from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface CrawlResult {
  url: string
  title: string
  content: string
  status: number
}

/**
 * Crawl a website and extract key content.
 * Uses a simple approach: fetch and extract text from main content.
 */
async function crawlWebsite(url: string): Promise<CrawlResult | null> {
  try {
    // Validate URL format
    const urlObj = new URL(url)
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return null
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LocalReach-AI/1.0 (+http://localreach.ai)',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1] : urlObj.hostname

    // Basic HTML to text extraction (remove scripts, styles, tags)
    const text = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000) // Limit to 8k chars for API

    return {
      url,
      title,
      content: text,
      status: response.status,
    }
  } catch (error) {
    console.error(`Crawl failed for ${url}:`, error)
    return null
  }
}

/**
 * Analyze crawled content with Claude to extract business intelligence.
 */
async function analyzeWithClaude(businessName: string, crawledContent: string) {
  const prompt = `You are a business research expert. Analyze this website content from a business called "${businessName}" and extract the following information in JSON format:

Website content:
${crawledContent}

Extract and return ONLY a valid JSON object (no markdown, no code blocks) with these exact keys:
{
  "services": ["list of services offered"],
  "pain_points": ["list of business pain points evident from the site"],
  "tech_stack": ["technology tools mentioned or evident"],
  "has_online_booking": true/false,
  "has_chat_widget": true/false,
  "has_reviews_system": true/false,
  "employee_count_estimate": "estimated range or null",
  "revenue_estimate": "estimated range or null",
  "tone": "brand tone description",
  "competitive_landscape": "brief competitive analysis",
  "recommended_offers": ["offer slugs that would fit: missed-call-text-back, ai-receptionist, review-generation, appointment-booking-ai, no-show-reduction, quote-follow-up-ai, ai-outbound-caller, crm-cleanup-reactivation, website-chat-to-book, lead-intake-automation, 24-7-support-agent, monthly-retainer-bundle"]
}

Be specific and concise. If information is not evident, use null or empty arrays.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Parse JSON from response (might be wrapped in markdown code blocks)
  let jsonStr = content.text
  const jsonMatch = jsonStr.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }

  return JSON.parse(jsonStr)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const { businessId } = params

    // Fetch business record
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('localreach_businesses')
      .select('*')
      .eq('id', businessId)
      .single()

    if (fetchError || !business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      )
    }

    if (!business.website) {
      return NextResponse.json(
        { error: 'Business has no website URL' },
        { status: 400 }
      )
    }

    // Check if already enriched recently
    const { data: existingResearch } = await supabaseAdmin
      .from('localreach_business_research')
      .select('*')
      .eq('business_id', businessId)
      .single()

    if (existingResearch && existingResearch.enriched_at) {
      const hoursOld =
        (Date.now() - new Date(existingResearch.enriched_at).getTime()) /
        (1000 * 60 * 60)
      if (hoursOld < 24) {
        // Return cached result if less than 24h old
        return NextResponse.json({
          success: true,
          research: existingResearch,
          cached: true,
        })
      }
    }

    // Crawl the website
    const crawlResult = await crawlWebsite(business.website)
    if (!crawlResult) {
      return NextResponse.json(
        { error: 'Failed to crawl website' },
        { status: 400 }
      )
    }

    // Analyze with Claude
    const analysis = await analyzeWithClaude(business.name, crawlResult.content)

    // Upsert research record
    const { data: research, error: upsertError } = await supabaseAdmin
      .from('localreach_business_research')
      .upsert(
        {
          business_id: businessId,
          services: analysis.services || [],
          pain_points: analysis.pain_points || [],
          tech_signals: analysis.tech_stack || [],
          recommended_offers: analysis.recommended_offers || [],
          tone: analysis.tone,
          brand_voice: null,
          brief: analysis.competitive_landscape,
          full_analysis: analysis,
          crawl_status: 'completed',
          pages_crawled: 1,
          enriched_at: new Date().toISOString(),
        },
        { onConflict: 'business_id' }
      )
      .select()
      .single()

    if (upsertError) throw upsertError

    // Update business status
    await supabaseAdmin
      .from('localreach_businesses')
      .update({ status: 'enriched', last_enriched_at: new Date().toISOString() })
      .eq('id', businessId)

    return NextResponse.json({
      success: true,
      research,
      cached: false,
    })
  } catch (error: any) {
    console.error('[Lead Enrich API] Error:', error)

    // Log crawl failure
    if (params.businessId) {
      await supabaseAdmin
        .from('localreach_business_research')
        .upsert(
          {
            business_id: params.businessId,
            crawl_status: 'failed',
            crawl_error: error.message,
          },
          { onConflict: 'business_id' }
        )
        // Suppress errors — void return
    }

    return NextResponse.json(
      { error: error.message || 'Failed to enrich business' },
      { status: 500 }
    )
  }
}
