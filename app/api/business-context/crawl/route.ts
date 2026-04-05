/**
 * POST /api/business-context/crawl — Queue a domain crawl job
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { crawlDomain } from '@/lib/crawler'
import { extractBusinessProfile } from '@/lib/extractor'
import { compressToBrief } from '@/lib/business-context'

const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { domain, alias, maxPages } = body as {
      domain?: string
      alias?: string
      maxPages?: number
    }

    if (!domain || !DOMAIN_REGEX.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain. Provide a bare domain like "acme.com".' },
        { status: 400 }
      )
    }

    // Rate limit: 1 crawl per 60s per domain
    const { data: existing } = await supabaseAdmin
      .from('business_profiles')
      .select('id, updated_at, status')
      .eq('domain', domain)
      .single()

    if (existing?.status === 'processing') {
      return NextResponse.json(
        { jobId: existing.id, status: 'already_processing' },
        { status: 429 }
      )
    }

    if (existing?.updated_at) {
      const lastUpdate = new Date(existing.updated_at).getTime()
      if (Date.now() - lastUpdate < 60_000) {
        return NextResponse.json(
          { error: 'Rate limited. Wait 60 seconds between crawls for the same domain.' },
          { status: 429 }
        )
      }
    }

    // Upsert record as pending
    const { data: profile, error: upsertError } = await supabaseAdmin
      .from('business_profiles')
      .upsert(
        {
          domain,
          company_name: alias || null,
          status: 'pending',
          error_message: null,
        },
        { onConflict: 'domain' }
      )
      .select('id')
      .single()

    if (upsertError || !profile) {
      return NextResponse.json(
        { error: 'Failed to queue crawl job', details: upsertError?.message },
        { status: 500 }
      )
    }

    const jobId = profile.id

    // Background pipeline — fire and forget
    runPipeline(jobId, domain, maxPages).catch(err =>
      console.error('[business-context] Pipeline error:', err)
    )

    return NextResponse.json({ jobId, status: 'queued' })
  } catch (error) {
    console.error('[business-context/crawl] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function runPipeline(jobId: string, domain: string, maxPages?: number) {
  try {
    // Mark as processing
    await supabaseAdmin
      .from('business_profiles')
      .update({ status: 'processing' })
      .eq('id', jobId)

    // Step 1: Crawl
    const pages = await crawlDomain(domain, { maxPages })

    if (pages.length === 0) {
      await supabaseAdmin
        .from('business_profiles')
        .update({ status: 'failed', error_message: 'No pages crawled successfully' })
        .eq('id', jobId)
      return
    }

    // Store crawled pages
    const pageRows = pages.map(p => ({
      business_id: jobId,
      url: p.url,
      title: p.title,
      content: p.content,
    }))

    // Delete old pages for this business
    await supabaseAdmin
      .from('business_pages')
      .delete()
      .eq('business_id', jobId)

    await supabaseAdmin.from('business_pages').insert(pageRows)

    // Step 2: Extract
    const profile = await extractBusinessProfile(pages, domain)

    // Step 3: Compress
    const context = compressToBrief(profile)

    // Step 4: Store
    await supabaseAdmin
      .from('business_profiles')
      .update({
        company_name: profile.company_name,
        profile,
        brief: context.brief,
        status: 'ready',
        error_message: null,
      })
      .eq('id', jobId)
  } catch (error) {
    console.error('[business-context] Pipeline failed:', error)
    await supabaseAdmin
      .from('business_profiles')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', jobId)
  }
}
