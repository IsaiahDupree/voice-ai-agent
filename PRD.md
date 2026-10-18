# PRD — Voice AI Agency Platform

> One-line product: **An AI voice receptionist and sales-assistant platform for agencies that helps small businesses answer every call, recover missed leads, follow up automatically, qualify high-ticket prospects, book appointments, and track revenue opportunities — from one dashboard.**

This document supersedes the original `PRD-v0.md` (single-tenant, Upwork-target framing) and is the source of truth for product scope. `ROADMAP.md` covers system milestones; this PRD frames what we are *for*: agency owners selling a front-office growth system to small businesses.

---

## 1. Buyer / user / payer

| Role | What they care about | What they don't want to think about |
|---|---|---|
| **Agency owner** (buyer + payer) | Deploy fast for new clients, prove ROI monthly, spend ≤2 hrs/wk per client to manage | Prompts, APIs, infrastructure, compliance edge cases |
| **SMB owner** (end-user, indirect payer) | Missed calls recovered, leads followed up with, fewer interruptions | Anything technical |
| **Caller** (user of the AI) | Get help fast, talk to a human if needed | Knowing they're talking to AI |
| **Agency CSM / operator** (daily user) | Quick scan of what's working, what's not, where to intervene | Switching tabs to find anything |

The product earns its price when an agency owner can sign a $1.5K–$8K/mo SMB contract and deliver it in <30 minutes of setup time.

---

## 2. Definition of "complete" (v1.0)

The AI receptionist is complete when it can:

| # | Capability | Done? | Evidence |
|---|---|---|---|
| 1 | Answer inbound calls | ✅ | `app/api/webhooks/vapi`, `lib/vapi.ts` |
| 2 | Make outbound calls | ✅ | `app/dashboard/campaigns`, `lib/campaign-dialer.ts` |
| 3 | Understand the business it represents | ✅ | KB ingest + RAG + per-tenant namespace; industry packs with KB schema |
| 4 | Qualify leads | ⚠️ | `lib/call-evaluator.ts` exists; **no formal lead-scoring model surfaced to agency** |
| 5 | Handle objections | ⚠️ | `app/dashboard/objections` route exists; **no objection-bank wired into pack personas** |
| 6 | Book appointments | ✅ | Cal.com / Calendly / Booksy / ServiceTitan / OpenTable adapters + `bookAppointment` tool |
| 7 | Follow up with leads | ⚠️ | SMS templates + scheduler exist; **no end-to-end "post-call follow-up" workflow per outcome** |
| 8 | Support high-ticket sales | ❌ | **No discovery/qualification persona variant; no high-ticket sales playbook** |
| 9 | Update CRM/contact records | ✅ | Per-pack CRM provider (`lib/providers/crm-*.ts`) + Supabase fallback |
| 10 | Notify the business owner | ⚠️ | Alerting infra exists (`lib/alerting.ts`); **no daily-digest email per client** |
| 11 | Escalate to a human | ✅ | Handoff system (`lib/human-handoff.ts`, transfer-whisper) |
| 12 | Track outcomes & performance | ✅ | `lib/packs/outcomes.ts`, ROI rollup, compliance gates tile |
| 13 | Be configured by an agency for different clients | ❌ | **No agency layer above tenant — each client tenant is a flat island** |

### The four real gaps

