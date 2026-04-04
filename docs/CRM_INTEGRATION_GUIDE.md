# CRM Integration Guide

This guide explains how to extend the Voice AI Agent's CRM system with custom fields, workflows, and data sources.

## Overview

The Voice AI Agent's CRM is built on Supabase PostgreSQL with flexible schema design that supports custom fields at both the contact and organization level. The system is designed to integrate seamlessly with the voice call pipeline.

## Architecture

### Core Tables

```
contacts
├── id (uuid)
├── phone (text) - indexed for fast lookup
├── email (text)
├── first_name (text)
├── last_name (text)
├── company_name (text)
├── title (text)
├── metadata (jsonb) - flexible custom fields
├── tags (text[])
├── last_activity (timestamp)
├── enriched_at (timestamp)
└── created_at (timestamp)

organizations
├── id (uuid)
├── name (text)
├── domain (text)
├── industry (text)
├── employees (integer)
├── metadata (jsonb) - flexible custom fields
└── created_at (timestamp)

call_logs
├── id (uuid)
├── contact_id (uuid) - FK to contacts
├── assistant_id (uuid)
├── duration (integer)
├── transcript (text)
├── metadata (jsonb) - call-specific custom fields
└── created_at (timestamp)
```

### Extension Points

The CRM system provides three main extension points:

1. **JSONB metadata fields** - Store any custom data as JSON
2. **Custom database views** - Create derived insights
3. **API extensions** - Add custom endpoints for your business logic

## Adding Custom Fields to Contacts

### Method 1: Direct JSONB Metadata

The simplest approach is to store custom fields in the `contacts.metadata` JSONB column:

```typescript
// Update contact with custom fields
const { data, error } = await supabase
  .from('contacts')
  .update({
    metadata: {
      ...contact.metadata,
      custom_field_1: 'value',
      custom_field_2: 123,
      custom_field_3: { nested: 'data' }
    }
  })
  .eq('id', contactId)
  .select()
```

Example custom fields for a real estate use case:
```json
{
  "property_address": "123 Main St",
  "property_type": "single_family",
  "asking_price": 450000,
  "interested_features": ["pool", "garage"],
  "showing_date": "2026-03-30T14:00:00Z",
  "buyer_pre_qualified": true
}
```

### Method 2: Database View for Custom Schema

Create a view that surfaces custom fields from metadata:

```sql
-- Create a view for real estate contacts
CREATE VIEW real_estate_contacts AS
SELECT
  id,
  phone,
  email,
  first_name,
  last_name,
  (metadata->>'property_address') AS property_address,
  (metadata->>'property_type') AS property_type,
  (metadata->>'asking_price')::numeric AS asking_price,
  (metadata->'interested_features')::text[] AS interested_features,
  (metadata->>'showing_date')::timestamp AS showing_date,
  (metadata->>'buyer_pre_qualified')::boolean AS buyer_pre_qualified,
  created_at
FROM contacts
WHERE metadata ? 'property_address';

-- Query the view
const { data } = await supabase
  .from('real_estate_contacts')
  .select('*')
  .eq('property_type', 'single_family')
```

Benefits:
- Type-safe queries
- Proper indexing support
- Easier for analytics/BI tools
- Clean separation of concerns

### Method 3: Trigger-Based Normalization

For frequently-accessed custom fields, create a dedicated column with a trigger to keep it in sync:

```sql
-- Add column for a new custom field
ALTER TABLE contacts ADD COLUMN vip_status text;

-- Create trigger to sync with metadata
CREATE OR REPLACE FUNCTION sync_vip_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.vip_status := NEW.metadata->>'vip_status';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vip_status_sync
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION sync_vip_status();
```

This approach:
- Enables fast indexing on frequently-queried fields
- Denormalizes data for performance
- Keeps metadata as the source of truth
- Automatically stays in sync

## Enriching Contacts with External Data

### Built-in Enrichment Providers

The system supports contact enrichment via `lib/contact-enrichment.ts`:

