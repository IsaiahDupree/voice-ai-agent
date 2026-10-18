# Industry Packs — Architecture & Roadmap

**Status:** Design / North Star
**Last updated:** 2026-05-02
**Owner:** @IsaiahDupree

## Why this exists

Today, onboarding a new client means hand-authoring a persona, a flow, a knowledge base, and an integration set. That's per-client custom work that doesn't compound. We have ~70% of the modular bones already in place (tenant-scoped flows, KB/RAG, MCP registry, persona variable system, 5 starter templates) — they just aren't glued together as installable units.

**Goal:** A new client picks an **Industry Pack** ("Dental Clinic", "Vet Clinic", "Car Dealership", "Law Firm", "Restaurant", "Home Services"), fills in their KB fields, connects integrations, and goes live in hours — not weeks. Same codebase serves every vertical.

## Core primitive: the Industry Pack

A pack is a versioned, installable bundle:

```ts
{
  id: "uuid",
  slug: "vet_clinic",
  name: "Vet Clinic Receptionist",
  version: "1.0.0",
  compliance_profile_id: "veterinary",
  persona_template_id: "...",      // base prompt + voice + temperature
  flow_template_id: "...",         // ReactFlow JSON template
  kb_schema: {                     // required tenant-supplied fields
    services_offered: { type: "string[]", required: true },
    insurance_accepted: { type: "string[]" },
    hours: { type: "weekly_schedule", required: true },
    emergency_routing_number: { type: "phone", required: true }
  },
  tool_subset: ["checkCalendar", "bookAppointment", "createRefillRequest", "escalateEmergency"],
  required_integrations: ["calendar", "sms"],
  optional_integrations: ["pims_ezyvet", "pims_cornerstone"],
  default_voice_profile: { voice_id: "...", temperature: 0.4 }
}
```

When a tenant installs a pack, we materialize a `tenant_pack_installs` row carrying their `kb_values` and `integration_map` (which concrete provider satisfies each required integration). The runtime resolves persona + flow + tools by reading the tenant install, never the global pack directly — so packs can be upgraded without breaking existing tenants.

## Schema additions

```sql
-- Compliance profiles (HIPAA, TCPA, CCPA, GLBA, veterinary, dealership, etc.)
compliance_profiles (
  id, slug, name,
  flags JSONB,                     -- { hipaa: true, recording_disclosure_required: true, ... }
  disclosure_templates JSONB,      -- per-language opener text
  blocked_phrases JSONB,           -- never-say list (e.g. "your pet has ___")
  required_disclosures JSONB
)

industry_packs (
  id, slug UNIQUE, name, version,
  compliance_profile_id REFERENCES compliance_profiles,
  persona_template_id REFERENCES persona_templates,
  flow_template_id REFERENCES conversation_flows,    -- is_template=true
  kb_schema JSONB,
  tool_subset JSONB,
  required_integrations TEXT[],
  optional_integrations TEXT[],
  default_voice_profile JSONB,
  created_at, updated_at
)

tenant_pack_installs (
  id, tenant_id, pack_id, pack_version,
  kb_values JSONB,                 -- the tenant's filled-in KB
  integration_map JSONB,           -- { "calendar": "cal_com", "sms": "twilio", "pims": "ezyvet" }
  status TEXT,                     -- draft | active | suspended
  installed_at, activated_at,
  UNIQUE(tenant_id, pack_id)
)
```

## Provider adapter layer (`lib/providers/`)

Pack tools must not hardcode Cal.com, Twilio, or OpenAI. Instead, each tool resolves its provider via the tenant's `integration_map`:

```ts
interface CalendarProvider {
  listSlots(opts): Promise<Slot[]>;
  bookSlot(opts): Promise<Booking>;
  cancelBooking(id): Promise<void>;
}

// Adapters
class CalComCalendar implements CalendarProvider { ... }
class CalendlyCalendar implements CalendarProvider { ... }
class ClioCalendar implements CalendarProvider { ... }       // legal
class OpenTableCalendar implements CalendarProvider { ... }  // restaurants
class EzyVetCalendar implements CalendarProvider { ... }     // vet
```

Same pattern for `CRMProvider`, `SMSProvider`, `LLMProvider`. The function-tools registry annotates each tool with the provider category it needs; the runtime injects the right adapter at call time.

## Build phases (in order — earlier work unblocks later)

### Phase 1 — Foundation
1. Schema cleanup: standardize `tenant_id` everywhere (esp. `contacts`, `personas` — currently inconsistent with `org_id`).
2. Create `compliance_profiles` table + seed HIPAA / TCPA / veterinary / dealership profiles.
3. Create `industry_packs` + `tenant_pack_installs` tables.

### Phase 2 — Provider abstraction
4. Extract `CalendarProvider` interface; refactor existing Cal.com client behind it; add Calendly adapter.
5. Extract `LLMProvider` interface (router for GPT-4o / Claude per pack default).
6. Refactor `lib/function-tools.ts` into a registry with provider metadata so tools resolve to the right adapter.

### Phase 3 — Pack authoring (the actual product)
7. Pack installer service: clones flow template + persona + KB schema into tenant scope, validates required integrations are connected, materializes `tenant_pack_installs` row.
8. Build reference packs in 3 wedge tiers:

   **Tier A — Fast-launch wedge (low compliance, days to onboard):**
   - **Salon / Barbershop** — booth-renter routing, real-time chair, color-bucket clarification
   - **Restaurant** — peak-hour concurrency, multilingual, allergen safety
   - **Fitness / Gym / Studio** — cancellation/freeze first-class, intro-to-paying conversion
   - **Home Services** — dispatch routing, mid-call SMS photos, life-safety interrupts
   - **Auto Repair** — DVI authorization artifact, "is my car ready?" deflection, mileage-based reminders
   - **Pet Services (Grooming/Boarding)** — vaccine gating, holiday surge mode, mobile route optimization
   - **Moving Company** — speed-to-lead webhook, FMCSA written-estimate gate, virtual survey
   - **Self-Storage** — state lien matrix, gate-code ledger lookup, delinquency outbound
   - **Cleaning Service** — trust-as-product, frictionless skip, three-intake fork, key/lockbox crisis path
   - **Pest Control** — EPA reentry interval verbatim, WDO real-estate-tied deadlines, treatment-guarantee verification
   - **Locksmith** — duress-vertical trust signals, anti-scam refusal scripts, four-intake fork
   - **Towing** — stranded-driver safety overlay, PPI hostile-call discipline, per-county rate cap matrix

   **Tier B — Sweet-spot (recurring recall economics, HIPAA premium):**
   - **Dental Clinic** — HIPAA, PMS-native scheduling, insurance verification, perio vs prophy recall
   - **Vet Clinic** — emergency triage, PIMS integrations, three-agent suite
   - **Med Spa** — vascular occlusion code-red, in-call deposits, GLP-1, 84-day Botox recall
   - **Chiropractic** — PI lien intake, Medicare manipulation-only, care-plan cadence rescue
   - **Physical Therapy** — direct-access state matrix, plan-of-care chase, cancel-recovery as headline ROI
   - **Optometry** — Q4 vision-benefit cliff, FCLCA 8-hour clock, dilation chair time, optical attach
   - **Childcare** — waitlist-as-inventory, mandatory reporter, state-ratio capacity
   - **Education / Tutoring** — assessment-as-sale, parent-as-caller, test-date calendar
   - **Wedding / Event Venue** — tour-as-funnel, contract-deadline outbound, preferred-vendor margin

   **Tier C — Enterprise (regulated, high-ACV, longest sales cycle):**
   - **Car Dealership** — TCPA-heavy outbound, DMS integrations, pricing-claim guardrails
   - **Legal Intake** — UPL classifier, conflict checks, fee-split compliance
   - **Insurance Agency** — stacked mid-call compliance, RND pre-outbound, carrier-appointment gating
   - **Mortgage** — per-utterance NMLS gating, TRID 6-piece trap, RESPA-shaped pricing
   - **CPA / Accounting** — Q1 burst pricing, audit-client independence, document chase
   - **Real Estate** — Fair Housing, NAR settlement, procuring cause
   - **Funeral Home** — FTC Funeral Rule price disclosure, first-call transport dispatch, emotional voice persona
   - **Behavioral Health** — 988/911 hard battery, 42 CFR Part 2, EAP firewall, PsyPact compacts
   - **OB/GYN** — 24/7 on-call, two-patient triage, IVF hour-precise, post-Dobbs state matrix
   - **Solar Installer** — milestone cadence as product, NEM 3.0 disclosure, distressed-industry trust opener
   - **Urgent Care** — wait-time deflection, ER-vs-UC triage (incentive-opposed), occ-health embedded B2B
   - **Plastic Surgery** — three-calendar OR booking, financing cascade as conversion, complication protocols
   - **Tax Resolution** — outcome-claim classifier, vulnerable-consumer handler, AG-subpoena-ready records

   **Tier D — B2B (different consumer model — buyer ≠ caller):**
   - **Medical Billing / RCM** — outbound IS the product, IVR-navigation library moat, per-resolved-claim pricing, 3-deep BAA chain
   - **MSP / IT Services** — multi-tenant compliance switching (hardest), password-reset deflection wedge, P1 sub-60s contracted SLA
9. Pack management UI: browse → install → fill KB fields → connect integrations → activate.

### Phase 4 — Polish
10. Pack versioning + migration path so existing installs can upgrade safely.
11. Marketplace / pack sharing between tenants.

## Reference pack: Vet Clinic (sketch)

- **Compliance profile:** veterinary — never diagnose, never adjust dosage, AVMA telehealth boundaries; teletriage allowed.
- **Three sub-agents:** Receptionist, Care Coordinator, Growth.
- **Required integrations:** calendar, SMS. **Optional:** PIMS (ezyVet, Cornerstone, AVImark, IDEXX Neo, Shepherd, Pulse).
- **Critical tool:** `escalateEmergency` — screen for red flags (breathing, collapse, seizure, bleeding), do NOT diagnose, route to clinic team or nearest emergency hospital.
- **ROI table:** `call_outcomes` — booked / confirmed / rescheduled / refill created / emergency escalated / review requested / missed-call recovered / revenue estimate.
- **Pricing tiers:** Starter $497, Growth $997, Clinic Pro $1,500–$2,500/mo + $750–$2,500 setup.

## Reference pack: Car Dealership (sketch)

