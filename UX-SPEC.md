# UX / UI Specification

> Companion to `PRD.md`. The PRD says *what* we're building; this doc says *how the user experiences it.* Targets a designer + frontend engineer; opinionated where opinion saves time, deliberately under-specified where design needs room.

Owner: Isaiah · Last updated: 2026-05-08

---

## 1. Personas (the three the UI must serve)

| Persona | Spends in product | Their litmus question |
|---|---|---|
| **Agency owner** (paying buyer) | 1–3 hours/week | "Is each client client paying off, and what should I be paying attention to right now?" |
| **Agency operator / CSM** (daily user) | 30–90 minutes/day | "What's broken across my book, and what's hot today?" |
| **SMB owner** (end-user, indirect payer) | 2 minutes/week (email + occasional portal) | "Did the AI actually do something for me this week?" |

A fourth user — the **caller** — never touches a UI, but the AI persona we hand them *is* a UX decision. Voice surface specs live in §10.

The same person can wear multiple hats (solo agency owner = buyer + operator). Build the screens so a single user can do everything; **don't gate role-specific features behind separate accounts at v1.0**.

---

## 2. Information architecture

### Public surfaces (no auth)

```
/                        Marketing landing — agency-pitch focused
/signup                  Plan picker → Stripe Checkout
/signup/success          Polls until webhook lands → drops into dashboard
/login                   Email/magic link auth (NEW — see §3.1)
/owner/[token]           SMB owner portal — read-only client view (NEW — §3.5)
```

### Authenticated agency surfaces

```
/dashboard/agency        ★ Home for agency owners — book of business at a glance
/dashboard/agency/[clientId]
                         Drill-in: KPIs, calls, follow-ups, digest, settings (NEW)
/dashboard/agency/settings
                         Branding, team, billing portal (NEW)
/dashboard/agency/team   Invite operators (NEW)
```

### Authenticated client (per-tenant) surfaces

```
/dashboard/[tenantSlug]/   ★ Per-client home (extends existing /dashboard)
  ├ calls                  Live + history (existing — needs polish)
  ├ packs                  Install / configure / credentials (existing)
  ├ knowledge-base         Upload + chunk + search (existing)
  ├ flows                  Conversation flow editor (existing)
  ├ campaigns              Outbound batches (existing)
  ├ contacts               CRM (existing)
  ├ scheduling             Calendar / bookings (existing)
  ├ handoff                Human escalation queue (existing)
  ├ compliance             Audit log + violations (existing) + export (NEW)
  ├ digests                Per-client digest schedule + history (NEW)
  └ settings               Per-client config (existing)
```

### Star-rated screens are the v1.0 spine. Everything else is supporting.

The current dashboard has ~30 routes. v1.0 explicitly does **not** require touching all of them — most are mature. The new work is the agency tier and the SMB owner portal.

---

## 3. Critical user journeys

### 3.1 Agency owner: zero → first call (the v1.0 happy path)