```typescript
// Clearbit enrichment (free for 50/month, then paid)
import { enrichContactWithClearbit } from '@/lib/contact-enrichment'

const enriched = await enrichContactWithClearbit(contact)
// Returns: { company, title, linkedin, company_size, industry, ... }

// FullContact enrichment (alternative provider)
import { enrichContactWithFullContact } from '@/lib/contact-enrichment'

const enriched = await enrichContactWithFullContact(contact)
```

### Adding Custom Enrichment

Create a new enrichment provider:

```typescript
// lib/enrichment-providers/custom.ts
import { createClient } from '@supabase/supabase-js'

export interface CustomEnrichmentData {
  risk_score?: number
  industry_classification?: string
  company_growth_rate?: number
  funding_status?: string
}

export async function enrichContactWithCustomAPI(
  contact: Contact,
  apiKey: string
): Promise<CustomEnrichmentData> {
  const response = await fetch('https://api.example.com/enrich', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      email: contact.email,
      company: contact.company_name
    })
  })

  if (!response.ok) {
    throw new Error(`Enrichment API failed: ${response.statusText}`)
  }

  return response.json()
}

// app/api/contacts/enrich/route.ts - add to existing endpoint
import { enrichContactWithCustomAPI } from '@/lib/enrichment-providers/custom'

export async function POST(request: Request) {
  // ... existing code ...

  // Add custom enrichment
  const customData = await enrichContactWithCustomAPI(
    contact,
    process.env.CUSTOM_ENRICHMENT_API_KEY!
  )

  // Save to metadata
  const enriched = {
    ...contact.metadata,
    enrichment: {
      ...contact.metadata?.enrichment,
      risk_score: customData.risk_score,
      industry_classification: customData.industry_classification,
      // ... other fields
    },
    enriched_at: new Date().toISOString()
  }

  return { contact: { ...contact, metadata: enriched } }
}
```

## Webhooks for Real-time CRM Updates

### Listening for Call Events

When a call completes, update CRM fields automatically:

```typescript
// app/api/webhooks/custom-crm/route.ts
export async function POST(request: Request) {
  const event = await request.json()

  if (event.type === 'call.ended') {
    const { contactId, callId, duration, sentiment } = event

    // Update CRM metadata with call results
    const supabase = createClient()

    const { data: callLog } = await supabase
      .from('call_logs')
      .select('transcript')
      .eq('id', callId)
      .single()

    await supabase
      .from('contacts')
      .update({
        metadata: supabase.rpc('merge_metadata', {
          new_metadata: {
            last_call_sentiment: sentiment,
            last_call_duration: duration,
            last_call_date: new Date().toISOString(),
            call_history: supabase.rpc('append_call', { callId })
          }
        })
      })
      .eq('id', contactId)
  }

  return { success: true }
}
```

### Webhook Event Types

```typescript
interface CRMWebhookEvent {
  type:
    | 'call.started'
    | 'call.ended'
    | 'sentiment.detected'
    | 'contact.enriched'
    | 'booking.created'
    | 'sms.sent'

  callId?: string
  contactId?: string
  metadata: Record<string, any>
  timestamp: string
}
```

## Building Custom CRM Workflows

### Example: Lead Scoring Workflow

