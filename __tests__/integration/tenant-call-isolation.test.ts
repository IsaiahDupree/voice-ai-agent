// Feature 141: Integration test: two tenants have isolated call data
/**
 * Integration test for multi-tenant call data isolation
 * Verifies that calls, contacts, and campaigns are properly scoped to tenant_id
 */

import { supabaseAdmin } from '@/lib/supabase'
import { TenantQueryBuilder } from '@/lib/tenant-router'

describe('Tenant Call Data Isolation', () => {
  const tenant1Id = 'test-tenant-1'
  const tenant2Id = 'test-tenant-2'

  let call1Id: string
  let call2Id: string
  let contact1Id: number
  let contact2Id: number

  beforeAll(async () => {
    // Clean up any existing test data
    await supabaseAdmin
      .from('voice_agent_calls')
      .delete()
      .or(`phone_number.eq.+15551111111,phone_number.eq.+15552222222`)

    await supabaseAdmin
      .from('contacts')
      .delete()
      .or(`phone_number.eq.+15551111111,phone_number.eq.+15552222222`)

    // Create test tenants (if they don't exist)
    const { error: tenant1Error } = await supabaseAdmin
      .from('tenants')
      .upsert({
        id: tenant1Id,
        name: 'Test Tenant 1',
        slug: 'test-tenant-1',
        phone_numbers: ['+15559991111'],
        plan: 'pro',
        settings: {},
      })

    const { error: tenant2Error } = await supabaseAdmin
      .from('tenants')
      .upsert({
        id: tenant2Id,
        name: 'Test Tenant 2',
        slug: 'test-tenant-2',
        phone_numbers: ['+15559992222'],
        plan: 'pro',
        settings: {},
      })

    if (tenant1Error || tenant2Error) {
      console.error('Error creating test tenants:', { tenant1Error, tenant2Error })
    }

    // Create contact for Tenant 1
    const { data: contact1, error: contact1Error } = await supabaseAdmin
      .from('contacts')
      .insert({
        full_name: 'Tenant 1 Contact',
        phone_number: '+15551111111',
        email: 'contact1@tenant1.com',
        tenant_id: tenant1Id,
      })
      .select('id')
      .single()

    if (contact1Error) {
      console.error('Error creating contact 1:', contact1Error)
    } else {
      contact1Id = contact1.id
    }

    // Create contact for Tenant 2
    const { data: contact2, error: contact2Error } = await supabaseAdmin
      .from('contacts')
      .insert({
        full_name: 'Tenant 2 Contact',
        phone_number: '+15552222222',
        email: 'contact2@tenant2.com',
        tenant_id: tenant2Id,
      })
      .select('id')
      .single()

    if (contact2Error) {
      console.error('Error creating contact 2:', contact2Error)
    } else {
      contact2Id = contact2.id
    }

    // Create call for Tenant 1
    const { data: call1, error: call1Error } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        vapi_call_id: 'test-call-tenant-1-001',
        phone_number: '+15551111111',
        contact_id: contact1Id,
        status: 'completed',
        direction: 'inbound',
        duration: 120,
        outcome: 'booking_made',
        tenant_id: tenant1Id,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (call1Error) {
      console.error('Error creating call 1:', call1Error)
    } else {
      call1Id = call1.id
    }

    // Create call for Tenant 2
    const { data: call2, error: call2Error } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        vapi_call_id: 'test-call-tenant-2-001',
        phone_number: '+15552222222',
        contact_id: contact2Id,
        status: 'completed',
        direction: 'inbound',
        duration: 180,
        outcome: 'interested',
        tenant_id: tenant2Id,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (call2Error) {
      console.error('Error creating call 2:', call2Error)
    } else {
      call2Id = call2.id
    }
  })

  afterAll(async () => {
    // Clean up test data
    await supabaseAdmin
      .from('voice_agent_calls')
      .delete()
      .or(`phone_number.eq.+15551111111,phone_number.eq.+15552222222`)

    await supabaseAdmin
      .from('contacts')
      .delete()
      .or(`phone_number.eq.+15551111111,phone_number.eq.+15552222222`)
  })

  it('should isolate call data between tenants', async () => {
    // Query calls for Tenant 1 using TenantQueryBuilder
    const tenant1Query = new TenantQueryBuilder(tenant1Id)
    const { data: tenant1Calls, error: tenant1Error } = await tenant1Query
      .scopeCallLogs()
      .eq('status', 'completed')

    expect(tenant1Error).toBeNull()
    expect(tenant1Calls).toBeTruthy()
    expect(tenant1Calls!.length).toBeGreaterThanOrEqual(1)

    // Verify all calls belong to Tenant 1
    tenant1Calls!.forEach((call: any) => {
      expect(call.tenant_id).toBe(tenant1Id)
      expect(call.tenant_id).not.toBe(tenant2Id)
    })

    // Query calls for Tenant 2
    const tenant2Query = new TenantQueryBuilder(tenant2Id)
    const { data: tenant2Calls, error: tenant2Error } = await tenant2Query
      .scopeCallLogs()
      .eq('status', 'completed')

    expect(tenant2Error).toBeNull()
    expect(tenant2Calls).toBeTruthy()
    expect(tenant2Calls!.length).toBeGreaterThanOrEqual(1)

    // Verify all calls belong to Tenant 2
    tenant2Calls!.forEach((call: any) => {
      expect(call.tenant_id).toBe(tenant2Id)
      expect(call.tenant_id).not.toBe(tenant1Id)
    })

    // Ensure no overlap: Tenant 1's call IDs should not appear in Tenant 2's results
    const tenant1CallIds = tenant1Calls!.map((c: any) => c.id)
    const tenant2CallIds = tenant2Calls!.map((c: any) => c.id)

    tenant1CallIds.forEach((id: string) => {
      expect(tenant2CallIds).not.toContain(id)
    })

    tenant2CallIds.forEach((id: string) => {
      expect(tenant1CallIds).not.toContain(id)
    })
  })

  it('should isolate contact data between tenants', async () => {
    // Query contacts for Tenant 1
    const tenant1Query = new TenantQueryBuilder(tenant1Id)
    const { data: tenant1Contacts, error: tenant1Error } = await tenant1Query
      .scopeContacts()

    expect(tenant1Error).toBeNull()
    expect(tenant1Contacts).toBeTruthy()
    expect(tenant1Contacts!.length).toBeGreaterThanOrEqual(1)

    // Verify all contacts belong to Tenant 1
    tenant1Contacts!.forEach((contact: any) => {
      expect(contact.tenant_id).toBe(tenant1Id)
    })

    // Query contacts for Tenant 2
    const tenant2Query = new TenantQueryBuilder(tenant2Id)
    const { data: tenant2Contacts, error: tenant2Error } = await tenant2Query
      .scopeContacts()

    expect(tenant2Error).toBeNull()
    expect(tenant2Contacts).toBeTruthy()
    expect(tenant2Contacts!.length).toBeGreaterThanOrEqual(1)

    // Verify all contacts belong to Tenant 2
    tenant2Contacts!.forEach((contact: any) => {
      expect(contact.tenant_id).toBe(tenant2Id)
    })

    // Ensure no cross-tenant contact visibility
    const tenant1ContactIds = tenant1Contacts!.map((c: any) => c.id)
    const tenant2ContactIds = tenant2Contacts!.map((c: any) => c.id)

    expect(tenant1ContactIds).not.toContain(contact2Id)
    expect(tenant2ContactIds).not.toContain(contact1Id)
  })

  it('should prevent direct cross-tenant data access', async () => {
    // Try to query Tenant 1's data using Tenant 2's scope
    const tenant2Query = new TenantQueryBuilder(tenant2Id)
    const { data: crossTenantCalls } = await tenant2Query
      .scopeCallLogs()
      .eq('id', call1Id) // Try to access Tenant 1's call

    // Should return empty because call1 belongs to Tenant 1
    expect(crossTenantCalls).toEqual([])
  })
})