1. **Agency layer** (cap. #13) — biggest gap. Today every client = a flat tenant. An agency owner has no single view of their book of business, no ability to provision a new client without DB access, no way to share branded reports.
2. **Lead/sales qualification model** (cap. #4 + #8) — we evaluate calls but don't produce a single Lead Score / Opportunity Score that an agency can show their SMB.
3. **Post-call follow-up workflows** (cap. #7) — outcomes are recorded, but the "lead came in → AI talks → AI follows up via SMS 2h later → agency gets summary" loop isn't wired end-to-end.
4. **Owner digest / client report** (cap. #10) — the SMB owner needs a single daily/weekly artifact ("here's what we did for you"). Today it lives in the dashboard; we need to push it.

Everything else is either done or behind a feature flag and just needs surfacing.

---

## 3. MVP scope ("complete enough to sell")

The user's MVP list, with what we still need to ship for it:

1. ✅ Inbound call answering
2. ✅ Outbound follow-up calls
3. ✅ Business knowledge base
4. **Build:** Lead qualification — a single `lead_score` field on every call + a "qualified leads" tile per client
5. ✅ Appointment booking
6. ✅ Call summaries
7. ✅ CRM/contact logging
8. ✅ Human handoff
9. **Build:** Agency dashboard — top-level page listing the agency's clients with KPIs
10. **Build:** Client report — daily/weekly digest per SMB, optionally white-labeled

This MVP is **shippable in 4 sprints**. Plan in §6.

---

## 4. Non-goals for v1.0

To keep MVP reachable:

- **Agency-level usage billing** — flat plans only at v1.0; usage pricing in v1.x.
- **Voice cloning of real employees** — explicitly disallowed.
- **Direct SIP without Vapi** — Vapi is good enough.
- **Languages beyond EN + ES.**
- **Any feature that requires a new external dependency** beyond Vapi, Twilio, Supabase, Anthropic, OpenAI, Stripe, Resend.

---

## 5. Differentiators we already have (lean into)

These show up in the product but aren't loud enough in the marketing/UI:

- **Industry packs** — 9 published, vertical-specific persona + compliance + tools. Reframe as "AI sales scripts by niche."
- **Compliance classifier** — server-side blocked-phrase + utterance gate. Sales angle: "we won't get your client sued."
- **Compliance gates dashboard tile** — RND / DNC / SOA / TPMO / carrier-appointment events as the audit story.
- **Call evaluator + sentiment + auto-tags** — already running; needs to surface as Lead Score.
- **A/B testing** (`lib/ab-testing.ts`) — script A/B is in the user's "Full Complete" list and we already have it; ship as a tier-2 feature.
- **MCP bridge** (`callMCP` tool) — agency can plug a custom CRM in 5 min.

---

## 6. Build plan — 4 sprints

Every sprint ends with something an agency owner can demo to their SMB.

### Sprint 1 — Agency layer (this sprint)

Goal: An agency owner can sign in, see their clients, drill into one, and see that client's KPIs. They can provision a new client tenant from the UI.

| # | Deliverable | Files |
|---|---|---|
| 1.1 | `agencies` table + `agency_users` join + `tenants.agency_id` FK + RLS | `supabase/migrations/202605080100_agencies.sql` |
| 1.2 | `lib/agency.ts` — context resolver, tenant→agency lookup | new |
| 1.3 | `/api/agencies` (GET own agency) | new |
| 1.4 | `/api/agencies/[id]/clients` — list with KPI rollup | new |
| 1.5 | `/dashboard/agency` — agency owner's home, grid of clients | new |
| 1.6 | "Add client" wizard — minimum to provision a tenant + pick pack | new (or extend `/dashboard/setup`) |

**Done when:** an agency user can `POST /api/agencies/me/clients` with a pack slug + business name and get a working tenant back.

### Sprint 2 — Lead score + post-call follow-up

Goal: Every call exits with a `lead_score` and a `next_action`; high-score leads trigger a post-call SMS template; the agency can see "qualified leads this week" on the agency dashboard.

| # | Deliverable | Files |
|---|---|---|
| 2.1 | `lead_score INT` + `lead_score_reasons JSONB` on `call_outcomes` (via existing call-evaluator output) | migration |
| 2.2 | Post-call SMS workflow: outcome → template → schedule send via existing SMS scheduler | `lib/post-call-followup.ts` (new) |
| 2.3 | Lead-score badge on client KPI tiles | dashboard |
| 2.4 | "High-ticket sales" persona variant — discovery + objection-bank — added to relevant packs (medspa, legal, mortgage, real estate, plastic surgery) | pack seeds |

**Done when:** a roofing-vertical demo call lands with `lead_score=84`, `next_action=schedule_estimate`, and the lead receives an SMS within 2 minutes scheduling the estimator.

### Sprint 3 — Owner digest / client report

Goal: Every SMB gets a daily or weekly email summarizing what the AI did for them — "here's the value" artifact.

| # | Deliverable | Files |
|---|---|---|
| 3.1 | Digest renderer (HTML email + PDF) | `lib/owner-digest.ts` (new) |
| 3.2 | Schedule per client: daily / weekly, configurable | tenant settings |
| 3.3 | Send via Resend (already in deps) | extend `/api/cron` |
| 3.4 | White-label support — agency logo + agency contact on every digest | agency settings |
| 3.5 | "Send a sample" button in agency dashboard | UI |

**Done when:** a Monday email reads: "Last week your AI handled 47 calls. 12 booked appointments. 8 leads ($X est.) followed up with. 3 high-ticket prospects flagged. 0 missed."

### Sprint 4 — Self-serve onboarding + Stripe billing

Goal: An agency signs up, pays a card, provisions clients without us touching anything.

| # | Deliverable | Files |
|---|---|---|
| 4.1 | Agency signup → Stripe Checkout (subscription) → agency record created | extend `/api/agencies` |
| 4.2 | Stripe webhook → entitlement on agency (max_clients, plan tier) | new |
| 4.3 | Onboarding wizard for SMB clients — 6-step flow | extend `/dashboard/setup` |
| 4.4 | E2E Playwright test: signup → checkout → provision client → place test call | `__tests__/e2e/agency-onboard.spec.ts` |

**Done when:** the Playwright test passes against a Stripe test-mode account.

---

## 7. Capability matrix (for tracking)

| Capability | Sprint | Status |
|---|---|---|
| Inbound | shipped | ✅ |
| Outbound | shipped | ✅ |
| KB / RAG | shipped | ✅ |
| Lead qualification | S2 | open |
| Objection handling | S2 | open (per-pack persona variant) |
| Booking | shipped | ✅ |
| Follow-up | S2 | open |
| High-ticket sales | S2 | open |
| CRM update | shipped | ✅ |
| Owner notification | S3 | open |
| Human escalation | shipped | ✅ |
| Outcome tracking | shipped | ✅ |
| Agency configuration | S1 | **building now** |
| Client report | S3 | open |
| Self-serve onboarding | S4 | open |
| White-label | S3 | open |
| Stripe billing | S4 | open |

---

## 8. Success metrics

What we measure to know v1.0 is real.

| Metric | Target at v1.0 |
|---|---|
| Time-to-first-call for a new SMB client | < 30 minutes from agency clicking "Add client" |
| Agency-to-SMB ratio | 1 agency operator can comfortably manage 25+ clients |
| Calls handled per dollar of cost (Vapi + LLM + SMS) | > 8× cost (gross margin floor) |
| Compliance gate hits per 1k calls | tracked, never silenced |
| Weekly active agencies / total agencies | > 80% |
| SMB churn after 90 days | < 10% |

---

## 9. Open questions

- **Agency-tier compliance** — is the agency a "controller" under regs or a processor for the SMB? Affects DPA / BAA chain. Defer to legal review at v0.9.
- **White-label depth** — full custom domain, or `agency.our-domain.com`? v1.0 = subdomain; custom domain in v1.x.
- **Pack authorship by agencies** — should agencies fork an existing pack for one client? v1.0 = install canonical only; per-tenant overrides via `kb_values`.

---

## 10. Right now

Sprint 1 deliverables start in this session. First commit: agencies schema + RLS.
