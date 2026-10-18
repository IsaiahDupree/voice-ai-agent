# Roadmap

> Where this app stands, what "complete" means, and the path to v1.0.

## Reality check vs. reference receptionist repos

A scan of the five most-cited open-source receptionist repos
(`kirklandsig/AIReceptionist`, `livekit/agents`, `fixie-ai/community-center-receptionist`,
`duohub-ai/receptionist`, `livekit-examples/phone-assistant`) identified five table-stakes
features common to 3+ of them:

| # | Table-stakes feature | Status here |
|---|---|---|
| 1 | Inbound call ingestion (PSTN/SIP) | **Done** — Vapi + Twilio webhook (`app/api/webhooks/vapi`) |
| 2 | Prompt-based persona config | **Done** — `app/dashboard/personas`, `lib/persona-builder.ts`, plus pack-driven personas (`lib/packs/persona.ts`) |
| 3 | Call transfer with department/individual routing | **Done** — `lib/call-transfer-enhanced.ts`, `transfer-core.ts`, `transfer-whisper.ts`, `app/dashboard/handoff` |
| 4 | Knowledge-base / RAG | **Done** — pgvector, `lib/kb-*.ts` (chunker, embeddings, ingest, search), `app/dashboard/knowledge-base` |
| 5 | Call state tracking + human handoff | **Done** — `lib/call-stage-detector.ts`, `human-handoff.ts`, `escalation-levels.ts` |

We're well past the demo tier. We also have features none of those repos have: outbound dialer & campaigns, DTMF IVR builder, multi-tenant + RBAC + RLS, compliance classifier, industry packs, MCP bridge, audit logs, live transcripts, ROI/outcome rollup, and so on (~70 API route groups, 58 migrations, 23 LLM tools).

So this roadmap isn't a catch-up; it's **what production-grade means for a multi-tenant AI receptionist platform with industry packs**.

---

## Definition of "complete" (v1.0)

A tenant can sign up, install an industry pack, configure KB + integrations, and operate a compliant 24/7 voice receptionist that handles inbound, books, transfers, follows up via SMS, and proves ROI + compliance to their auditor — without us touching their account.

The five gates a release must clear before we call it v1.0:

1. **Self-serve onboarding** — A new tenant can complete onboarding in <30 minutes without a human.
2. **One-screen ops** — A tenant's daily operator can run the system from a single dashboard view.
3. **Compliance audit pack** — Every regulated event (TCPA, HIPAA, RESPA, CMS, UPL) is logged, queryable, and exportable.
4. **Cost ceiling per call** — A clear per-minute cost target; alerts when a tenant blows it.
5. **Failure-mode coverage** — Every external dependency (Vapi, Twilio, Supabase, Anthropic, Stedi, RND providers) has a documented failure mode + graceful degradation.

If any of these is "we'll do it later," we're not v1.0.

---

## Roadmap

Three milestones. Each is shippable on its own.

### M1 — Pack catalog completeness (≈2 weeks)

Goal: Every researched vertical has a published pack. Reduces "we don't have a pack for that yet" objections to zero.

Researched but not seeded (per `MEMORY.md` index): childcare, real-estate, medspa, fitness, CPA, education, funeral, auto-repair, chiropractic, PT, storage, moving, pet-services, cleaning, wedding-venue, optometry, OB/GYN, medical-billing, behavioral-health, solar, towing, locksmith, pest-control, urgent-care, plastic-surgery, tax-resolution, MSP. ~27 packs.

**Deliverables:**
- One seed migration per pack (Tier-A: ~80 lines; Tier-B/C: ~120 lines).
- Tool runtime additions only where the persona declares a tool we haven't built yet (most reuse the existing surface).
- Compliance-profile rows added per pack.
- `INDUSTRY-PACKS.md` updated with the catalog.

**Done when:** `SELECT count(*) FROM industry_packs WHERE status='published'` ≥ 35 and every pack has a passing install-validation test.

---

### M2 — Production hardening (≈3 weeks)

Goal: Pass an external audit. Pick the v1.0 gates one at a time.

