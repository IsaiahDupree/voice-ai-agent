/**
 * Custom Web Crawler — fetch + node-html-parser
 * Phase 1: Map links from homepage
 * Phase 2: Score URLs by priority
 * Phase 3: Crawl top N pages, extract clean text
 */
import { parse } from 'node-html-parser'
import type { CrawlResult } from '../business-context'

// ─── URL priority scoring ───

const URL_SCORES: Record<string, number> = {
  '/': 10,
  '/about': 9, '/about-us': 9, '/who-we-are': 9, '/our-story': 9, '/team': 9,
  '/services': 8, '/solutions': 8, '/what-we-do': 8, '/offerings': 8, '/products': 8, '/features': 8,
  '/pricing': 7, '/plans': 7, '/packages': 7,
  '/faq': 6, '/faqs': 6, '/help': 6, '/support': 6,
  '/contact': 5, '/contact-us': 5, '/get-in-touch': 5,
  '/testimonials': 5, '/reviews': 5, '/case-studies': 5, '/portfolio': 5, '/clients': 5,
  '/industries': 5,
  '/blog': 3, '/news': 3, '/resources': 3, '/articles': 3,
}

const EXCLUDED_PATTERNS = [
  /\/cdn-cgi\//,
  /\/_next\//,
  /\/api\//,
  /\/(login|signin|signup|register|auth|logout)/i,
  /\/(checkout|cart|basket|order)/i,
  /\/(admin|dashboard|account|settings|profile)/i,
  /\/(privacy|terms|cookie|legal|disclaimer)/i,
  /\.(pdf|png|jpg|jpeg|gif|svg|webp|mp4|mp3|zip|css|js|woff|woff2|ttf|eot)$/i,
  /\#/,
  /mailto:/,
  /tel:/,
  /javascript:/,
]

function scoreUrl(pathname: string): number {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  // Exact match
  if (URL_SCORES[normalized] !== undefined) return URL_SCORES[normalized]
  // Partial match (e.g. /about/team → about score)
  for (const [pattern, score] of Object.entries(URL_SCORES)) {
    if (normalized.startsWith(pattern + '/') || normalized.startsWith(pattern + '-')) {
      return Math.max(score - 1, 1)
    }
  }
  // Default score for unknown pages
  return 2
}

function isExcluded(url: string): boolean {
  return EXCLUDED_PATTERNS.some(p => p.test(url))
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const parsed = new URL(href, base)
    // Same domain only
    const baseDomain = new URL(base).hostname
    if (parsed.hostname !== baseDomain) return null
    // Strip hash and trailing slash
    parsed.hash = ''
    let normalized = parsed.href.replace(/\/+$/, '') || parsed.origin
    return normalized
  } catch {
    return null
  }
}

// ─── Robots.txt parser (minimal) ───

async function getCrawlDelay(domain: string): Promise<number> {
  try {
    const robotsOpts: RequestInit = {}
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      robotsOpts.signal = AbortSignal.timeout(5000)
    }
    const res = await fetch(`https://${domain}/robots.txt`, robotsOpts)
    if (!res.ok) return 0
    const text = await res.text()
    const match = text.match(/Crawl-delay:\s*(\d+)/i)
    return match ? Math.max(parseInt(match[1], 10), 1) : 0
  } catch {
    return 0
  }
}

function extractText(html: string): string {
  const root = parse(html)
  // Remove non-content elements
  const removeSelectors = [
    'script', 'style', 'nav', 'footer', 'header', 'iframe',
    'noscript', 'svg', '[role="navigation"]', '[role="banner"]',
  ]
  for (const sel of removeSelectors) {
    root.querySelectorAll(sel).forEach(el => el.remove())
  }
  // Also remove by class names
  const removeClasses = ['.nav', '.footer', '.header', '.sidebar', '.menu', '.cookie-banner']
  for (const cls of removeClasses) {
    root.querySelectorAll(cls).forEach(el => el.remove())
  }

  const main = root.querySelector('main')
  const body = main ?? root.querySelector('body')
  const text = body?.text ?? root.text
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Main crawler ───

export interface CrawlOptions {
  maxPages?: number
  onProgress?: (done: number, total: number) => void
}

export async function crawlDomain(
  domain: string,
  options: CrawlOptions = {}
): Promise<CrawlResult[]> {
  const maxPages = Math.min(options.maxPages ?? 25, 50)
  const baseUrl = `https://${domain}`
  const results: CrawlResult[] = []
  const visited = new Set<string>()

  // Get robots.txt crawl delay
  const robotsDelay = await getCrawlDelay(domain)
  const delayMs = Math.max(robotsDelay * 1000, 1000) // minimum 1s

  // Phase 1: Map — fetch homepage and extract all links
  let discoveredUrls: string[] = [baseUrl]
  try {
    const fetchOptions: RequestInit = {
      headers: { 'User-Agent': 'BusinessContextBot/1.0 (+business-context-engine)' },
    }
    // AbortSignal.timeout may not exist in all environments
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      fetchOptions.signal = AbortSignal.timeout(10000)
    }
    const homeRes = await fetch(baseUrl, fetchOptions)
    if (homeRes.ok) {
      const html = await homeRes.text()
      const root = parse(html)

      // Extract homepage content first
      const homeTitle = root.querySelector('title')?.text?.trim() ?? domain
      const homeContent = extractText(html)
      if (homeContent.length > 50) {
        results.push({ url: baseUrl, title: homeTitle, content: homeContent, status: 200 })
        visited.add(baseUrl)
      }

      // Collect all links
      const links = new Set<string>()
      root.querySelectorAll('a[href]').forEach(el => {
        const href = el.getAttribute('href')
        if (!href) return
        const normalized = normalizeUrl(href, baseUrl)
        if (normalized && !isExcluded(normalized) && !visited.has(normalized)) {
          links.add(normalized)
        }
      })
      discoveredUrls = Array.from(links)
    }
  } catch {
    // Homepage failed — try to continue with just the base URL
  }

  // Phase 2: Score and sort
  const scoredUrls = discoveredUrls
    .map(url => {
      try {
        const pathname = new URL(url).pathname
        return { url, score: scoreUrl(pathname) }
      } catch {
        return { url, score: 0 }
      }
    })
    .filter(u => u.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPages - results.length)

  // Phase 3: Crawl scored pages
  for (const { url } of scoredUrls) {
    if (visited.has(url)) continue
    visited.add(url)

    await sleep(delayMs)

    try {
      const pageFetchOptions: RequestInit = {
        headers: { 'User-Agent': 'BusinessContextBot/1.0 (+business-context-engine)' },
        redirect: 'follow',
      }
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        pageFetchOptions.signal = AbortSignal.timeout(10000)
      }
      const res = await fetch(url, pageFetchOptions)

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) continue

      if (res.ok) {
        const html = await res.text()
        const root = parse(html)
        const title = root.querySelector('title')?.text?.trim() ?? url
        const content = extractText(html)

        if (content.length > 50) {
          results.push({ url, title, content, status: res.status })
        }
      }
    } catch {
      // Skip failed pages silently
    }

    options.onProgress?.(results.length, maxPages)
  }

  return results
}
