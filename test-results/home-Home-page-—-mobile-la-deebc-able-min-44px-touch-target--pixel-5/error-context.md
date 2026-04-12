# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: home.spec.ts >> Home page — mobile layout >> navigation links are tappable (min 44px touch target)
- Location: tests/e2e/home.spec.ts:24:7

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 28
Received:    16
```

# Page snapshot

```yaml
- main [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [ref=e6]: Isaiah Dupree
        - generic [ref=e7]: AI Automation Engineer
      - link "Book a Call" [ref=e9] [cursor=pointer]:
        - /url: https://calendly.com/isaiahdupree33
  - generic [ref=e10]:
    - generic [ref=e11]: Live system — not a mockup
    - heading "A 24/7 AI phone agent that handles every inbound call for your business" [level=1] [ref=e13]:
      - text: A 24/7 AI phone agent that handles
      - text: every inbound call for your business
    - paragraph [ref=e14]: "Answers questions, books appointments, and qualifies leads — automatically. Try the demo below: enter your website and then have the agent call you in real time."
  - generic [ref=e16]:
    - paragraph [ref=e17]: Live demo
    - heading "Watch it build a context profile in real time" [level=3] [ref=e18]
    - paragraph [ref=e19]: Enter any real business domain. Results in ~20 seconds.
    - generic [ref=e20]:
      - generic [ref=e21]:
        - generic: https://
        - textbox "stripe.com" [ref=e22]
      - button "Build Profile" [disabled] [ref=e23]
  - generic [ref=e25]:
    - paragraph [ref=e28]: Live call
    - heading "Hear the AI agent call you right now" [level=3] [ref=e29]
    - paragraph [ref=e30]: Enter your number. The agent will call you in seconds.
    - generic [ref=e31]:
      - generic [ref=e32]:
        - generic: "+1"
        - textbox "(555) 000-0000" [ref=e33]
      - button "Call me now →" [disabled] [ref=e34]
    - paragraph [ref=e35]: US numbers only. You'll receive a call from our demo line.
  - generic [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e39]: ~20s
      - generic [ref=e40]: to index any domain
    - generic [ref=e41]:
      - generic [ref=e42]: "25"
      - generic [ref=e43]: pages crawled per run
    - generic [ref=e44]:
      - generic [ref=e45]: 24/7
      - generic [ref=e46]: inbound call coverage
    - generic [ref=e47]:
      - generic [ref=e48]: 100%
      - generic [ref=e49]: context live at call start
  - generic [ref=e50]:
    - paragraph [ref=e51]: Full system
    - generic [ref=e52]:
      - generic [ref=e53]:
        - generic [ref=e54]: 🧠
        - heading "Business Context Engine" [level=3] [ref=e55]
        - paragraph [ref=e56]: Crawls any website → structured profile → injected into every call automatically
      - generic [ref=e57]:
        - generic [ref=e58]: 📞
        - heading "24/7 Inbound Handling" [level=3] [ref=e59]
        - paragraph [ref=e60]: Natural voice conversations via Vapi — never misses a lead
      - generic [ref=e61]:
        - generic [ref=e62]: 📅
        - heading "Live Appointment Booking" [level=3] [ref=e63]
        - paragraph [ref=e64]: Integrated with Cal.com — books real slots during the call
      - generic [ref=e65]:
        - generic [ref=e66]: 💬
        - heading "SMS Confirmations" [level=3] [ref=e67]
        - paragraph [ref=e68]: Twilio follow-ups sent automatically after every booking
      - generic [ref=e69]:
        - generic [ref=e70]: 📊
        - heading "Call Analytics" [level=3] [ref=e71]
        - paragraph [ref=e72]: Sentiment tracking, conversion rates, full transcript review
      - generic [ref=e73]:
        - generic [ref=e74]: 🔗
        - heading "Multi-tenant Ready" [level=3] [ref=e75]
        - paragraph [ref=e76]: One platform, multiple clients — fully isolated per account
  - generic [ref=e78]:
    - generic [ref=e79]:
      - paragraph [ref=e80]: Who built this
      - heading "Isaiah Dupree" [level=2] [ref=e81]
      - paragraph [ref=e82]: AI automation engineer specializing in voice AI systems, autonomous agents, and full-stack integrations. I build production systems — not demos — that generate revenue on day one.
      - generic [ref=e83]:
        - generic [ref=e84]: Vapi
        - generic [ref=e85]: Anthropic Claude
        - generic [ref=e86]: Next.js
        - generic [ref=e87]: Supabase
        - generic [ref=e88]: Twilio
        - generic [ref=e89]: OpenAI
    - generic [ref=e90]:
      - heading "Ready to automate your calls?" [level=3] [ref=e91]
      - paragraph [ref=e92]: 30-minute call. I'll show you a live demo with your actual business, answer every technical question, and give you a clear scope + price before we hang up.
      - link "Book a 30-min call →" [ref=e93] [cursor=pointer]:
        - /url: https://calendly.com/isaiahdupree33
      - generic [ref=e94]:
        - link "isaiahdupree33@gmail.com" [ref=e95] [cursor=pointer]:
          - /url: mailto:isaiahdupree33@gmail.com
        - link "Upwork Profile" [ref=e96] [cursor=pointer]:
          - /url: https://www.upwork.com/freelancers/~isaiahdupree
  - generic [ref=e97]: Built by Isaiah Dupree · Vapi · Anthropic Claude · Next.js · Supabase · Twilio
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Home page — mobile layout', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/')
  6  |   })
  7  | 
  8  |   test('renders without errors', async ({ page }) => {
  9  |     await expect(page).not.toHaveTitle(/error/i)
  10 |     await expect(page.locator('body')).toBeVisible()
  11 |   })
  12 | 
  13 |   test('page title is present', async ({ page }) => {
  14 |     const title = await page.title()
  15 |     expect(title.length).toBeGreaterThan(0)
  16 |   })
  17 | 
  18 |   test('no horizontal overflow on mobile', async ({ page }) => {
  19 |     const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
  20 |     const viewportWidth = page.viewportSize()?.width ?? 375
  21 |     expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5)
  22 |   })
  23 | 
  24 |   test('navigation links are tappable (min 44px touch target)', async ({ page }) => {
  25 |     const links = await page.locator('a[href]:visible').all()
  26 |     for (const link of links.slice(0, 8)) {
  27 |       const box = await link.boundingBox()
  28 |       if (box) {
> 29 |         expect(box.height).toBeGreaterThanOrEqual(28)
     |                            ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  30 |       }
  31 |     }
  32 |   })
  33 | 
  34 |   test('primary CTA button is visible on mobile', async ({ page }) => {
  35 |     const cta = page.locator('button:visible, a[href]:visible').first()
  36 |     await expect(cta).toBeVisible()
  37 |   })
  38 | 
  39 |   test('text is readable — no overflow clipping', async ({ page }) => {
  40 |     const overflowHidden = await page.evaluate(() => {
  41 |       const els = Array.from(document.querySelectorAll('p, h1, h2, h3, span'))
  42 |       return els.filter(el => {
  43 |         const style = getComputedStyle(el)
  44 |         return style.overflow === 'hidden' && el.scrollWidth > el.clientWidth
  45 |       }).length
  46 |     })
  47 |     expect(overflowHidden).toBe(0)
  48 |   })
  49 | 
  50 |   test('dashboard link navigates correctly', async ({ page }) => {
  51 |     const dashLink = page.locator('a[href*="dashboard"]').first()
  52 |     if (await dashLink.count() > 0) {
  53 |       await dashLink.click()
  54 |       await page.waitForURL(/dashboard/)
  55 |       expect(page.url()).toContain('dashboard')
  56 |     }
  57 |   })
  58 | 
  59 |   test('localreach link navigates correctly', async ({ page }) => {
  60 |     const lrLink = page.locator('a[href*="localreach"]').first()
  61 |     if (await lrLink.count() > 0) {
  62 |       await lrLink.click()
  63 |       await page.waitForURL(/localreach/)
  64 |       expect(page.url()).toContain('localreach')
  65 |     }
  66 |   })
  67 | })
  68 | 
```