The single most important UX flow. Time-budget: **30 minutes from signup to live call.**

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Signup  │ →  │  Stripe  │ →  │ Provision│ →  │ Add first│ →  │  Place   │
│   page   │    │ Checkout │    │ + login  │    │  client  │    │test call │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   2 min          1 min           auto+poll       8 min          5 min
```

#### Step 1 — `/signup` (built)
- Three plan tiles (Starter $297 · Growth $997 · Scale $2,497).
- Live slug preview as the user types the agency name.
- One CTA: **Continue to checkout →**.
- Visual hierarchy: plan first, then identity, then submit. Don't bury the price.

#### Step 2 — Stripe Checkout (Stripe-hosted)
- We don't design this. Brand only via Stripe Dashboard logo + color.

#### Step 3 — `/signup/success` (built)
- Loading state (≤30s) with a progress bar — not a spinner.
- Success → big CTA into `/dashboard/agency?id=...`.
- Timeout state (rare): show "Stripe confirmed; provisioning still in progress" with a refresh nudge + support email.

#### Step 4 — First-time agency dashboard
- **Empty state takes over the page.** Don't show the empty grid; show a guided "Add your first client" card with three suggestions:
  - Pick an industry pack from a 3×3 grid (most common verticals: home services, dental, legal, salon, restaurant, vet, dealership, mortgage, insurance).
  - Or "I have a different vertical" → text input → routes to a request form.
- Below: a small "Tour the dashboard (60s)" video link or interactive tour.
- Once a client exists, this card collapses to a compact "Add client" button in the header.

#### Step 5 — `/dashboard/agency/add-client` wizard (NEW — replaces today's modal)
6 steps, each must fit one viewport, total <8 minutes:

1. **Business basics** — display name, legal name, primary phone, business hours, timezone.
2. **Industry pack** — picks slug; preview shows compliance posture, required integrations.
3. **Knowledge base** — required KB fields from the pack's `kb_schema` rendered as a form. Smart defaults pulled from a 3-line "About your business" box (LLM-suggested, user confirms).
4. **Integrations** — pick provider per category (calendar / SMS / CRM); for each, "Connect" → OAuth or API-key drawer.
5. **Phone number** — provision a Twilio number OR forward an existing one. Show the cutover instructions for forwarding.
6. **Test call** — embedded "Call me" widget with a green "Place test call" button. Live transcript renders inline. Activate-and-launch CTA only enabled after a successful test.

#### Step 6 — Confirmation
Single page: "Smith Roofing is live." Three CTAs side-by-side:
- "View live calls" → `/dashboard/[clientSlug]/calls`
- "Set up the digest" → opens digest modal
- "Add another client" → restarts wizard

### 3.2 Daily agency operator workflow (≤5 min check-in)

Mental model: "scan, triage, drill in, exit." The agency dashboard must answer four questions in <60s of scanning:

1. **What's hot today?** (hot-leads tile, top-line)
2. **What broke?** (compliance red rows, bottom of follow-ups panel)
3. **Whose digest goes out today?** (digest schedule sidebar)
4. **What did I make this week?** (est. revenue tile, plus per-client cards)

Drill-in is *only* for triage — never for routine ops. If the agency operator is digging into individual calls more than once a day per client, the dashboard has failed.

### 3.3 Provisioning a new client (when agency already has clients)

Same 6-step wizard. Time budget shrinks to **<8 minutes** because the operator already knows the integrations.

The wizard's escape valve: every step has a **"Save as draft"** that returns to the agency dashboard. Drafts surface as a banner: "2 clients still in setup."

### 3.4 Caller experience (the AI conversation)

UX of the voice agent itself. Spec lives in pack persona prompts (`lib/packs/persona.ts`), but UX principles:

| Principle | Rule |
|---|---|
| **Disclosure first** | Every call opens with recording + AI disclosure (compliance profile drives wording). |
| **Two-second rule** | First-utterance latency ≤ 2s after caller stops speaking. |
| **No dead air** | If a tool call takes >1.2s, the agent must filler-speak ("let me check that for you"). |
| **One question at a time** | Never ask a compound question in a single turn. |
| **Caller-controllable handoff** | Saying "talk to a person" must always work — never gated behind a flow. |
| **Compliance is silent** | RND/DNC/SOA gates never expose the caller to "I checked the database for you" — they fail closed and politely deflect. |

### 3.5 SMB owner experience (the indirect-payer)

Today: a weekly digest email. Tomorrow: a read-only `/owner/[token]` portal (token in the email footer).

#### Email digest (built)
- Subject: `Weekly update for {client} — {n} booked, {m} hot leads`
- White-labeled From: `Rocket Agency <hi@rocket.test>`.
- KPI-tiles row, top-3 highlights, follow-up summary, compliance count if any.
- Plain-text fallback for spam scoring.
- One link: "See more details" → `/owner/[token]`.

#### Owner portal `/owner/[token]` (NEW — Sprint 5)
- Token-authenticated (long opaque string in URL — no password). 30-day expiry, agency rotates if needed.
- **Read-only.** Owner can see; cannot change.
- Three tabs:
  1. **This week** — same numbers as the digest, but interactive.
  2. **Recent calls** — last 20 calls with summaries, no transcripts unless the agency unlocks. (HIPAA / privilege caution by default.)
  3. **Highlights** — top 3 calls with audio/transcript when allowed.
- A "Forward to my team" button copies the URL with a re-issued token.
- A small "Want changes? Talk to {agency name}" CTA at the bottom — never a settings page.

---

## 4. Key screens — detailed specs

### 4.1 `/dashboard/agency` — the home (built; refine)

Layout (top → bottom):

1. **Header bar** — agency name, plan badge, `clients/max` headroom, "Add client" CTA. Right side: notification bell + account menu.
2. **6 KPI tiles** (built): Total calls · Booked · Qualified · Hot 75+ · Missed recovered · Est. revenue.
   - Each tile: label, big number, % change vs prior period (NEW).
   - Click → drill into the cross-client list filtered by that metric (NEW).
3. **Client grid** — 3-column responsive, sorted by today's activity descending.
   - Per card: name, pack slug, lead-score badge, hot count, KPI mini-tiles, top next-action chips, last-call timestamp, est revenue.
   - Hover → "Open dashboard" + "Send digest" + "Suspend" actions.
   - Empty: full-bleed onboarding card (§3.1 step 4).
4. **Recent follow-ups panel** (built): cross-client list, status badges (queued/sent/skipped/failed), skip reasons visible.
5. **Compliance gates strip** — collapsed by default; expands to show RND/DNC/SOA/TPMO counts across the agency. Reuses `/dashboard/packs` tile.
6. **Insights footer** (NEW v1.x): 1–2 sentences of "you should look at this" surfaced from anomalies (e.g. "ABC Roofing's hot-lead rate dropped 40% this week").

Empty / loading / error per panel — see §6.

### 4.2 `/dashboard/agency/[clientId]` (NEW, replaces today's redirect)

Per-client view scoped to the agency context (different from `/dashboard/[tenantSlug]/...` which is tenant-scoped). Lighter than the full dashboard — agency-relevant only.

Sections:
1. Client header (display name, agency-set "Owned by {agency}" stamp).
2. Same 6 KPI tiles as agency home, scoped to this client.
3. **Lead-score histogram** (NEW) — last 30d distribution with quartile markers.
4. **Calls table** — last 50 calls with: time, direction, duration, lead_score badge, next_action, outcome, transcript-link.
5. **Digest schedule** — next send time, last send link, "Send sample" + "Edit subscription" buttons.
6. **Pack health** — current pack version, KB completion %, integration health (green/amber/red).
7. **Compliance audit** — count by gate type, "Export CSV / PDF" buttons (CSV today, PDF in M2.3).

Right rail (sticky on desktop): "Quick actions" — Call this number now, Send a sample digest, Open pack config, Suspend client.

### 4.3 `/dashboard/agency/settings` (NEW)

Three tabs:
1. **Branding** — agency name, slug (read-only post-signup), logo upload (max 1 MB, PNG/SVG), primary color (hex picker), contact email/phone. Live preview of a digest email.
2. **Team** — invite by email + role (owner/admin/operator/readonly). Pending invites visible. Revoke + role-change.
3. **Billing** — current plan, max_clients, "Manage in Stripe" → opens billing portal (`createBillingPortalSession`). Recent invoices last 6 months.

### 4.4 `/dashboard/[tenantSlug]/packs` (built; refine)

Mostly built. Only deltas needed:
- Add a "Compliance gates" tile section above the install panel (built — verify it renders for empty state).
- Add a "Sample call" mock test panel — "place a synthetic call to verify the pack persona before going live."
- Credentials panel: never echo back saved values; show ● (set) vs ○ (unset). (Already done — verify.)

### 4.5 `/dashboard/[tenantSlug]/calls` — call list + detail (existing; refine)

Polish targets:
- **Live calls** at top — sticky banner when ≥1 call active.
- Each row: caller, duration, agent persona, lead-score badge, outcome chip, action menu.
- Drill-in: full transcript, audio playback, function-call timeline, lead-score breakdown ("why 78?"), compliance gate trace.
- Filter chips: outcome, lead score band, next_action, has-followup-sent.
- "Bulk export transcripts" button → CSV (M2.3 scope).

### 4.6 `/dashboard/[tenantSlug]/handoff` — escalation queue (existing; refine)

A queue, not a feed. Cards sorted by urgency, with:
- Caller info, reason for escalation, transcript snippet, agent confidence.
- Three actions: "Take it" (assigns to current operator), "Reassign", "Mark resolved".
- Quiet-hours banner when out of business hours.

### 4.7 `/dashboard/[tenantSlug]/compliance` — audit (existing; extend)

Sub-tabs: Audit log · Violations · Disclosures · Recordings.
- **Add export bar** at the top: date range + outcome class → "Download CSV" or "Download PDF" (M2.3).
- Highlight color rule: red = blocking (rnd_blocked, dnc_blocked, blocked_phrase), amber = honest decline, green = required disclosure captured.

### 4.8 `/dashboard/[tenantSlug]/digests` (NEW)

Per-client digest configuration. Mostly self-contained; surfaces:
- Active subscriptions (recipient, frequency, last sent, status).
- "Add subscription" form (recipient email, name, daily/weekly, send hour, day of week).
- "Preview" button per subscription → reuses the same iframe modal from `/dashboard/agency`.
- Send history (last 30 sends with status + Resend message id).

### 4.9 `/owner/[token]` — SMB portal (NEW; Sprint 5)

Detailed in §3.5.

### 4.10 `/dashboard/setup` — SMB onboarding wizard (existing; replace with §3.1 spec)

The current `/dashboard/setup` is general; the new agency-driven wizard is `/dashboard/agency/add-client`. The general one stays for direct (non-agency) installs.

---

## 5. Component library

Keep small. v1.0 shouldn't need a Storybook — six shared components carry most weight.

| Component | Where it's used | Spec |
|---|---|---|
| `KpiTile` | agency home, client home | label, value, accent (green/blue/amber/red/none), optional %-change |
| `ClientCard` | agency home, owner portal nav | name, pack slug, lead-score badge, KPI mini-tiles, action buttons |
| `LeadScoreBadge` | calls list, follow-ups, client cards | 0–100, color band (green ≥75, blue ≥50, amber ≥25, gray) |
| `OutcomeChip` | calls table, follow-ups | maps `outcome` → color + human label (`booked` → green "Booked"; `rnd_blocked` → red "RND blocked"); see `lib/owner-digest.humanReadableOutcome` for source |
| `NextActionChip` | client cards, digest, calls | maps next_action → label (`transfer_to_closer` → "Transfer to closer"); not ambient color — agency context only |
| `EmptyOnboardingCard` | empty agency home, empty client list | full-bleed promo card with primary CTA + secondary tour link |

Avoid premature abstractions for everything else. The product has too few surfaces to need a full design system at v1.0.

---

## 6. Empty / loading / error states

Per-screen rules — never use a single generic "no data" page.

| Surface | Empty | Loading | Error |
|---|---|---|---|
| Agency home (no clients) | Full-bleed onboarding card (§3.1.4) | Skeleton tiles + skeleton grid | Banner + "Retry" — never wipe existing data |
| Client cards (no calls) | Compact "No calls in window" with date-range pill | Skeleton card | Red border, error chip, hover for full message |
| Compliance gates | Section hidden entirely (today) | Skeleton bars | Inline error in the section |
| Follow-ups panel | Hidden when zero rows | Skeleton table | Inline error row at top |
| Digest preview | Empty preview = "No data in this period" inside the iframe | Spinner inside iframe | Red banner above iframe, content area shows the actual error |
| Calls list | "No calls today — your AI is waiting" | Skeleton rows | Top banner + Retry; rows preserved |

Loading rule: **always render the page chrome immediately**. Data panels can spin; the layout cannot.

Error rule: **never lose user input on error**. Add-client wizard especially — every step must round-trip safely.

---

## 7. Email & SMS templates (the surfaces outside the dashboard)

These are first-class UX, not afterthoughts.

### 7.1 Digest email (built — `lib/owner-digest.ts`)

Already specced. UX checklist:
- Subject ≤ 60 chars, leads with the win.
- Plain-text fallback exists.
- White-labeled From (`Agency Name <contact@agency.com>`).
- Mobile-first layout (single column, KPI tiles re-flow to 1×6 on mobile).
- Footer: "Prepared by {agency}" + reply-to mailto.
- No tracking pixels at v1.0 (privacy + spam score).

### 7.2 Post-call SMS templates (built — `lib/post-call-followup.ts`)

| Template | Trigger | Body voice |
|---|---|---|
| `post_call_closer_alert` | `next_action=transfer_to_closer` | Short, urgent — "specialist will call within the hour" |
| `post_call_callback` | `schedule_callback` | Apologetic, asks for a time |
| `post_call_estimate` | `schedule_estimate` | Practical, asks for a day |
| `post_call_consultation` | `schedule_consultation` | Soft, asks for a time |
| `post_call_quote` | `send_quote_sms` | Brief, promises a written quote |
| `post_call_information` | `send_information_sms` | Recap + link, longest delay |

UX rules:
- Always end with `Reply STOP to opt out.` (already enforced in templates).
- First name only — never `{full_name}`.
- Business name verbatim from KB.
- Schedule delay > 30s so the caller hangs up first; never SMS while still on the line.
- Per-tenant kill switch: `tenants.settings.post_call_followups_disabled = true`.

### 7.3 Voice persona (across all packs)

Voice cloning of real employees is **explicitly disallowed** (PRD §4). Personas are named (Marcus, Lena, Claire, Ryan) so callers don't expect the human.

---

## 8. Visual language (kept loose for design)

These are constraints for design, not a finished system.

| Element | Constraint |
|---|---|
| Type | System default sans (Inter / -apple-system); body 14px, headings up to 24px. No webfonts at v1.0. |
| Color | Greys for chrome; **blue** = agency / qualified; **green** = booked / revenue; **amber** = honest decline; **red** = blocked / hot lead. Each agency overrides primary color via branding. |
| Density | Compact-by-default. Operators scan dozens of clients/calls; whitespace fights them. |
| Motion | None except inline progress bars on signup-success. No micro-animations on data changes. |
| Dark mode | Required — every existing page already supports `dark:` Tailwind variants; new screens must too. |
| Iconography | Lucide-react only (already in deps). |

---

## 9. What we have vs what's missing

Status as of 2026-05-08:

### Built (v1.0 surfaces, in code today)
- `/signup` + `/signup/success`
- `/dashboard/agency` with KPI tiles, client cards, follow-ups panel, digest modal
- `/dashboard/[tenantSlug]/packs` with install + credentials + compliance gates tile
- `/dashboard/[tenantSlug]/calls` (existing; needs the polish in §4.5)
- Digest email template + Resend send
- Post-call SMS templates

### Built but underweight (refine in M2 / Sprint 5)
- `/dashboard/[tenantSlug]/handoff` (queue, not feed — §4.6)
- `/dashboard/[tenantSlug]/compliance` (export missing — §4.7)
- `/dashboard/[tenantSlug]/calls` detail view (lead-score breakdown missing)

### Not built (v1.0 / Sprint 5+ scope)
- `/login` (today auth is API-only — UI required)
- `/dashboard/agency/[clientId]` per-client agency view (today drills to tenant home)
- `/dashboard/agency/settings` (branding / team / billing)
- `/dashboard/agency/add-client` 6-step wizard (today is a 3-field modal)
- `/dashboard/[tenantSlug]/digests` (today only the agency-side modal exists)
- `/owner/[token]` SMB owner portal
- Phone-number provisioning UX inside the wizard
- Test-call widget inside the wizard (page widget exists at `/`, needs reuse)

### Marketing / public

- `/` is currently a Calendly + Upwork dev-tools page — must be replaced with the agency-pitch landing for v1.0.

---

## 10. Open questions for design review

Things to bring to a designer; don't pre-decide alone:

1. **Logo placement on the digest** — left-aligned with brand color band? Center? Below subject? Affects perceived white-label depth.
2. **Lead-score badge shape** — pill (current), donut, or sparkline-style mini-chart? Operator scannability matters more than precision.
3. **Add-client wizard — vertical or horizontal stepper?** Verticals waste real-estate; horizontals lose context. Hybrid (left-rail outline + main panel) is conventional but verbose.
4. **Owner portal access** — token-only URL forever, or upgrade to email magic-link login over time? Token is simpler, but tokens leak.
5. **Compliance gate pill in the agency header** — should it be omnipresent, or only when a hit happened today? The argument for omnipresent is "we never silence compliance"; the counter is signal-to-noise.
6. **Test-call widget on the wizard** — embed the existing `/`-page widget, or build a wizard-specific minimal one? The existing one captures more PII (good for sales context, bad for self-serve).

---

## 11. Acceptance criteria (per surface)

What "done" means for each new surface so dev can self-check.

| Surface | Done when |
|---|---|
| `/login` | Email magic-link works end-to-end against Resend; rate-limited per email; surface returns to original deep-link after auth |
| `/dashboard/agency/[clientId]` | All 7 sections render real data; sticky right rail works on desktop ≥ 1280px |
| `/dashboard/agency/settings` (branding) | Logo uploads to Supabase storage; primary color persists; live digest preview reflects changes within 1s |
| `/dashboard/agency/team` | Invite email lands ≤ 60s; pending invite shows in list; accepted invite grants role on next login |
| `/dashboard/agency/add-client` | Time-to-completion ≤ 8 min for a savvy operator; "Save as draft" on every step preserves all input; activate disabled until test call succeeds |
| `/dashboard/[tenantSlug]/digests` | Add subscription survives page reload; preview iframe matches what Resend sends to within whitespace |
| `/owner/[token]` | Token expires in 30d; expired token shows clean "ask your agency for a new link" page; HIPAA-tagged tenants hide transcripts by default |
| `/` (public landing) | Time-to-CTA ≤ 5s on a cold load; one primary CTA above the fold |

---

## 12. Roadmap mapping

How this UX spec aligns with `PRD.md` sprints:

| PRD Sprint | UX surfaces in this doc |
|---|---|
| Sprint 1 (built) | `/dashboard/agency` home (§4.1) |
| Sprint 2 (built) | Lead-score badge + follow-up panel (§5, §4.1) |
| Sprint 3 (built) | Digest email (§7.1) + digest modal (§4.1) |
| Sprint 4 (built) | `/signup` + `/signup/success` (§3.1 steps 1–3) |
| **Sprint 5** | `/dashboard/agency/add-client` wizard (§3.1 step 5), `/login`, `/dashboard/agency/settings` |
| **Sprint 6** | `/owner/[token]` portal (§3.5, §4.9) |
| M2 hardening | Compliance export (§4.7), call detail polish (§4.5) |
| M3 differentiators | Whisper coach UI, branded calling settings, white-label deepening |

---

## 13. Out of scope for v1.0 (UX-specifically)

- Drag-and-drop flow editor improvements (existing `/dashboard/[tenantSlug]/flows` is sufficient).
- Custom email template editor for digests (built-in template only at v1.0).
- Mobile app — responsive web is good enough.
- Accessibility audit beyond keyboard navigation + dark mode (full WCAG audit at v1.0 launch checklist, not here).
- Internationalization beyond English/Spanish in voice (UI is English-only at v1.0).