- **Compliance profile:** dealership — TCPA (FCC: AI voices = "artificial or prerecorded voice", consent required for outbound), FTC pricing-claim rules (no inventing discounts/APRs/payments, mandatory fees included).
- **Departments:** Sales, Service, Parts, Finance, Trade-in, After-hours, Missed-call recovery.
- **Required integrations:** calendar, SMS, CRM. **Optional:** DMS adapters (VinSolutions, DealerSocket, Elead, CDK, Reynolds, Dealertrack).
- **Hard guardrails:** quote prices only from approved inventory feed; "estimated" qualifier on all numbers; escalate financing/trade appraisal/negotiation to human; default opener with recording disclosure; honor opt-outs immediately; internal DNC list; never impersonate real employees.
- **Wedge offer:** 30-Day AI Call Recovery Pilot — $1,500 setup + $1,500 / 30 days → convert $2,500–$4,000/mo.

## Reference pack: Dental Clinic (sketch)

- **Compliance profile:** `hipaa_dental` — full BAA chain, transcripts treated as PHI (encrypted, access-scoped, retention policy), zero-retention LLM tier mandatory, identity verification before disclosing any PHI, two-party-consent state matrix for recording.
- **Hero capability:** **insurance verification** — Stedi 270/271 eligibility checks against Delta Dental / Aetna / Cigna / MetLife at intake; saves 15–30 min per new patient and is a primary price-justifier.
- **Recall sophistication (the wedge vs generic tools):** distinguish **prophy recall (6-mo, D1110)** from **perio maintenance (3–4-mo, D4910)** — interval read per-patient from PMS, segmented campaigns. Add Q4 insurance-max reminder and unscheduled-treatment-dollars chase.
- **Required integrations:** PMS scheduler (the source of truth — NOT Cal.com). Ship Open Dental first (best API + BAA). Then Dentrix Ascend, Curve, Denticon, CareStack.
- **Emergency triage is life-critical:** Ludwig's angina → 911; avulsed tooth → 60-min reimplant window. Never diagnose; route + escalate.
- **Pricing tiers:** $597 / $1,497 / $2,997 mo. Justified by recovered new-patient call = $850 immediate / $4,500–$22K LTV.

## Reference pack: Legal Intake (sketch)

- **Compliance profile:** `legal_intake` — UPL guardrail enforced as a **server-side classifier (second gate beyond the system prompt)** that blocks "do I have a case / what's it worth / interpret SOL" responses. ABA Model Rule 5.5 / 5.3 + Formal Opinion on nonlawyer intake.
- **Pre-intake blocking step:** **conflict check** against PMS (Clio / Filevine / MyCase / PracticePanther / Lawmatics / Smokeball) — fuzzy match on caller + opposing party + other parties **before any case facts are taken**. Critically, **never reveal *why* a conflict exists** (that itself breaches confidentiality).
- **TCPA exposure is existential:** $500–$1,500/call statutory damages on AI-voice outbound to cells without prior express written consent. Mass-tort lead vendors must hand over consent artifacts (timestamp, IP, language, URL); platform must store them. → **lifts to platform layer, not pack layer.**
- **Recording:** transcripts likely privileged from call start → 7+ year retention aligned to firm matter policy, scoped access, recording disclosures in 12+ two-party-consent states.
- **Lead value 10–100x:** signed PI retainer = $5K–$50K+; mass-tort retainer = $1.5K–$5K × volume. Justifies $5K–$15K/mo pricing. Success-fee bonuses must be **fixed intake-service fees, NOT percentages of legal fees** (Model Rule 5.4 forbids fee-splitting with non-lawyers).

## Reference pack: Home Services (sketch)

- **Compliance profile:** `home_services` — TCPA for outbound membership renewals; recorded acknowledgement of dispatch fee ($89–$300 trip charge); never promise parts on truck.
- **Hero capability:** **address-to-tech dispatch routing** — every call needs geographic + on-call + skill matching. (Vet has one location; this is its own resolver.)
- **Mid-call SMS photo intake** — agent texts a link for data-plate / leak / panel photos before dispatch; eliminates wasted truck rolls. Generalize this primitive.
- **Membership/maintenance plans = recurring-revenue lever** ($180–$400/yr/customer). Renewal outbound is the LTV core.
- **Life-safety carve-out scripts (non-skippable):** gas smell / CO / electrical fire → route to 911 / utility BEFORE scheduling. Hard-coded interrupt, not LLM-decided.
- **Required integrations:** FSM/dispatch — ServiceTitan (enterprise), Housecall Pro / Jobber / Workiz / FieldEdge / Service Fusion (SMB), Zapier fallback.
- **Ticket sizes:** emergency plumbing $500–$2K; HVAC install $5–15K; roof replace $8–30K.

## Reference pack: Restaurant (sketch)

- **Compliance profile:** `restaurant` — minimal regulatory load BUT **allergen safety = legal liability** (CA SB 68, NY law, FDA Big 9). Pattern: "flag + transfer," **never confirm safety** (the vet-equivalent of "don't diagnose").
- **Hero capability:** **peak-hour concurrency** — 60–70% of calls hit Fri/Sat 5–9pm. Flat-rate concurrent-call pricing crushes per-minute competitors. **Lifts to platform pricing model, not just per-pack.**
- **Multilingual is table stakes** — Spanish-first in TX/CA/FL/NV (20–40% of takeout). Slang/Hostie/RestoHost all advertise it.
- **Catering is the hidden goldmine** — host-stand staff under-qualify $1K–$10K catering tickets; structured AI intake + 5-min routing unlocks them.
- **Reservation-platform churn (2026):** OpenTable forcing primary-system commitment; Tock folding into Resy (Amex); SevenRooms under DoorDash ($1.2B). **Adapter-agnostic design is mandatory.**
- **Pricing tiers (anchored to Slang.ai $399/$599, Kea ~$450, SoundHound enterprise $10K+):** Starter $299 / Growth $599 / Pro $999–1,499 / Multi-loc $2,500–6,000.

## Reference pack: Med Spa / Aesthetic Clinic (sketch)

- **Compliance profile:** `medspa` — HIPAA-lite for treatment data, **photos are first-class PHI** (no plain SMS/MMS — encrypted upload only; marketing-use consent captured separately from treatment consent).
- **Code-red:** **vascular occlusion** post-filler (blanching / disproportionate pain / livedo / vision change within 14 days) → immediate same-injector page + ER routing for vision symptoms; minutes-to-hours hyaluronidase reversal window. Med spa's Ludwig's-angina equivalent.
- **In-call deposit collection is table-stakes** — Stripe payment-link mid-conversation for $50–$200 hold; recovered no-show deposits are the most defensible ROI line.
- **GLP-1 intake (huge 2026 surface):** structured screening (BMI, MTC/MEN-2, pancreatitis, pregnancy contraindications), state-licensure gating for telehealth prescribers, brand-vs-compounded pricing — never appears to prescribe.
- **Botox 12-week (84-day) recall is the franchise economic engine** — 60–70% retention with vs 30–40% without. Plus consult-vs-treatment routing as primary intake gate.
- **Required integrations:** Aesthetic Record / Boulevard / Mangomint / Vagaro / Nextech / Symplast / Zenoti / PatientNow scheduler + Stripe payment links + Allē / ASPIRE rewards lookups.

## Reference pack: Real Estate (sketch)

- **Compliance profile:** `real_estate` — **Fair Housing Act is existential** (HUD 2024/2025 guidance explicitly covers AI chatbots). Every utterance in scope: no steering, no demographic-adjacent questions, no source-of-income proxies. Dealership has no analog.
- **NAR settlement (post-Aug 2024):** buyer commission cannot be quoted from MLS; written buyer-rep agreement required **before first tour** — AI booking a showing must verify the agreement exists.
- **Procuring cause:** mandatory "are you working with an agent?" gate before booking; getting it wrong creates inter-agent commission lawsuits.
- **Showing logistics are multi-system** (ShowingTime / BrokerBay / Aligned + SentriLock / Supra lockboxes + seller windows) and **none expose clean public APIs** — bridge layer required.
- **MLS via RESO Web API** (shared infrastructure, not a closed DMS) — per-MLS onboarding/approval cost replaces per-vendor DMS integration.
- **Ship as ONE pack** with sales-side and property-mgmt personas (not two packs). Shared core (Fair Housing, TCPA, after-hours, IDX) outweighs persona divergence; carve a stripped PM-only SKU only for pure-PM shops (e.g., AppFolio).
- **Required integrations:** RESO Web API (MLS/IDX), CRM (Follow Up Boss / kvCORE / Sierra / BoomTown / Lofty), property mgmt (AppFolio / Buildium / Yardi / DoorLoop), showing systems.

## Reference pack: Fitness / Gym / Studio (sketch)

- **Compliance profile:** `fitness` — **cancellation must be EASIER than signup by law** (CA 5-day, NY 3-day, FL Ch.559, FTC ROSCA, LA Fitness enforcement). Inverts the SaaS save-loop playbook — pack ships **one-attempt-save rule** + state-rules engine + written confirmation. Class-action defensibility moat.
- **Freeze-vs-cancel as separate intent class** — ~40% of "cancel" calls are really "life happened." Offering freeze ONCE recovers 25–40% of cancels into preserved MRR. No restaurant analog.
- **Intro-to-paying conversion IS the economic model** — 30–50% benchmark; conversion happens by phone in the 3 days before intro expires. Highest-revenue outbound campaign in the entire pack catalog.
- **Attendance-decay outbound** ("the call they didn't make") — predictable churn signal from check-in data; ~20% recovery rate. Requires Mindbody/Wodify attendance sync.
- **One pack, two configs** (boutique vs premium) — premium *guards* pricing for in-person tour close, boutique volunteers it freely.
- **Required integrations:** Mindbody / ClassPass / Glofox / Wodify (CrossFit) / Push Press / Mariana Tek / Zen Planner / Pike13 / ABC Fitness Solutions / Trainerize.

## Reference pack: Insurance Agency (sketch)

