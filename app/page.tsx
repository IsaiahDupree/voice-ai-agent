'use client'

import { useState } from 'react'

const CALENDLY_URL = 'https://calendly.com/isaiahdupree33'
const UPWORK_URL   = 'https://www.upwork.com/freelancers/~isaiahdupree'
const EMAIL        = 'isaiahdupree33@gmail.com'

// ─── Call me widget ─────────────────────────────────────────────────────────

type CallState =
  | { phase: 'idle' }
  | { phase: 'calling' }
  | { phase: 'ringing'; callId: string }
  | { phase: 'error'; message: string }

function CallMeWidget({ contextDomain }: { contextDomain?: string }) {
  const [phone, setPhone] = useState('')
  const [callState, setCallState] = useState<CallState>({ phase: 'idle' })

  const call = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) return
    const e164 = cleaned.startsWith('1') ? `+${cleaned}` : `+1${cleaned}`

    setCallState({ phase: 'calling' })
    try {
      const res = await fetch('/api/demo/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164, domain: contextDomain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`)
      setCallState({ phase: 'ringing', callId: data.callId })
    } catch (err) {
      setCallState({ phase: 'error', message: err instanceof Error ? err.message : 'Something went wrong' })
    }
  }

  const reset = () => { setCallState({ phase: 'idle' }); setPhone('') }

  if (callState.phase === 'ringing') {
    return (
      <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3 animate-pulse">
          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <p className="text-emerald-400 font-semibold mb-1">Calling you now…</p>
        <p className="text-xs text-gray-500 mb-4">The AI agent is dialing {phone}. Pick up in the next 30 seconds.</p>
        <button onClick={reset} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Call a different number</button>
      </div>
    )
  }

  if (callState.phase === 'error') {
    return (
      <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-6">
        <p className="text-sm text-red-400 font-medium mb-1">Call failed</p>
        <p className="text-xs text-red-500 mb-3">{callState.message}</p>
        <button onClick={reset} className="text-xs text-red-400 hover:text-red-300 underline">Try again</button>
      </div>
    )
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Live call</p>
      </div>
      <h3 className="text-xl font-bold text-white mb-1">Hear the AI agent call you right now</h3>
      <p className="text-sm text-gray-500 mb-5">
        Enter your number. The agent will call you in seconds
        {contextDomain ? ` — already briefed on ${contextDomain}` : ''}.
      </p>
      <form onSubmit={call} className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none pointer-events-none">+1</span>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="(555) 000-0000"
            disabled={callState.phase === 'calling'}
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-600
                       focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-40"
          />
        </div>
        <button
          type="submit"
          disabled={callState.phase === 'calling' || phone.replace(/\D/g, '').length < 10}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed
                     text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          {callState.phase === 'calling' ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Dialing…
            </span>
          ) : 'Call me now →'}
        </button>
      </form>
      <p className="text-xs text-gray-700 mt-3">US numbers only. You'll receive a call from our demo line.</p>
    </div>
  )
}

// ─── Inline demo ───────────────────────────────────────────────────────────

type DemoState =
  | { phase: 'idle' }
  | { phase: 'crawling' }
  | { phase: 'done'; result: DemoResult }
  | { phase: 'error'; message: string }

interface DemoResult {
  company_name: string
  brief: string
  services_summary: string
  brand_tone: string
  ideal_customers: string
  key_facts: string[]
  booking_link: string | null
}