```typescript
// lib/workflows/lead-scoring.ts
import { createClient } from '@supabase/supabase-js'

interface LeadScore {
  engagement_score: number    // 0-100 based on call history
  fit_score: number           // 0-100 based on company/industry
  intent_score: number        // 0-100 based on keywords/sentiment
  total_score: number         // 0-100 weighted average
  recommendation: string      // "hot", "warm", "cold"
}

export async function scoreContact(contactId: string): Promise<LeadScore> {
  const supabase = createClient()

  // Fetch contact with full history
  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      *,
      call_logs(*)
    `)
    .eq('id', contactId)
    .single()

  // Calculate engagement score (call frequency, duration, sentiment)
  const engagementScore = calculateEngagement(contact.call_logs)

  // Calculate fit score (company size, industry, budget indicators)
  const fitScore = calculateFit(contact.metadata)

  // Calculate intent score (objections raised, questions asked, CTA responses)
  const intentScore = calculateIntent(contact.call_logs)

  const totalScore = (
    engagementScore * 0.3 +
    fitScore * 0.3 +
    intentScore * 0.4
  )

  // Save score to contact
  await supabase
    .from('contacts')
    .update({
      metadata: {
        ...contact.metadata,
        lead_score: {
          engagement_score: engagementScore,
          fit_score: fitScore,
          intent_score: intentScore,
          total_score: totalScore,
          updated_at: new Date().toISOString()
        }
      }
    })
    .eq('id', contactId)

  return {
    engagement_score: engagementScore,
    fit_score: fitScore,
    intent_score: intentScore,
    total_score: totalScore,
    recommendation: totalScore > 70 ? 'hot' : totalScore > 40 ? 'warm' : 'cold'
  }
}

function calculateEngagement(callLogs: any[]): number {
  if (!callLogs || callLogs.length === 0) return 0

  const frequency = Math.min(callLogs.length * 10, 40) // 0-40
  const avgDuration = callLogs.reduce((sum, c) => sum + c.duration, 0) / callLogs.length
  const duration = Math.min(avgDuration / 60, 40) // 0-40
  const recentActivity = callLogs.some(c =>
    new Date(c.created_at) > new Date(Date.now() - 7*24*60*60*1000)
  ) ? 20 : 0 // 0-20

  return frequency + duration + recentActivity
}

function calculateFit(metadata: any): number {
  let score = 0

  // Company size fit (1000-5000 employees = perfect fit)
  if (metadata?.company_employees) {
    score += metadata.company_employees >= 1000 && metadata.company_employees <= 5000 ? 40 : 20
  }

  // Industry fit
  const fitIndustries = ['SaaS', 'Technology', 'Professional Services']
  if (metadata?.industry && fitIndustries.includes(metadata.industry)) {
    score += 30
  }

  // Budget indicators
  if (metadata?.asking_price || metadata?.budget_range) {
    score += 30
  }

  return Math.min(score, 100)
}

function calculateIntent(callLogs: any[]): number {
  if (!callLogs || callLogs.length === 0) return 0

  let score = 0

  callLogs.forEach(log => {
    const transcript = (log.transcript || '').toLowerCase()

    // Check for intent signals
    if (transcript.includes('how much') || transcript.includes('pricing')) score += 15
    if (transcript.includes('when can') || transcript.includes('availability')) score += 15
    if (transcript.includes('schedule') || transcript.includes('calendar')) score += 20
    if (transcript.includes('interested') || transcript.includes('tell me more')) score += 20
    if (log.metadata?.sentiment === 'positive') score += 15
    if (log.metadata?.objections?.length) score += 10
  })

  return Math.min(score, 100)
}
```

Usage:
```typescript
// In your campaign workflow
import { scoreContact } from '@/lib/workflows/lead-scoring'

export async function updateCRMAfterCall(contactId: string) {
  const score = await scoreContact(contactId)

  if (score.recommendation === 'hot') {
    // Trigger immediate follow-up
    await sendFollowupSMS(contactId, 'hot_lead_template')
  }
}
```

## Integration Patterns

### Pattern 1: Sync to External CRM

```typescript
// lib/crm-sync/salesforce.ts
import { createClient } from '@supabase/supabase-js'

export async function syncContactToSalesforce(contact: Contact) {
  const response = await fetch('https://your-org.salesforce.com/services/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!
    })
  })

  const { access_token } = await response.json()

  // Create or update lead in Salesforce
  await fetch('https://your-org.salesforce.com/services/data/v59.0/sobjects/Lead', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      FirstName: contact.first_name,
      LastName: contact.last_name,
      Phone: contact.phone,
      Email: contact.email,
      Company: contact.company_name,
      Title: contact.title,
      // Map custom fields
      ...mapMetadataToSalesforce(contact.metadata)
    })
  })
}