- **Compliance profile:** `insurance` — **stacked per call type within the same phone tree**. Same agency may switch between TCPA-only / CMS Medicare TPMO / ACA enrollment / state two-party-consent profiles based on first-utterance LOB classification. **Recording retention class is per-recording, not per-tenant** (CMS phasing 10y → 6y with audio Y1–3, audio-or-transcript Y4–6).
- **RND as a blocking pre-outbound step** — every dial requires a fresh FCC Reassigned Numbers Database query for safe harbor; 50% YoY litigation jump in 2025; pack stores query timestamp + result with the consent artifact.
- **Carrier-appointment gating** — `appointments(agency × carrier × state × LOB × status)` table determines what AI may quote/discuss. The insurance equivalent of a legal conflict check, but **per-state per-product**.
- **SOA-before-substance for Medicare** — electronic Scope of Appointment captured **before any plan-benefits talk**; 48-hour rule applies until Oct 1, 2026 (eliminated in CY2027 final rule). TPMO disclaimer moved from "first minute" to "before benefits" — pack must match new placement. AEP (Oct 15–Dec 7) and MA-OEP (Jan 1–Mar 31) drive 5–10× volume spikes.
- **Hard personal-vs-commercial-vs-life-vs-Medicare split** — four different scripts, integrations (EZLynx Rater / Tarmika / Sunfire), producer-licensing checks; pricing diverges sharply (Medicare per-enrollment add-on vs commercial flat-only).
- **Required integrations:** AMS (Applied Epic / EZLynx / AMS360 / HawkSoft / NowCerts / QQ Catalyst / AgencyZoom) + raters + carrier portals + Medicare quoting (Sunfire / Connecture).

## Reference pack: Mortgage Lender / Broker (sketch)