function LiveDemo({ onDone }: { onDone?: (domain: string) => void }) {
  const [domain, setDomain] = useState('')
  const [state, setState] = useState<DemoState>({ phase: 'idle' })

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    const d = domain.trim().replace(/^https?:\/\//,'').replace(/\/.*/,'')
    if (!d) return
    setState({ phase: 'crawling' })
    try {
      // 1 — queue the crawl
      const queueRes = await fetch('/api/business-context/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: d, maxPages: 5 }),
      })
      if (!queueRes.ok) {
        const err = await queueRes.json().catch(() => ({}))
        throw new Error(err.error || `Queue failed (${queueRes.status})`)
      }
      const { jobId } = await queueRes.json()

      // 2 — poll status
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const statusRes = await fetch(`/api/business-context/status?jobId=${jobId}`)
        if (!statusRes.ok) continue
        const { status, error } = await statusRes.json()
        if (status === 'failed') throw new Error(error || 'Crawl failed — try another domain')
        if (status !== 'ready') continue

        // 3 — fetch brief
        const briefRes = await fetch(`/api/business-context?domain=${d}`)
        if (!briefRes.ok) throw new Error('Could not retrieve profile')
        const brief = await briefRes.json()
        setState({ phase: 'done', result: brief })
        onDone?.(d)
        return
      }
      throw new Error('Timed out — the site may be blocking crawlers. Try another domain.')
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : 'Something went wrong' })
    }
  }

  const reset = () => { setState({ phase: 'idle' }); setDomain('') }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">Live demo</p>
      <h3 className="text-xl font-bold text-white mb-1">Watch it build a context profile in real time</h3>
      <p className="text-sm text-gray-500 mb-5">Enter any real business domain. Results in ~20 seconds.</p>

      {state.phase !== 'done' && (
        <form onSubmit={run} className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none pointer-events-none">https://</span>
            <input
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="stripe.com"
              disabled={state.phase === 'crawling'}
              className="w-full pl-16 pr-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-gray-600
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-40"
            />
          </div>
          <button
            type="submit"
            disabled={state.phase === 'crawling' || !domain.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed
                       text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {state.phase === 'crawling' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Crawling…
              </span>
            ) : 'Build Profile'}
          </button>
        </form>
      )}

      {/* Crawling progress */}
      {state.phase === 'crawling' && (
        <div className="space-y-2 text-sm text-gray-400 animate-pulse">
          <p>⬤ Fetching pages and extracting links…</p>
          <p>⬤ Scoring URLs by relevance…</p>
          <p>⬤ Running AI extraction pass…</p>
        </div>
      )}

      {/* Error state */}
      {state.phase === 'error' && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl p-4">
          <p className="text-sm text-red-400 font-medium mb-1">Crawl failed</p>
          <p className="text-xs text-red-500 mb-3">{state.message}</p>
          <button onClick={reset} className="text-xs text-red-400 hover:text-red-300 underline">Try another domain</button>
        </div>
      )}

      {/* Result */}
      {state.phase === 'done' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-white">{state.result.company_name}</p>
              <p className="text-xs text-emerald-400 mt-0.5">✓ Profile built — ready for Vapi injection</p>
            </div>
            <button onClick={reset} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              Try another →
            </button>
          </div>

          <div className="bg-gray-900/60 rounded-xl p-4 border border-white/[0.06]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">AI Brief (injected into every call)</p>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line line-clamp-4">{state.result.brief}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Services</p>
              <p className="text-xs text-gray-400">{state.result.services_summary || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Brand Voice</p>
              <p className="text-xs text-gray-400">{state.result.brand_tone || '—'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Key facts the agent now knows</p>
            <ul className="space-y-1">
              {state.result.key_facts.slice(0, 5).map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                  <span className="text-blue-400 mt-0.5 shrink-0">•</span>{f}
                </li>
              ))}
            </ul>
          </div>

          {/* Conversion moment */}
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white mb-0.5">Want this running for your business?</p>
              <p className="text-xs text-gray-400">I&apos;ll set it up and have an agent taking calls for you this week.</p>
            </div>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              Book a call →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function Home() {
  const [crawledDomain, setCrawledDomain] = useState<string | undefined>(undefined)

  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 sticky top-0 bg-gray-950/90 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold tracking-tight">Isaiah Dupree</span>
            <span className="text-xs text-gray-600">AI Automation Engineer</span>
          </div>
          <div className="flex items-center gap-3">
            <a href={UPWORK_URL} target="_blank" rel="noopener noreferrer"
               className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block">
              Upwork
            </a>
            <a href={`mailto:${EMAIL}`}
               className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block">
              Email
            </a>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              Book a Call
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium bg-blue-950 text-blue-300 border border-blue-800 px-3 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Live system — not a mockup
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight mb-5">
          A 24/7 AI phone agent that handles<br />
          <span className="text-blue-400">every inbound call</span> for your business
        </h1>

        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-4 leading-relaxed">
          Answers questions, books appointments, and qualifies leads — automatically.
          Try the demo below: enter your website and then have the agent call you in real time.
        </p>
      </section>

      {/* Embedded demo — above the fold */}
      <section className="max-w-3xl mx-auto px-6 pb-8">
        <LiveDemo onDone={setCrawledDomain} />
      </section>

      {/* Call me widget */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <CallMeWidget contextDomain={crawledDomain} />
      </section>

      {/* Social proof numbers */}
      <section className="max-w-5xl mx-auto px-6 py-10 border-t border-white/[0.06]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: '~20s',  label: 'to index any domain' },
            { n: '25',    label: 'pages crawled per run' },
            { n: '24/7',  label: 'inbound call coverage' },
            { n: '100%',  label: 'context live at call start' },
          ].map(({ n, label }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-white mb-1">{n}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-6 text-center">Full system</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: '🧠', title: 'Business Context Engine', desc: 'Crawls any website → structured profile → injected into every call automatically' },
            { icon: '📞', title: '24/7 Inbound Handling',   desc: 'Natural voice conversations via Vapi — never misses a lead' },
            { icon: '📅', title: 'Live Appointment Booking',desc: 'Integrated with Cal.com — books real slots during the call' },
            { icon: '💬', title: 'SMS Confirmations',       desc: 'Twilio follow-ups sent automatically after every booking' },
            { icon: '📊', title: 'Call Analytics',          desc: 'Sentiment tracking, conversion rates, full transcript review' },
            { icon: '🔗', title: 'Multi-tenant Ready',      desc: 'One platform, multiple clients — fully isolated per account' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 hover:bg-white/[0.06] transition-colors">
              <div className="text-2xl mb-3">{icon}</div>
              <h3 className="font-semibold text-sm text-white mb-1.5">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About + CTA */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-white/[0.06]">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Who built this</p>
            <h2 className="text-2xl font-bold mb-3">Isaiah Dupree</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              AI automation engineer specializing in voice AI systems, autonomous agents, and full-stack
              integrations. I build production systems — not demos — that generate revenue on day one.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Vapi', 'Anthropic Claude', 'Next.js', 'Supabase', 'Twilio', 'OpenAI'].map(t => (
                <span key={t} className="text-xs bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-gray-400">{t}</span>
              ))}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold text-lg mb-2">Ready to automate your calls?</h3>
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              30-minute call. I&apos;ll show you a live demo with your actual business, answer every
              technical question, and give you a clear scope + price before we hang up.
            </p>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors mb-3"
            >
              Book a 30-min call →
            </a>
            <div className="flex justify-center gap-6 text-xs text-gray-600">
              <a href={`mailto:${EMAIL}`} className="hover:text-gray-400 transition-colors">{EMAIL}</a>
              <a href={UPWORK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Upwork Profile</a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-5 text-center text-xs text-gray-700">
        Built by Isaiah Dupree · Vapi · Anthropic Claude · Next.js · Supabase · Twilio
      </footer>

    </main>
  )
}