#### M2.1 Self-serve onboarding
- Onboarding wizard end-to-end test (Playwright) — sign up → pick pack → fill KB → connect integrations → place test call.
- Stripe billing wired to provisioning; auto-pause on failed payment with grace period.
- Email-only password reset path verified.

#### M2.2 One-screen ops
- A `/dashboard` "today" view: live calls, today's bookings, opt-outs, compliance gates, missed-call queue, alerts. No tab-switching for a daily operator.
- Real-time updates via Supabase realtime, not polling.

#### M2.3 Compliance audit pack
- CSV export endpoint per compliance event class (`/api/packs/[slug]/audit/export?from=&to=&kind=`).
- PDF report generator for a date range — TCPA consents, HIPAA disclosures, RESPA fee structure attestations, CMS SOA + TPMO logs, UPL classifier blocks.
- Retention enforcement job (CMS 10y / privileged 7y / standard 18mo) — soft-delete + purge cron.

#### M2.4 Cost ceiling per call
- Per-call cost rollup (Vapi minutes + Anthropic tokens + Twilio SMS) attached to the call row.
- Alert when avg cost-per-call exceeds the tenant's tier ceiling for two consecutive days.
- Cost dashboard tile next to ROI rollup.

#### M2.5 Failure-mode coverage
- Synthetic monitor per provider (Vapi, Twilio, Supabase, Anthropic, Stedi, RND) — pings + alert.
- Documented graceful-degradation path for each (e.g. Stedi down → return `verification_not_enabled`, never block the call; Anthropic down → fall back to a smaller model; RND provider down → block outbound until restored).
- Chaos test: kill one provider; assert call still completes with the right deflection.

**Done when:** all five gates have a passing test and a runbook in `OPERATIONS.md`.

---

### M3 — Differentiators (≈4 weeks, parallelizable)

Goal: Pull ahead of horizontal voice-AI vendors on what matters in regulated verticals.

Candidates (pick 3–5 based on early-customer signal):

- **Branded calling (STIR/SHAKEN + RCD)** — outbound shows agency name, not "Spam Likely". Twilio Trust Hub integration.
- **Live whisper coach** — supervisor can listen in and inject prompts to the agent mid-call (the hidden killer feature for BDC managers).
- **Call-back scheduling on busy tone** — tenant SMS receives "missed callback at 2:14 PM, retry?" with one-click retry.
- **Pack marketplace export/import** — third parties can author + sell packs; we already have the import/export plumbing (`lib/packs/import-export.ts`), need a signed-bundle format + listing UI.
- **Verticals-as-tenants white-label** — agency partner brands the dashboard, manages downstream tenants under their org.
- **Conversation analytics** — objection clustering, talk-time ratios, sentiment-trend, evaluator scoring (we have building blocks in `lib/transcript-analysis.ts` and `call-evaluator.ts`; needs to surface in dashboard).

---

## Sequencing & dependencies

```
M1 (catalog)   ────────────────┐
                               ├─→  v1.0 launch
M2 (hardening) ────────────────┤
                               │
M3 (differentiators)  ─ parallel after M2.1 ─→  v1.x
```

M1 can run fully parallel with M2 — different parts of the codebase. M3 should not start until M2.1 (onboarding) and M2.3 (audit pack) are green, because every M3 feature is sold against those two.

## What "shipping" means each week

A week ends with one of:
- A new pack seed merged + installable in dev.
- A v1.0 gate flipped from open to closed (test + runbook + dashboard).
- An M3 candidate behind a feature flag with an opt-in tenant.

If a week ends without one of these, we cut scope, not quality.

## Out of scope for v1.0

These are deliberately deferred to keep v1.0 reachable:

- **Direct SIP without Vapi** — Vapi is good enough; don't rebuild the telephony stack.
- **In-app speech-to-speech** — cascaded STT/LLM/TTS is fine for regulated verticals; the latency win from realtime models doesn't outweigh observability loss.
- **Dialer beyond predictive** — power dial is enough for our ICPs.
- **More than English + Spanish** — table-stakes is bilingual; everything else is post-v1.
- **Voice cloning of real employees** — we explicitly don't allow this; FCC + state mini-TCPA risk too high.