- **Compliance profile:** `mortgage` — NMLS / SAFE Act, TRID, RESPA Section 8, MAP Rule, TCPA, federal Trigger-Lead Restrictions (HBPPA, post-Dec 2024).
- **NMLS-as-feature-flag at the per-utterance level** — even stricter than insurance carrier-appointments. *Any* rate / APR / payment word from a non-MLO breaches SAFE Act → AI is permanently demoted to admin-support of the named licensed MLO. Pack ships a per-utterance NMLS classifier as a hard gate.
- **TRID 6-piece "application" trap** — AI deliberately stops at 5-of-6 (no SSN solicitation) to avoid silently triggering the 3-business-day Loan Estimate clock. SSN volunteered = clock starts, file flagged, LO paged.
- **RESPA Section 8 reshapes pricing** — no per-funded-loan, no revshare. Only flat SaaS + per-completed-intake (services-performed) bands. Kills the obvious "% of funded volume" model.
- **Trigger-lead / HBPPA layer** — per-call consent-artifact verification naming our specific lender; generic "marketing partners" consent is dead.
- **Sub-60-second speed-to-lead is the ROI thesis** (vs insurance's after-hours-recovery thesis) — 390% conversion lift is the wedge metric. Mortgage is uniquely velocity-driven against Rocket/UWM.
- **Required integrations:** LOS (Encompass / BytePro / Calyx / LendingPad / MeridianLink) + POS (Blend / Maxwell / BeSmartee / SimpleNexus / Floify) + Surefire CRM.

## Reference pack: CPA / Accounting Firm (sketch)

- **Compliance profile:** `cpa_accounting` — AICPA Code of Professional Conduct (confidentiality, independence), IRS Circular 230, GLBA / FTC Safeguards Rule (most firms don't realize it applies — sells SOC 2 + WISP-support as differentiator).
- **Document collection IS the product.** Call ends weeks later when last K-1 hits the portal + 8879 signed. Chase cadence (text d7 / AI call d14 / preparer d21 / extension d30) is the real billable feature.
- **5–10x Q1 concurrency for 90 straight days** — most extreme seasonal burst in any pack. Forces capacity-band pricing with explicit Jan–Apr burst rider, not flat-per-call (firms can't budget that).
- **Audit-client independence is a hard AI-scope gate.** `attest_client_flag` from the PMS must block any advisory/CAS/tax pitch to attest clients or the firm loses independence on $50K–$500K engagements. Legal conflict-check is binary; this is graduated and partner-mediated.
- **Deadline-driven outbound is compliance, not marketing** — Mar 15 / Apr 15 / Sep 15 / Oct 15 / Jan 31 missed = client penalty + interest = churn. Cadence is non-negotiable.
- **IRS notice triage** is a unique high-emotion inbound lane with hard 30/60/90-day clocks — no clean legal analog.
- **Required integrations:** Karbon / Canopy / TaxDome / Jetpack Workflow + tax software (Lacerte / ProConnect / UltraTax / Drake) + portals (TaxDome / SmartVault / ShareFile) + e-sign.

## Reference pack: Education / Tutoring / Test Prep (sketch)

- **Compliance profile:** `education` — COPPA, FERPA, parental consent, mandatory reporter rules, minor-on-premises duty.
- **Parent-as-caller / child-as-subject split** — every call is a fiduciary acting for a COPPA/FERPA-protected minor. Identity verification + authorized-contacts model + custody flags are first-class. No fitness analog.
- **Assessment IS the sale, not a sample** — diagnostic produces a custom plan; conversion happens on a T+1 outbound call after assessment, not the call that books it. Pack ships a "close-the-assessment" playbook as the wedge.
- **Term/season cadence + test-date calendar** — back-to-school 60% surge, AP-May, SAT/ACT 90-day countdowns, summer-program Feb push. Calendar-aware outbound vs fitness's continuous attendance loop.
- **Admissions = 6–12 month sales cycle** — multi-quarter nurture from inquiry → tour → application → decision → yield. Generic "book it now" AI dies; private-K-12 tier guards tuition like premium-fitness guards pricing.
- **Mandatory-reporter escalation pathway** — disclosures of abuse / self-harm → immediate director routing with verbatim log; AI never engages substantively.
- **Required integrations:** Oases / TutorBird / TutorCruncher / TutorPanel / Teachworks / Teach 'n Go + Sawyer / Jackrabbit (kids activities crossover) + LMS where applicable.

## Reference pack: Childcare / Daycare / Preschool (sketch)

- **Compliance profile:** `childcare` — COPPA, state licensing variability, BIPA (IL face-recog check-in), mandatory reporter, custody-dispute guards, immunization records, food allergies.
- **Waitlist IS the inventory** — age-room seats rationed by state ratio with cascade-to-next-family logic on spot-opens (most centers leak 30–50% of opened spots). The pack's recovery of leaked spots is the headline ROI.
- **Mandatory reporter duty** — affirmative legal obligation. AI must capture verbatim, never investigate, never suppress, page director on dedicated channel, permanent retention on `mandatory_reporter_triggered` flag.
- **Sick-call triage = exclusion-policy logic, not medical advice** — outputs estimated return date from state health-dept rule + center policy (stricter), not a clinical urgency tier.
- **Authorized-pickup list is a hard guardrail** — never modifiable by voice (custody-dispute attack vector). Requires written confirmation via parent app or signed form.
- **Capacity computed against state child:teacher ratio per age room**, not licensed cap. Pack ships a per-state config table (ratios, exclusion days, immunization schedule, reporter timeline, biometric consent rules).
- **Required integrations:** Brightwheel / Procare / KangarooTime / Lillio (HiMama) / ChildcareCRM / Smartcare / Kinside.

## Reference pack: Salon / Barbershop / Beauty (sketch)

- **Compliance profile:** `salon` — minimal regulatory load (patch-test disclosure for color allergies, cancellation policy enforcement). **Fastest-onboarding pack** — no HIPAA, no BAAs, plain MMS for inspo photos OK; days not weeks to launch. Self-serve-friendly tier with lower setup fee.
- **Booth-renter vs commission is foundational config** — encode `stylist_employment` per-stylist. Calling a 1099 booth-renter's clients on behalf of the shop = **tortious interference**. Med spa is uniformly W-2 under one entity; salon isn't.
- **"Request your stylist" is the dominant intent (60–75% of calls)** — phone-match → last-stylist lookup → default same stylist + same service in turn 1. Routing to alternate requires explicit caveat.
- **Walk-in availability = real-time chair status, not calendar peek** — Sport Clips Online Check-In / Great Clips ReadyNext / Booksy Boost queue. Wrong ETA = furious customer at the door. No medspa analog.
- **"Color" hides 6+ duration buckets** — root touch-up 90min vs balayage 4hr vs color correction 6hr. Mis-booking cascades cancels all day. Pack must clarify (last color date, current color, length) before slotting.
- **Required integrations:** Booksy / Square Appointments / Vagaro / Mindbody / Fresha / Boulevard / Mangomint / GlossGenius / StyleSeat / Schedulicity.

## Reference pack: Chiropractic Clinic (sketch)

- **Compliance profile:** `chiropractic` — HIPAA + PI lien intake (LOR/HIPAA-auth gate before record release) + Medicare manipulation-only (CMT-only coverage 98940/41/42 + AT modifier; ABN intent for everything else).
- **PI lien attorney workflow:** lien-agreement SMS intake, PIP/med-pay capture, attorney/WC-adjuster verification, treatment-gap warnings to protect case value. Unique to chiro vs dental.
- **Care-plan visit-cadence rescue IS the retention model** (not 6-month recall). Same-week, 4-hour SLA outbound when a 3x/wk patient misses a visit; pack reads per-patient cadence from PMS.
- **Decompression / laser cash upsells** — $450–$1,800 packages, Stripe checkout via SMS, pure incremental cash with no insurance friction.
- **State-specific WC pre-auth gating** (CA 24-visit cap/MPN, NY MTG, Ohio BWC) blocks scheduling until cleared. PIP verification is phone-call (no Stedi clearinghouse). Jane App has no public API as of 2026 → forces messaging-mode tier.
- **Required integrations:** ChiroTouch / Genesis / Platinum / Jane App / ACOM Health.

## Reference pack: Physical Therapy / Outpatient Rehab (sketch)

- **Compliance profile:** `physical_therapy` — HIPAA + direct-access state matrix + Medicare KX threshold + plan-of-care signing.
- **Direct-access state matrix as runtime gate** — ship `direct_access_matrix.json` (unrestricted / provisional 30-day-or-N-visits / restricted) keyed per-tenant. Effective referral requirement = `state_rule OR payer_rule OR case_type ∈ {WC, MVA, Medicare, Medicaid}`. Wrong rule = unbillable visits.
- **Plan-of-care 30-day MD-signature chase** — autonomous fax/portal/call escalation on day 7/14/21/25/28. Chiros self-certify; PTs cannot. Direct revenue-protection feature.
- **Cancel-recovery is THE headline ROI** — PT has worst no-shows in healthcare (25–30%); 200-visit/wk clinic recovers ~$12K/mo. Whole sales motion centers on this single number.
- **Medicare KX threshold tracker** — per-patient YTD $ tracking against $2,410 threshold; patient notification within $80 of cap; dashboard alert for KX modifier append.
- **Voice-AI competitive vacuum** — incumbents are SMS-blast tools (WebPT Reach, Raintree TouchPoint, Luna), not conversational AI. Real first-mover positioning.
- **Required integrations:** WebPT / Prompt EMR / Raintree / Net Health / Clinicient / Heno / Jane App.

## Reference pack: Auto Repair Shop (sketch)

- **Compliance profile:** `auto_repair` — BAR-style state laws require recorded customer pre-authorization above the original estimate.
- **DVI approval = legal compliance artifact, not sales follow-up.** Pack produces a court-defensible audio + transcript + line-item record (`dvi_authorizations` table, 7-yr retention). No other pack has this exact shape.
- **"Is my car ready?" deflection is the wedge.** Highest-volume inbound (dozens/day per advisor); 95% deflectable to a live RO-status SMS link from Tekmetric/Shopmonkey/Shop-Ware. Lead the demo with this.
- **Three intake variants** — appointment drop-off / walk-in drop-off / tow-in (with after-hours tow-company + key-drop logistics). Vs home-services' single "schedule a truck roll."
- **Mileage-driven (not calendar) recurring reminders** — 30k/60k/90k requires per-vehicle mileage projection from last RO + miles/month, unlike HVAC's seasonal cadence.
- **Three parallel non-customer billing paths** — fleet (Element/Holman/Wheels), extended warranty (CarShield/Endurance), AAA dispatch — each requires route-to-advisor with claim # capture; agent never authorizes against any of them.
- **Required integrations:** Tekmetric / Shopmonkey / Shop-Ware / Mitchell 1 / AutoLeap / Protractor / RO Writer.

## Reference pack: Pet Grooming / Boarding / Daycare (sketch)

- **Compliance profile:** `pet_services` — vaccine verification gating, behavioral assessment gating, no medical advice.
- **Vaccine record verification IS a hard booking gate** — ~60% of new boarders fail first-attempt (expired bordetella #1). Pack flags `pending_vaccine_verification`, sends SMS upload link, refuses to confirm bookings that don't meet policy. Vet tracks vaccines but doesn't gate booking on them.
- **Holiday boarding surge is a different operating mode** — Christmas/Thanksgiving/July 4 hit 200%+ utilization → reservation-only + 50% non-refundable deposits + 60-day cancel cutoffs + automated capacity-warning outbound at >80% utilization to last-year's customers.
- **Mobile grooming = route optimization, not chair scheduling** — first-class adapter category (MoeGo / Belle / Pawfinity-mobile / Scout): geographic clustering, water/power/parking constraints, time-window quotes, "fill-the-truck" neighbor outbound.
- **Daycare temperament test = HARD prerequisite** blocking all daycare booking until passed; tactful failed-routing to private boarding / 1:1 walks.
- **Breed-specific time + pricing** — Doodle vs Yorkie = 4× time + 3× price; pack asks breed/weight/coat-condition/style; mandatory mat-shave-down disclosure ("you scalped my dog" defense).
- **Required integrations:** Gingr / PetExec / Time To Pet / Kennel Connection / MoeGo / Belle / Scout / Pawfinity / ProPet.

## Reference pack: Funeral Home / Cremation Services (sketch)

- **Compliance profile:** `funeral` — **FTC Funeral Rule REQUIRES itemized phone price disclosure** ($51,744/violation for refusing). Inverts every other regulated pack.
- **First-call is a transport dispatch, not an inquiry.** Closest analog is home-services emergency, but the "asset" is a deceased person with religious urgency windows (Jewish/Muslim 24h) and crew/equipment routing (stairs, weight, coroner case).
- **Voice persona is functionally different** — 15% slower tempo, longer pauses (1.2–1.8s), crying detection with non-advancing script, banned phrases ("better place," "I know how you feel"). Pack-level voice persona tuning, not just voice_id.
- **Right-of-disposition hierarchy replaces medical-style patient verification** — spouse → adult children majority → parents → siblings, varying by state. AI must encode next-of-kin authority, not HIPAA personal-rep rules.
- **Two-mode agent split (at-need vs pre-need)** with totally separate vocabulary, cadence, and escalation. Aftercare outbound (1wk / 1mo / 3mo / 6mo / anniversary) is unique to this vertical.
- **Required integrations:** SRS Computing / Passare / Halcyon / FrontRunner Pro / FuneralTech / Osiris.

## Reference pack: Moving Company (sketch)

- **Compliance profile:** `moving` — FMCSA interstate written-estimate gate, 110% rule, binding/non-binding/GNTE disclosures, per-state PUC (CA double-drive-time, FL DBPR, NY DOT).
- **Speed-to-lead is the killer app, not after-hours dispatch.** $30–150/lead aggregator economics flip the ROI math; product is webhook-ingestion + sub-60-sec outbound callback, not inbound emergency receptionist.
- **FMCSA written-estimate gate forbids voice quoting on interstate** — agent is hard-blocked from binding interstate prices; routes to physical or virtual survey.
- **Virtual survey (Yembo AI / SmartMoving Survey / FaceTime) is the modern default** replacing in-home — pack defaults to same-day virtual; in-home reserved for $10K+ jobs.
- **Extreme May–Sept seasonality (~70% of revenue)** with peak-July "stopped answering the phone" mode → waitlist capture during capacity-locked periods + Oct–April retention/reactivation flip.
- **Claims intake as distinct high-emotion inbound class** — de-escalation script, photo capture via SMS, never admit liability or quote settlement amounts.
- **Required integrations:** SmartMoving / MoversTech CRM / MoveitPro / Network Leads / Movegistics / OnTime + Yembo (virtual survey).

## Reference pack: Self-Storage Facility (sketch)

- **Compliance profile:** `storage` — state lien law matrix (35–90 day windows, notice form, late-fee caps, redemption rules vary wildly), FDCPA-adjacent + state mini-FDCPA (CA Rosenthal / NY / TX), Reg F 7-in-7 caps, mini-Miranda, mandatory tenant protection plan disclosure.
- **State lien law matrix is the central compliance artifact** — pack ships per-state rule object keyed to facility ZIP.
- **Delinquency outbound is regulated** — first-party state mini-FDCPA, identity-verify before disclosing balance, frequency caps.
- **Gate-code/access lookups dominate after-hours volume** — and most "code stopped working" cases are silent overlocks for non-payment, so AI must check ledger before re-issuing. Generic ledger-lookup-before-action primitive.
- **Climate-controlled is the upsell anchor** (anchor on contents, not size). **Auction-eligible callers = hostile-call territory** — de-escalate + route, never negotiate.
- **Required integrations:** storEDGE (Storable) / SiteLink / Easy Storage Solutions / Yardi Storage / Hummingbird + PTI Security (gate access).

## Reference pack: Behavioral Health / Therapy / Counseling (sketch)

- **Compliance profile:** `behavioral_health` — HIPAA + **42 CFR Part 2** (SUD records — stricter than HIPAA, separate consent per disclosure) + 988/911 routing + mandatory reporter + state telehealth licensure compacts (PsyPact / Counseling Compact / Social Work Compact) + EAP confidentiality firewall.
- **988/911 crisis routing is non-skippable** — soft crisis screen on every inbound; warm transfer + connection confirmation + clinical page; **never** "the on-call therapist will call back." Tested as a hard battery before deploy.
- **42 CFR Part 2 mode** for SUD programs — AI cannot confirm patient identity to any caller without Part 2-compliant ROI; default voicemail = no program identification.
- **EAP confidentiality firewall** — employer field is null by design; AI never asks for, records, or reveals employer; only EAP vendor + auth + sessions tracked.
- **PsyPact + compacts drive state-of-presence verification** at every telehealth booking AND session-day reminder; snowbird patients re-verified each session.
- **Sliding-scale + no-show recovery scripts are empathy-mandated** — depression / anxiety / SUD often *cause* the no-show; financial conversations normalized, ranges quoted not single numbers, pro-bono offered.
- **Required integrations:** SimplePractice / TherapyNotes / TheraNest / Sessions Health / Headway / Alma / Grow Therapy / ICANotes / Valant.

## Reference pack: OB/GYN / Women's Health (sketch)

- **Compliance profile:** `obgyn` — HIPAA + **24/7 on-call rotation** + two-patient pregnancy triage + post-Dobbs state matrix + EMTALA-adjacent for hospital-affiliated practices.
- **24/7 on-call rotation as runtime integration** (Amion / QGenda) — page, log, ack-within-SLA tracking, escalate to backup → chair → hospital operator (TJC audit point). No other vertical has this.
- **Two-patient pregnancy triage** — every decision tree weights mom AND fetus; decreased fetal movement, preeclampsia red flags, ROM, preterm labor → unconditional L&D routing; conservative bias is legally required.
- **Hour-precise fertility cycle timing** — LH-surge call (IUI within 24–36hr), trigger-shot timing → retrieval at 36hr exact. Missed call = $1.5–25K cycle loss. **Zero voicemail tolerance** for stim-cycle patients.
- **Post-Dobbs state-by-state policy table** — versioned Guttmacher/KFF-sourced matrix gating what AI can say; TX/AL/MS clinics get fundamentally different scripts than CA/NY for the same caller question. Quarterly counsel review.
- **Postpartum EPDS + 988 routing** — AI administers EPDS over phone; item #10 (suicidal ideation) triggers immediate 988 + on-call page + warm handoff; AI never hangs up, never gates on identity verification.
- **Required integrations:** Athenahealth / eClinicalWorks / NextGen / Epic + Amion / QGenda (call rotation).

## Reference pack: Optometry / Eye Care (sketch)

- **Compliance profile:** `optometry` — HIPAA + Fairness to Contact Lens Consumers Act (FCLCA) + state board prescription release rules.
- **Q4 vision-benefit cliff** — benefits expire on hard calendar Dec 31 (not rolling per-patient max). Compresses use-it-or-lose-it surge into 8–10 weeks; productized as a Q4 Surge add-on SKU.
- **FCLCA 8-business-hour clock** on third-party contact-lens Rx verification — silence = deemed verified = federal liability. Dashboard countdown is a first-class product feature; never auto-verify; never tie release to purchase.
- **Vision-vs-medical insurance routing** by chief complaint — same eyeball, two payers; routine = vision plan, red eye / diabetic / flashes = medical plan. Chief-complaint decision tree is a core flow.
- **90-min dilation hold** — chair time is 25 min but pretest tech battery + dilate-wait + exam + optical handoff = 90 min; schedulers must read room/tech/OD constraints from EHR.
- **Optical dispensary as separate revenue stream** — frame inquiries, warranty, second-pair upsell. Must NOT route into exam-booking flow. Tracked separately as optical-attach $.
- **Required integrations:** Compulink / RevolutionEHR / Crystal PM / Eyefinity / Uprise / MaximEyes.

## Reference pack: Medical Billing / RCM (sketch) — first B2B pack

- **Compliance profile:** `medical_billing` — HIPAA + **3-deep BAA chain** (Practice CE → RCM BA → us BA-of-BA) + HITRUST r2 table stakes + Change Healthcare 2024 ransomware reshapes every conversation.
- **First B2B pack** — buyer (RCM COO/CFO) is not the call counterparty (payer rep / provider billing manager); pricing and reporting anchor on the RCM dashboard, not caller delight.
- **Outbound IS the entire product** — 80% of value is automated payer calls; inbound is a side dish. Inverts every prior pack.
- **IVR navigation as a contracted SLA** — maintained library of 50+ payer IVR trees (Aetna, UHC, BCBS x38, 7 Medicare MACs, state Medicaid MCOs) with quarterly drift detection. **This is the moat, not a feature.**
- **Per-claim ROI is self-evident** — $25–$35 manual vs $2–$4 AI per call → pricing model is **per-resolved-call + IVR-maintenance fee**, not per-minute.
- **Availity replaced Change/Optum as default clearinghouse** — every sales conversation references the ransomware event.
- **Required integrations:** Waystar / Athenahealth Collector / Kareo / AdvancedMD + Availity (clearinghouse) + Office Ally + payer IVR library.

## Reference pack: Solar Installer (sketch)

- **Compliance profile:** `solar` — TILA on financing + state contractor licensing + NEM 3.0 disclosure + FTC deceptive marketing rules (heavy enforcement; Vision Solar $7M consent) + Cooling-Off Rule.
- **Milestone-cadence-as-product** — 5–7 outbound touchpoints across 90–180 day cycle (proposal → contract → design → permit → install → inspection → PTO → first-bill). The cadence IS the deliverable. Cuts permit-purgatory cancellation 25–35%.
- **NEM 3.0 mandatory disclosure as regulated speech act** — CA NBT cratered solar-only payback ~75%; AI must serve disclosure verbatim and never let legacy NEM 2.0 economics be assumed. Pack maintains `nem_regime_by_utility` table.
- **Distressed-industry trust opener** — post-SunPower / ADT / Titan / Sunlight collapses, AI proactively reads CSLB license + BBB rating + years-in-business on inbound to defuse "are you about to go bankrupt."
- **Dealer-fee + TILA discipline (mortgage echo)** — AI never quotes APR / payment / dealer-fee; same NMLS-style hand-off rule applied to GoodLeap / Mosaic / Sunnova financing.
- **Cooling-Off Rule auto-honor** — never dissuades within 3-day window; logs every prohibited-claim guard activation. Aggregator-lead sub-60s dial wins ~half the time vs 3–4 competing installers.
- **Required integrations:** Aurora Solar / OpenSolar / EnergySage / Lyra / Scoop Solar / EnerFlo / Demand IQ + Permitting.app / Symbium + financing partners.

## Reference pack: Cleaning Service (sketch)

- **Compliance profile:** `cleaning` — bondability / insurance disclosure (workers in home unsupervised) + key-holding consent + state contractor licensing where applicable.
- **Trust IS the product (residential)** — bonded / insured / background-check disclosure is a first-class scripted config field per company, not an FAQ edge case. Workers-in-home-unsupervised inverts the threat model.
- **Skip / pause must be frictionless (fitness-inverted)** — the customer who can't easily skip just cancels. 30-second skip processing vs voicemail-callback is the single biggest LTV lever.
- **Three-intake fork** — recurring vs deep clean vs move-in/out. Mis-routing = wrong supplies, wrong time block, wrong SOW. Classification in first 30s is load-bearing.
- **Key / lockbox / smart-lock access as real-time crisis path** — "couldn't get in" calls require simultaneous crew-lead paging + customer coordination, not a message. Key-holding consent script is its own compliance asset.
- **Commercial-vs-residential fork at hello** — totally different sales cycles ($2K–$25K/mo RFP contracts vs $150 booked phone calls). Auto-quoting commercial = embarrassment; lead-capture-only handoff required.
- **Required integrations:** Jobber / Housecall Pro / ZenMaid / BookingKoala (Launch27) / Maid Central / ServiceM8 / Workiz.

## Reference pack: Wedding / Event Venue (sketch)

- **Compliance profile:** `wedding_venue` — minimal regulatory; ADA accessibility disclosure, deposit / cancellation policy enforcement, allergen disclosure if catering, preferred-vendor exclusivity disclosure.
- **Inventory urgency inverts real estate** — Saturdays booked 12–24 months out, weekdays open next week. Urgency comes from calendar scarcity in a known window, not "tour now or lose it."
- **Tour booking IS the funnel** — 90%+ of contracts originate from a site visit. Pack's prime directive: do-not-let-a-qualified-caller-off-the-phone-without-a-tour.
- **Contract-deadline outbound is the highest-leverage call** — soft-holds expire in 48h–7 days; the Thursday-before-expiry call protects $20K–$80K of inventory.
- **Preferred-vendor program out-margins rental** — in-house caterer kickback often exceeds the venue fee. AI steers open-vendor inquiries toward preferred list, with upfront exclusivity disclosure to prevent review churn.
- **Caller-context tone matters** — bride / MOB / FOB / same-sex couples each need different tone. One tour = $10K–$100K decision → every call gets transcript + same-day human recap.
- **Voice-AI penetration near zero in 2026** — phone front door is wide open.
- **Required integrations:** HoneyBook / Tripleseat / Event Temple / Planning Pod / Aisle Planner / Caterease / Total Party Planner / Perfect Venue.

## Reference pack: Locksmith (sketch)

- **Compliance profile:** `locksmith` — state licensing where required, **upfront price-band disclosure required by some states** (NJ/CA/NC/TX) due to scam history (echoes funeral FTC rule), recording disclosure.
- **Trust signals ARE the product** — only vertical where the entire Google SERP is contaminated by an organized scam ecosystem. Google March 2025 federal lawsuit named locksmiths a "duress vertical." Pack front-loads **license # + ALOA cert + business address + named-tech-with-photo** as a moat scammers can't replicate. Inverts the usual minimalist instinct: MORE disclosure wins.
- **Upfront price-band disclosure as recorded compliance asset** — `pricing_disclosures` table is first-class.
- **Stranded-customer safety overlay** — child-in-hot-car / woman-alone-at-night / active-break-in scripts route to 911/fire-dept FIRST. Different from home-services emergencies (property-damage-driven).
- **Anti-scam refusal scripts as a feature** — when caller mentions a competitor's $19 quote, agent EDUCATES the consumer about the scam pattern in real time.
- **Two-orders-of-magnitude pricing variance** ($65 lockout to $50K commercial) → four-intake fork: lockout / scheduled rekey-install / automotive / safe-commercial. Different pricing posture per fork.
- **Required integrations:** ServiceTitan-Locksmith / Workiz / Routzy.

## Reference pack: Towing / Roadside (sketch)

- **Compliance profile:** `towing` — state max-rate matrix (often per-county per-class), PPI consent rules, lien-sale notice timing, motor-club SLAs.
- **Motor-club work is going API-automated** (AGERO / Honk / Urgent.ly / Beacon) — voice-AI lane is the *other 50%+*: retail cash tows, stranded-driver, PPI, police rotation, owner-callbacks.
- **Stranded-driver safety preamble** — non-skippable triage (active traffic / injury / suspicious approach / EV fire risk) with live SMS GPS-share before booking.
- **PPI owner-callback is hostile-call territory** — script discipline to de-escalate, disclose charges + location + release window, but **NEVER release on phone** (in-person ID + docs only by statute).
- **State max-rate matrix is harder than storage's lien matrix** — non-consent caps per-state and often per-county/per-class; quoting over cap = void tow + license risk.
- **Heavy-duty vs light-duty is a fleet decision, not a price tier** — wrong truck class = safety/insurance event; vehicle GVWR/EV/AWD screening is mandatory.
- **Required integrations:** Beacon (formerly TowBook) / TowMagic / Tracker Management / Aim DTR / Dispatch Anywhere / Ranger SST.

## Reference pack: Urgent Care / Walk-In Clinic (sketch)

- **Compliance profile:** `urgent_care` — HIPAA + ER-vs-UC triage protocols + workers-comp intake + occupational health BAAs + 49 CFR Part 40 chain-of-custody for DOT drug screens.
- **Wait-time deflection is the cleanest single-feature ROI in the entire pack library** — 30–50% of UC inbound is "how long is the wait?", essentially 100% deflectable to Solv/Experity live-status SMS link.
- **Online check-in conversion is BOTH deflection AND conversion** — AI doesn't just answer wait-time, it converts the caller into a reserve-your-spot booking.
- **ER-vs-UC triage routes AWAY from the clinic** (911/ER) while OB triage routes INTO the clinic's L&D — same hard-battery red-flag requirement but the **economic incentive runs opposite to the routing decision**, so conservative bias must be enforced architecturally.
- **Workers comp = dual-track billing at the front door** — employer auth #, claim #, WC carrier (Travelers/Sedgwick) NOT health insurance; mis-billing creates claim chaos.
- **Occupational health as B2B revenue stream embedded in B2C clinic** — DOT physicals, drug screens, respirator fit, audiograms; employer-paid with results-to-employer consent model. 30–60% of chain revenue. Separately monetizable.
- **Required integrations:** Experity (market leader) / Practice Velocity / DocuTAP / eClinicalWorks UC / athenahealth UC + Solv (online check-in).

## Reference pack: Plastic Surgery (sketch)

- **Compliance profile:** `plastic_surgery` — HIPAA + pre-op surgical clearance + medical financing TILA + revision-policy disclosure + out-of-state telemedicine state licensure for follow-ups.
- **Three-calendar OR scheduling state machine** — surgeon + contracted CRNA anesthesia + AAAASF/ASC/hospital facility. Surgery date confirms only when all three align AND clearance is on file. Medspa books a single room.
- **Financing approval IS the conversion event** — 70%+ of $8–25K cases finance. Pack runs in-call SMS soft-pull cascade (Cherry → PatientFi → CareCredit → United Medical Credit) with denial-pivot logic. Not a link-out.
- **Pre-op clearance chase as multi-week defensive workflow** — labs / PCP / EKG / pregnancy test / smoking-cessation-cotinine. One missed item = $20–40K empty-OR loss.
- **Surgical-complication triage protocol** distinct from medspa nurse line — DVT/PE, hematoma, retrobulbar hematoma post-bleph (blindness window), 2024-ASPS-driven BBL fat-embolism 72-hr respiratory-symptom screen with 911 trigger.
- **Out-of-state cosmetic-tourism + state-licensure-gated telehealth follow-ups** + verbatim **revision policy disclosure** as legal-protection script.
- **Required integrations:** PatientNow (acquired Touch MD) / Nextech / Symplast / Crystal Clear / MD-Reports + Cherry / PatientFi / CareCredit / United Medical Credit (financing).

## Reference pack: MSP / IT Services (sketch) — second B2B pack

- **Compliance profile:** `msp` — multi-tenant; same shift applies HIPAA / CMMC L2 / SOC 2 / PCI / generic per call with per-tenant LLM-vendor routing, transcript retention, data-residency rules.
- **Multi-tenant compliance switching is the hardest single problem in the entire pack library.** Hardest example of stacked compliance — varies *per call*, not per-tenant-install.
- **Caller → client-org → SLA-tier → security-policy → compliance-profile resolution in <30 seconds** is the load-bearing UX commitment; the SLA clock has already started.
- **Password-reset deflection is the singular wedge** — 30–50% of L1 volume, lowest-margin work in the MSP P&L, end-to-end automatable via Entra Graph / Specops uReset.
- **After-hours premium authorization as contract-quality artifact** — explicit verbal "yes I authorize $250" timestamped + recording-bookmarked. Revenue-share rev model (10–20% of incremental capture) is an alt pricing.
- **P1 sub-60-second human handoff is a contracted SLA** with paging-tool integration (PagerDuty / Opsgenie) and bridge-to-engineer flow — closest in spirit to OB/GYN 24/7 on-call.
- **Kaseya VSA 2021 incident is the buyer-trust conversation**, parallel to Change Healthcare 2024 in RCM.
- **Required integrations:** PSA (ConnectWise PSA / Autotask / Halo PSA / SuperOps / Syncro / Atera) + RMM (NinjaOne / Datto / Kaseya VSA / ConnectWise Automate) + paging (PagerDuty / Opsgenie) + Entra Graph (password reset).

## Reference pack: Pest Control / Exterminator (sketch)

- **Compliance profile:** `pest_control` — state pesticide license matrix (multi-category per state: general / termite / fumigation / WDO / NWCO / aquatic — claiming an unheld category = state-board violation), EPA reentry interval disclosure (verbatim, non-skippable), posting requirements, WDO inspection report standards, treatment-guarantee enforcement.
- **EPA reentry interval is a federally-required, non-skippable script element** on every chemical booking — pulled verbatim from per-product label profile, never improvised.
- **WDO inspections are real-estate-transaction-tied** — closing date <7 days = P0 outbound urgency, CPA-tax-deadline-grade. Realtor referrals compound LTV; missed WDO kills the home sale.
- **Treatment-guarantee recall verification is a unique outbound** — AI verifies window/pest/plan-active BEFORE booking free re-spray, preventing margin erosion AND on-call denial frustration.
- **Wildlife removal forks to entirely separate license (NWCO) and ethics regime** — bats can't be killed in maternity season; bees often must be relocated to apiarist (CA/OR/WA). Wrong crew = state code violation.
- **Bee/wasp swarm = real-time emergency dispatch that STILL must run reentry interval + allergic-occupant capture** — emergency does not skip compliance.
- **Required integrations:** FieldRoutes (formerly PestRoutes) / GorillaDesk / Briostack / WorkWave PestPac (formerly ServSuite) / Pocomos.

## Reference pack: Tax Resolution / Tax Debt Relief (sketch)

- **Compliance profile:** `tax_resolution` — FTC Telemarketing Sales Rule (TSR, 2024 amendment) + state AG consumer-protection + Circular 230 + vulnerable-consumer protections + outcome-claim guard rails. Heavy enforcement vertical.
- **Outcome-claim classifier as first-class compliance feature** — real-time output filter for "pennies on the dollar," "guaranteed," specific savings promises. FTC has sued firms over exactly these utterances.
- **Vulnerable-consumer detection + free-resource routing IS the product** — distress signals (crying, SSDI, bankruptcy mention, elderly) trigger de-escalation branch with mandatory LITC / TAS / OPA / VITA referrals **logged as positive outcomes, not lost leads**.
- **TSR upfront-fee restrictions force no-payment-on-call default** — opposite of CPA pack; payment-portal handoff only post-engagement-letter.
- **Practitioner-license hard floor** — AI can only name actual EA/CPA/attorney with license # on file; structurally excludes unlicensed "tax relief consultants" as customers. Quality filter, not bug.
- **AG-subpoena-ready records architecture** — every prohibited-claim alert, TCPA/TSR consent artifact, vulnerable-consumer routing, and fee disclosure logged tamper-evident. **The records posture itself is the trust artifact.**
- **GTM wedge:** ASTPS + NAEA channel partnership — practitioner community already self-selects for ethical firms; screens out TV-mill bad actors.
- **Required integrations:** Canopy / TaxDome / TaxStatus / Pitbull Tax / IRS Solutions / Logics.

## Cross-cutting design lessons (from researching all 36 packs)

These insights surfaced repeatedly and should shape the **platform**, not just individual packs:

1. **Server-side guardrail classifier as a second gate.** Every pack has a "never say X" boundary (vet diagnosis, dental advice, legal UPL, restaurant allergen safety, dealership pricing claims). System-prompt-only enforcement isn't safe enough. Build a `ComplianceGate` interceptor in the runtime that runs **before** TTS — keyed off the install's `compliance_profile`.

2. **PMS-native scheduling > generic Cal.com adapter.** Dental, vet, and legal cannot use Cal.com as the source of truth — the practice management system is. `CalendarProvider` interface is right; the catalog of adapters is much bigger and more important than initially scoped (Open Dental, ezyVet, Clio, etc.).

3. **Pre-intake blocking step is a generic primitive.** Legal calls it "conflict check," dental calls it "insurance verification," dealership calls it "inventory check." Pack schema should support a `pre_intake_steps[]` array with required gating before main flow.

4. **TCPA consent artifact storage belongs at the platform layer.** Legal mass-tort makes it existential ($500K+ exposure on a single bad blast), but every pack with outbound benefits. Build `consent_artifacts` table at platform scope: timestamp, IP, source URL, opt-in language, channel.

5. **Two-party-consent recording matrix.** State-by-state recording disclosure rules apply across legal, dental, dealership. Make this a platform-level config (per-state behavior) rather than per-pack copy/paste.

6. **Mid-call SMS data capture as a reusable tool.** Home services photos generalize: dental insurance card image, dealership trade-in photos, vet symptom photos, legal accident-scene photos. Build a generic `requestSmsPhoto` tool in the registry.

7. **Concurrency-based pricing > per-minute.** Restaurant peak-hour insight applies broadly. Bake "max concurrent calls" into tenant plan tiers; charges/throttles enforced at the SIP layer.

8. **Hard-coded interrupts above the LLM.** Home services life-safety (gas/CO/fire), dental (Ludwig's, avulsion), and med spa (vascular occlusion post-filler) cannot be LLM-decided. Build a keyword-trigger interrupt layer that bypasses the LLM and routes immediately. Keyed off `compliance_profile.emergency_triggers`.

9. **Intent-based compliance switching mid-call.** Insurance proves stacked compliance is real: same agency line shifts between TCPA / CMS Medicare TPMO / ACA / two-party-consent based on first-utterance LOB classification. Compliance profile must be **resolvable mid-call**, not pinned at call start. Recording-retention class is per-recording, not per-tenant.

10. **Pre-outbound blocking checks generalize beyond legal conflict-checks.** Insurance has RND (Reassigned Numbers Database — every dial), Medicare has SOA capture, real estate has buyer-rep agreement check before tour booking, dealership has DNC list lookup. Pack schema needs `pre_outbound_steps[]` symmetric to `pre_intake_steps[]`. Failed checks → block the dial + log the artifact.

11. **In-call payment collection (Stripe payment-link mid-conversation) is a reusable tool.** Med spa deposit holds, restaurant large-party deposits, real estate showing deposits, fitness intro charges, dealership service deposits — all the same primitive. Build `requestPaymentLink` in the tool registry; gate by compliance profile.

12. **Cancellation/freeze flows are first-class, not edge cases.** Fitness shows cancellation must be EASIER than signup (CA/NY/FL law + FTC ROSCA). Pack schema needs explicit `cancellation_flow` and `pause_flow` definitions with state-rules engine — separate from generic intent routing.

13. **Usage-decay outbound from third-party telemetry.** Fitness reads attendance from Mindbody/Wodify; med spa reads last-treatment-date from PMS; dental reads last-cleaning. Generic primitive: pack declares a `churn_signal_query` against the integrated system → triggers outbound campaign. Higher conversion than blanket recall blasts.

14. **Per-resource × per-state × per-product authorization gates.** Insurance carrier-appointment table is the hardest case (`agency × carrier × state × LOB × status`); real estate has agent licensure per state; legal has bar admission per state; medical (vet/dental/med spa) has provider licensure per state. Build a `practitioner_authorizations` table at platform scope so packs can gate "what AI may say/do" by it.

15. **Seasonal volume spikes shape capacity planning, not just pacing.** Medicare AEP (Oct 15–Dec 7) and OEP (Jan 1–Mar 31) drive 5–10× volume; restaurant peak hours; dental Q4 insurance-max; fitness January resolutions; CPA Jan–Apr for **90 straight days** (the most extreme); education back-to-school 60% surge; childcare summer-to-fall enrollment. Tenant plans need elastic concurrency caps tied to industry pack defaults — and a **burst-rider pricing model**, not flat-per-call (firms can't budget bursts).

16. **Per-utterance feature gating, not per-call.** Mortgage NMLS is the strictest example — a single rate-quote word from a non-MLO breaches SAFE Act. Insurance has carrier-appointment per LOB. Real estate has buyer-rep-agreement check before tour. Build a per-utterance classifier that runs in parallel with TTS and can interrupt/rewrite mid-stream. Same engine that handles compliance gates.

17. **Mandatory-reporter pathway is its own primitive.** Childcare and education both have it as a hard legal obligation: capture verbatim, never investigate, never suppress, page on dedicated channel, permanent retention on a `mandatory_reporter_triggered` flag. Pack schema needs `mandatory_reporter_config` separate from generic escalation (different audit, different retention, different consent override).

18. **Authorized-contacts / authorized-pickup lists are first-class — and never modifiable by voice.** Childcare custody-dispute vector, education COPPA, dental PHI gating, insurance dependent disclosure. Build `authorized_contacts` per subject record with strict immutability via voice — modifications require written/portal confirmation.

19. **Document-collection cadence as the actual product.** CPA tax-doc chase (text d7 / call d14 / preparer d21 / extension d30); mortgage TRID 6-piece; legal retainer-and-records; insurance BOR + acord forms. Build `document_chase_cadence` as a first-class workflow primitive — multi-channel (SMS / call / email) with portal handoff.

20. **Identity verification before any subject-data disclosure.** Childcare (custody), education (COPPA-protected minor), dental (PHI), insurance (PHI/PII), legal (privileged). IVR-style identity step before disclosure — voice-print + DOB + last-4 + portal token, configurable per pack. Build once, reuse 10×.

21. **Multi-employer-on-one-line tortious-interference guard.** Salon (booth-renter calling on behalf of shop), tutoring (1:1 contractor tutors), insurance (multi-carrier under one agency BIN), real estate (independent contractor agents under one brokerage). Pack schema needs `practitioner_employment_status` (W-2 / 1099 / booth-renter / contractor) — outbound routing checks employment relationship before dialing the shared client.

22. **Real-time resource state lookups (beyond calendar peek).** Salon walk-in chair status, restaurant current waitlist, home services tech-en-route, childcare current room capacity, fitness class fill. Build a `resource_state_query` provider category — different from the calendar adapter, returns live state not bookable slots.

23. **Pricing tier fastest-to-onboard ≠ highest-revenue.** Salon = days to launch (no HIPAA), low ACV. Mortgage = highest revenue per install but RESPA caps the model. Dental/medspa = sweet spot (HIPAA premium + recurring recall economics). Pack catalog should expose these as **wedge tiers** (fast-launch / sweet-spot / enterprise) rather than treating all packs as equivalent SKUs.

24. **Quoting posture is bipolar — design for both poles.** Mortgage / legal / insurance / medical FORBID quoting; **funeral REQUIRES** itemized phone price disclosure under FTC Funeral Rule with $51,744/violation penalties for refusing. Compliance profile must support both `quote_required` (with disclosure templates) and `quote_forbidden` (with redirect templates) per topic — not a single Boolean.

25. **Voice persona tuning is per-pack, not just per-tenant.** Funeral needs 15% slower tempo, 1.2–1.8s pauses, crying-detection-with-non-advancing-script, and a banned-phrases list ("better place," "I know how you feel"). Beyond `voice_id` — pack defines `voice_persona_profile` (tempo, pause distribution, banned phrases, escalation-on-emotion rules).

26. **Sub-personas keyed off intent classification, not one persona per pack.** Funeral's at-need vs pre-need have totally separate vocabulary, cadence, escalation. Insurance switches mid-call by LOB. Real estate has sales-side vs property-mgmt. Pack schema needs `sub_personas[]` with intent-classifier-driven routing — first-utterance → sub-persona.

27. **Audio-as-evidence retention is its own primitive.** Auto-repair DVI authorizations need court-defensible audio + transcript + line-item record (BAR 7-yr retention). Insurance Medicare TPMO needs 6–10 yr audio retention. Funeral pre-need contracts. Build `audio_authorization_artifacts` table at platform scope: audio_uri, transcript, items_authorized JSON, retention_class, jurisdiction.

28. **Status-check inbound deflection is its own product line.** Auto repair "is my car ready?", storage "why doesn't my code work?", mortgage "where's my loan?", moving "where's my truck?", education "is my child OK?". 80%+ deflectable to live-state SMS link. Build `requestStatusLink` tool in registry; gate by integration availability.

29. **Mileage / usage-driven (not calendar-driven) recurring reminders.** Auto repair 30k/60k/90k from per-vehicle mileage projection; vet vaccine schedules per pet age; dental ortho-stage; fitness attendance threshold; storage occupancy duration. Generic primitive: pack declares a `usage_threshold_query` against integration → triggers reminder when threshold crossed. Different from calendar-based recall.

30. **Per-state rule matrix as a runtime gate is universal.** PT direct access, storage lien laws, chiro WC pre-auth, salon CA recording, childcare ratios, moving PUC, funeral state board, real estate licensing, education COPPA + reporter. **Every state-regulated pack ships a JSON matrix.** Lift to platform: `state_rule_matrices` keyed by `(pack_id, rule_topic, state_code)` with per-rule versioning. Pack declares which matrices it consumes.

31. **Hard-prerequisite gating (external state checks) is distinct from `pre_intake_steps`.** Pet-services vaccine verification, PT plan-of-care signature, fitness liability waiver on file, dental insurance verification, daycare temperament test. These are **external-state predicates** (not just data-collection steps); booking is blocked until they resolve. Pack schema: `booking_prerequisites[]` with `predicate_query` + `unmet_remediation_flow`.

32. **Speed-to-lead webhook ingestion as platform infra.** Moving + mortgage both depend on sub-60-second outbound from form-submit webhook. Real estate (Zillow / Redfin), insurance (lead aggregators), legal (Avvo / mass-tort vendors) all benefit. Build platform-level webhook receiver + sub-60s outbound dispatcher, not per-pack code.

33. **Hostile-call de-escalation as a packaged behavior.** Storage auction-eligible callers, moving claims, insurance complaints, healthcare collections, dealership unhappy customers. Common rule: never admit liability, never negotiate, route + log. Build a `hostile_call_handler` behavior keyed off intent classifier — pack opts in.

34. **Right-of-disposition / next-of-kin authority hierarchies extend beyond funeral.** Legal probate cases, healthcare for incapacitated patients, education custody disputes, insurance claims by surviving spouse. State-varying authority chain (spouse → adult children majority → parents → siblings). Lift `authority_hierarchy` to platform with per-state config; packs reference it for verification.

35. **Multi-payer billing-path routing.** Auto repair fleet/warranty/AAA, vet (insurance + CareCredit + practice plan), insurance (carrier + commercial + Medicare), healthcare (insurance + WC + PI lien + cash + ABN). Pack schema: `billing_paths[]` with route-to-handler logic; AI captures claim # / payer info and never authorizes against the payer itself.

36. **Crisis routing as a tested hard battery, not a feature.** Behavioral health 988/911, OB postpartum EPDS item #10, vet/dental/medspa life-safety. Build `crisis_routing_protocol` as platform infra: pre-deploy battery test (canned scenarios MUST route correctly or pack can't ship), warm-transfer with connection confirmation, never "callback later" for any qualifying signal. Audit log permanent, retention separate from regular call logs.

37. **Compliance profile is a stack, not a flag.** Behavioral health = HIPAA + 42 CFR Part 2 (stricter for SUD records) + state telehealth compact + EAP firewall. Mortgage = TILA + RESPA + SAFE Act + state. Insurance = TCPA + CMS + ACA + state. Build `compliance_profile_layers[]` rather than a single profile slug; resolved at runtime by call topic + caller jurisdiction + product type.

38. **State-of-presence verification at every telehealth interaction.** PsyPact (psych), Counseling Compact, Social Work Compact, PT compact, OB telehealth, optometry telehealth — patient's *current physical location* drives whether the provider may legally treat. Re-verified at every booking AND every session-day reminder (snowbirds). Build `state_of_presence_check` primitive with provider-licensure-by-state lookup.

39. **Caregiver / dependent two-party considerations recur.** OB two-patient (mom + fetus); childcare (parent + child); education (parent + minor); vet (owner + pet); funeral (next-of-kin + deceased); med spa (client + parental consent for under-18 procedures); insurance (policyholder + dependent). Build `subject_relationship_model` with rules for whose data can be discussed, whose authority binds, whose consent applies.

40. **Versioned policy / state-law matrices need first-class governance.** Post-Dobbs OB, NEM 3.0 solar utilities, storage lien, PT direct-access, insurance Medicare CMS rules, real estate Fair Housing, education FERPA — every state-regulated pack ships matrices that change on regulatory cycles. Build `policy_matrices` table with `(matrix_id, state_code, version, effective_date, sunset_date, counsel_of_record, last_review_date, review_cadence)`. Pack declares which matrices it consumes; admin UI shows "X matrices overdue review."

41. **Regulatory countdown clocks (silence = consent / silence = liability).** FCLCA 8 business hours on contact-lens Rx verification (silence = deemed verified = federal liability); TRID 3-business-day Loan Estimate; Cooling-Off Rule 3 days; CMS SOA 48-hour rule. Build `regulatory_countdown_clocks` with timer + auto-handler + dashboard SLA countdown. Triggered events automatically log compliance artifact.

42. **Inventory urgency posture is a pack-level model.** Wedding venue = calendar scarcity in known window (Sat 18mo out); real estate = "tour now or lose it"; childcare waitlist = cascade-on-spot-open; storage = climate units oversold by month; restaurant = Friday 7pm packed but Tuesday open. Pack declares `inventory_urgency_model: scarcity | pressure | abundant | cascade` — drives different scripts, different objection handling, different urgency disclosures.

43. **"Primary conversion event" as explicit pack policy.** Wedding venue → tour booked. Med spa → consult booked. Childcare → tour booked. Education → assessment booked. Auto repair → drop-off booked. Mortgage → app submitted. Solar → designer call. Pack declares `primary_conversion_event` + a "do not let qualified caller off the phone without X" policy — drives KPIs, escalation, AI assertiveness budget.

44. **Trust-signal opener for distressed / in-home / scam-adjacent industries.** Cleaning (bonded/insured), solar (CSLB/BBB/years-in-business), locksmith, towing, moving (FMCSA #), home services (license #), childcare (state license + ratios), pet boarding (insurance). Pack ships `trust_disclosure_opener[]` of phrases AI proactively reads on inbound to defuse trust friction *before* the caller asks.

45. **Empathy-mandate flag changes script tone universally.** Behavioral health no-show recovery, funeral, wedding, postpartum, medical billing patient calls, hostile-call handling, cancellation flows, complaints. Pack opt-in `empathy_mandate: true` activates: banned moralizing phrases, no rate-pressure, range pricing not single numbers, longer pauses, direct human handoff on emotional spike. One feature flag, many surface effects.

46. **Pack consumer model: B2C vs B2B vs B2B2C.** Medical billing is the first true B2B pack (buyer = RCM COO, counterparty = payer rep). Insurance multi-line agencies are B2B2C (broker buys for end-customer). Pack schema declares `pack_consumer_model` — drives pricing surface (per-call vs per-resolved-outcome vs per-seat), reporting (caller-delight vs ops-dashboard), success metric (booked appts vs resolved claims).

47. **Per-resolved-outcome pricing for outcome-driven packs.** Medical billing per-resolved-claim; wedding venue per-tour-booked; solar per-installed-system; mortgage per-funded-loan (RESPA-blocked → fall back to per-completed-intake). Pack declares `pricing_models_supported[]` — flat / per-call / per-minute / per-resolved-outcome / hybrid — and which is primary.

48. **IVR-navigation libraries as a contracted SLA / moat.** Medical billing 50+ payer IVR trees with quarterly drift detection. Generalizes to insurance carrier IVRs, TCPA opt-out lookups, mortgage payoff lines, attorney case-status lines. Build `ivr_navigation_library` as platform infra with versioned tree definitions, drift detection, contracted maintenance fee separable from per-call pricing.

49. **Cliff-seasonality vs ramp-seasonality require different capacity planning.** Optometry Q4 vision-benefit cliff (Dec 31 hard expiry, 8–10 week surge); dental Q4 insurance-max; education AP-May; CPA Apr 15; insurance AEP cutoff. Different from gradual ramp (restaurant Friday peaks, fitness January). Cliff = compressed countdown surge requiring pre-cliff outreach campaigns + day-of-cliff capacity multiplier. Pack declares `seasonality_model: cliff | ramp | event | continuous`.

50. **"Trust signals are the product" for duress / scam-contaminated verticals.** Locksmith is the prototype — Google's March 2025 federal lawsuit named it a "duress vertical." Same pattern: some HVAC, some electricians, immigration legal, debt relief, mover scams, garage door scams. Pack ships `trust_disclosure_protocol`: front-loaded license # + cert + business address + named-tech-with-photo + anti-scam-education refusal scripts when callers cite competitor lowball quotes. **MORE disclosure wins, inverting minimalist UX instinct.**

51. **Stranded/in-distress caller safety overlay is its own primitive.** Towing (active traffic / EV fire / suspicious approach), locksmith (child-in-hot-car / woman-alone-at-night / active break-in), behavioral health crisis, OB postpartum. Different from medical-condition triage — physical-safety-of-caller. Build `caller_safety_triage` with non-skippable pre-booking checks; live SMS GPS-share + 911-route as primary actions. Distinct from `crisis_routing_protocol` (medical/mental).

52. **Architectural enforcement when economic incentive opposes safety/compliance routing.** Urgent care ER triage (routing AWAY from clinic = lost revenue), legal UPL (turning away non-cases), mortgage NMLS (turning away ineligible borrowers), tax res vulnerable-consumer (referring to free LITC = lost lead), insurance unsuitable products. Pattern: **system-prompt instructions are not enough** when the pack profits from the wrong choice. Build pre-LLM and post-LLM classifiers that can rewrite/block — and **log "right thing done despite incentive" as a positive outcome**, not a lost-lead.

53. **Outcome-claim classifier as a generic primitive (not just legal UPL).** Tax resolution "pennies on the dollar"; medical "this will cure"; legal "you have a strong case"; solar "you'll save $X/mo"; mortgage "you qualify for the lowest APR"; weight-loss "guaranteed"; cosmetic surgery "no scars." Build `outcome_claim_classifier` keyed off a per-pack `prohibited_claims_library` — real-time output filter, FTC-defensible.

54. **Vulnerable-consumer handler with free-resource referral as a positive outcome.** Tax res (LITC/TAS/VITA), BH (988), legal intake (LSC legal-aid), insurance (state SHIP for Medicare), mortgage (HUD-approved housing counselors), debt relief (NFCC). Distress signals (crying, mention of bankruptcy / SSDI / elderly / suicide ideation / domestic violence) → mandatory free-resource referral logged as positive outcome. Pack ships `free_resource_catalog` keyed by signal.

55. **Multi-resource booking engine (N-way calendar intersection).** Plastic surgery (surgeon + anesthesia + facility); restaurant private events (server team + chef + room); home services (tech + truck + parts); legal hearings (attorney + court date + client); event venue (ceremony space + reception space + caterer + officiant). Build `multi_resource_booking_engine` — N-way calendar intersection with constraint solver, not just "first available slot."

56. **In-call financing soft-pull cascade with denial-pivot.** Plastic surgery (Cherry → PatientFi → CareCredit → United Medical Credit), solar (GoodLeap → Mosaic → Sunnova), mortgage (rate quote handoff to MLO), auto repair (Affirm/Sunbit), medspa (single-provider), dental (Sunbit/CareCredit). Sequence + denial-handling logic. Build `financing_cascade` provider category — pack declares ordered list, AI runs cascade, pivots on denial without breaking the call.

57. **Per-procedure complication protocols.** Plastic surgery (DVT/PE / hematoma / retrobulbar / BBL fat embolism); medspa (vascular occlusion); dental (Ludwig's / avulsion); chiro (vertebral artery dissection 1-in-million but legal); vet (bloat / GDV). Build `post_procedure_complication_protocols` — per-procedure decision tree with red-flag → 911 vs same-provider page vs nurse triage. Different from generic emergency triage.

58. **Real-estate-transaction-tied deadline urgency (transaction-chain dependency).** Pest control WDO (closing <7 days = P0); home inspection; appraisal; title; escrow; mortgage funding; insurance binders; moving date. Pack declares `transaction_chain_dependency` — claims a slot in a larger external transaction with its own deadline driving urgency.

59. **Multi-tenant compliance switching for B2B is the hardest single problem.** MSP applies HIPAA / CMMC L2 / SOC 2 / PCI / generic per-call (varies *per call*, not per-tenant-install) with per-tenant LLM-vendor routing, transcript retention, data-residency. RCM has 3-deep BAA. Build `tenant_isolation_profile` overrides resolved per-call from `(client_org_id, intent, jurisdiction)` — defines compliance, LLM vendor, retention, residency.

60. **Automated self-service handlers as a per-pack catalog.** MSP password reset (Entra Graph / Specops uReset), urgent care wait-time check, auto repair RO-status, mortgage app-status, storage gate-code, dental balance check, vet vaccine-record retrieval. Pack declares `automated_self_service_handlers[]` — fully-automatable intents with API-call-to-resolution flows. The deflection-as-product wedge.

61. **Industry-incident-as-buyer-trust playbook.** MSP Kaseya 2021, RCM Change Healthcare 2024, solar SunPower 2024, dental Henry Schein 2023, mortgage 2008 echo, locksmith Google duress lawsuit. Pack ships `industry_incident_objection_library` — sales-call playbook for "what happened, what we do differently." Common B2B objection.

62. **Subpoena-ready records architecture for heavy-enforcement verticals.** Tax res, legal, mortgage, insurance Medicare, dealership, solar, locksmith. Tamper-evident logging of: prohibited-claim guard activations, consent artifacts, vulnerable-consumer routings, fee disclosures, RND/DNC checks, recording disclosures. Build `subpoena_ready_audit_log` as platform infra — separate from regular call logs, longer retention, immutable, exportable as evidence package.

63. **Embedded B2B revenue stream inside B2C pack.** Urgent care occupational health (DOT physicals + drug screens + employer-paid + results-to-employer consent) is 30–60% of chain revenue inside an otherwise-B2C clinic. Vet practice plans for boarding facilities. Salon stylist booth-renter is similar inversion. Pack schema: `embedded_b2b_module` — different consent + billing + reporting layered onto a B2C base.

64. **First-utterance routing with explicit fork at hello.** Cleaning (residential vs commercial), urgent care (UC vs occ health vs WC), locksmith (lockout vs scheduled vs automotive vs safe-commercial), insurance (LOB classifier), funeral (at-need vs pre-need). Pack declares `first_utterance_router` rules — don't try to extract everything in one flow; route to a sub-flow within 30 seconds.

65. **Per-jurisdiction-per-SKU rate cap matrix.** Towing has the worst case (state × county × class). Storage lien fees, insurance Medicare regional rates, real estate commission caps in some states, healthcare service-category caps. Build `rate_cap_matrix` keyed by `(state, county, sku_class)` — pack quotes never exceed cap.

66. **Verbatim disclosure library by SKU/product/regulation.** Pest control EPA reentry intervals (per-product label); FCLCA contact-lens release; CMS TPMO disclaimer; TILA APR disclosure; FTC Funeral GPL pricing; Cooling-Off Rule; Medicare SOA. Pack declares `verbatim_disclosure_library` — per-SKU/per-jurisdiction script blocks AI must read **verbatim**, never paraphrase. Logged as a compliance artifact.

67. **Practitioner-license-floor as customer-screening (positions vendor as ethical, not a bug).** Tax resolution requires EA/CPA/attorney license # on file before AI can name a practitioner — structurally excludes unlicensed "tax relief consultants" from being customers. Generalizes: any pack where license verification is part of trust model can position structural exclusion of non-licensed firms as a quality filter (and a moat). Lift to platform: `customer_eligibility_rules` per pack.

## Open questions

- Pack versioning: when a pack ships v1.1 with a new required KB field, do existing v1.0 installs auto-prompt for it, stay on v1.0, or block until tenant fills it in?
- Pack ownership: can tenants fork a pack into a custom variant? If so, do they inherit upstream updates?
- Marketplace economics: do third parties author packs? Revenue share?
- Multi-pack tenants: can one tenant install both "Dental" and "Cosmetic Surgery" packs and route by call intent?