function mapMetadataToSalesforce(metadata: any) {
  return {
    Custom_Field_1__c: metadata?.custom_field_1,
    Custom_Field_2__c: metadata?.custom_field_2,
    // ... other mappings
  }
}
```

### Pattern 2: Batch Import from CSV

```typescript
// app/api/contacts/import/csv/route.ts
import Papa from 'papaparse'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  const csv = await file.text()
  const { data: rows } = Papa.parse(csv, { header: true })

  const supabase = createClient()

  // Insert all rows
  const contacts = rows.map((row: any) => ({
    phone: row.phone,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    company_name: row.company,
    title: row.title,
    metadata: {
      // Map CSV columns to custom fields
      custom_field_1: row.custom_field_1,
      custom_field_2: row.custom_field_2,
      import_source: 'csv',
      import_date: new Date().toISOString()
    }
  }))

  const { error } = await supabase
    .from('contacts')
    .insert(contacts)

  return {
    imported: contacts.length,
    error: error?.message
  }
}
```

## Best Practices

1. **Always use metadata for custom fields first** - Don't add columns for every custom field
2. **Index frequently-queried fields** - Create database views or materialized views for performance
3. **Keep enrichment updates separate** - Use a separate metadata.enrichment object
4. **Validate data at the API boundary** - Don't trust external enrichment sources
5. **Archive old contacts** - Move inactive contacts to an archive table after 1 year
6. **Log all CRM changes** - Create audit trail for compliance
7. **Use RLS policies** - Ensure multi-tenant safety with Row Level Security
8. **Cache enrichment results** - Don't re-enrich the same contact within 30 days
9. **Test webhook handlers** - Use test events before going live
10. **Document your schema changes** - Keep a migration log of all CRM changes

## Testing Custom Fields

```typescript
// __tests__/crm/custom-fields.test.ts
import { createClient } from '@supabase/supabase-js'

describe('CRM Custom Fields', () => {
  it('should store custom fields in metadata', async () => {
    const supabase = createClient(url, key)

    const { data: contact } = await supabase
      .from('contacts')
      .insert({
        phone: '+1234567890',
        email: 'test@example.com',
        first_name: 'John',
        metadata: {
          custom_field_1: 'test',
          custom_field_2: 123
        }
      })
      .select()
      .single()

    expect(contact.metadata.custom_field_1).toBe('test')
    expect(contact.metadata.custom_field_2).toBe(123)
  })
})
```

## Troubleshooting

### Issue: JSONB queries returning NULL

**Solution:** Ensure you're using the correct operator:
```sql
-- Wrong
WHERE metadata->'field' = 'value'

-- Correct
WHERE metadata->>'field' = 'value'  -- double arrow for text extraction
```

### Issue: Custom fields not syncing to external CRM

**Solution:** Add error logging and retry logic:
```typescript
export async function syncWithRetry(contact: Contact, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await syncContactToSalesforce(contact)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
    }
  }
}
```

### Issue: Performance degradation with large metadata objects

**Solution:** Create a materialized view and refresh periodically:
```sql
CREATE MATERIALIZED VIEW contact_search AS
SELECT id, phone, email, first_name, last_name, (metadata->>'company_name') AS company
FROM contacts;

CREATE INDEX contact_search_phone ON contact_search(phone);

-- Refresh every hour via a cron job
SELECT refresh_materialized_view('contact_search');
```

## Next Steps

1. **Define your custom schema** - List all custom fields needed
2. **Create database views** - For frequently-queried custom fields
3. **Build enrichment providers** - Integrate with your data sources
4. **Implement webhooks** - Auto-update CRM after calls
5. **Set up workflows** - Lead scoring, follow-ups, etc.
6. **Test thoroughly** - Unit tests + integration tests
7. **Monitor performance** - Check query times as data grows
8. **Document changes** - Keep your schema documentation up-to-date

---

**Last Updated:** March 29, 2026
**Status:** Complete
**Related Features:** F0584 (Enrichment), F0267 (Analytics), F0266 (Contact Management)
