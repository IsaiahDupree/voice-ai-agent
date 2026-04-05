// Feature 142: Integration test: tenant phone routing resolves correct config
/**
 * Integration test for tenant phone number routing
 * Verifies that incoming phone numbers correctly resolve to tenant config
 */

import {
  resolveTenantFromPhoneNumber,
  getTenantContext,
  loadTenantConfig,
} from '@/lib/tenant-router'
import { supabaseAdmin } from '@/lib/supabase'

describe('Tenant Phone Routing', () => {
  const tenant1Id = 'test-routing-tenant-1'
  const tenant2Id = 'test-routing-tenant-2'
  const tenant1Phone = '+15553331111'
  const tenant2Phone = '+15553332222'

  beforeAll(async () => {
    // Create test tenants with specific phone numbers
    await supabaseAdmin.from('tenants').upsert({
      id: tenant1Id,
      name: 'Routing Test Tenant 1',
      slug: 'routing-test-1',
      phone_numbers: [tenant1Phone, '+15553331112'], // Multiple numbers
      plan: 'pro',
      settings: { feature_flags: { advanced_routing: true } },
    })

    await supabaseAdmin.from('tenants').upsert({
      id: tenant2Id,
      name: 'Routing Test Tenant 2',
      slug: 'routing-test-2',
      phone_numbers: [tenant2Phone],
      plan: 'starter',
      settings: { feature_flags: { advanced_routing: false } },
    })

    // Create tenant configs
    await supabaseAdmin.from('tenant_configs').upsert({
      tenant_id: tenant1Id,
      kb_namespace: 'routing-test-1-kb',
      assistant_id: 'asst_routing_1',
      persona_name: 'Sales Bot Alpha',
      voice_id: 'voice_001',
      system_prompt: 'You are a sales assistant for Tenant 1.',
      timezone: 'America/New_York',
      business_hours: {
        monday: { open: '09:00', close: '17:00' },
        tuesday: { open: '09:00', close: '17:00' },
        wednesday: { open: '09:00', close: '17:00' },
        thursday: { open: '09:00', close: '17:00' },
        friday: { open: '09:00', close: '17:00' },
      },
    })

    await supabaseAdmin.from('tenant_configs').upsert({
      tenant_id: tenant2Id,
      kb_namespace: 'routing-test-2-kb',
      assistant_id: 'asst_routing_2',
      persona_name: 'Support Bot Beta',
      voice_id: 'voice_002',
      system_prompt: 'You are a support assistant for Tenant 2.',
      timezone: 'America/Los_Angeles',
      business_hours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
      },
    })
  })

  afterAll(async () => {
    // Clean up test data
    await supabaseAdmin
      .from('tenant_configs')
      .delete()
      .in('tenant_id', [tenant1Id, tenant2Id])

    await supabaseAdmin
      .from('tenants')
      .delete()
      .in('id', [tenant1Id, tenant2Id])
  })

  it('should resolve correct tenant from phone number', async () => {
    // Test Tenant 1 phone resolution
    const tenant1 = await resolveTenantFromPhoneNumber(tenant1Phone)

    expect(tenant1).toBeTruthy()
    expect(tenant1!.id).toBe(tenant1Id)
    expect(tenant1!.name).toBe('Routing Test Tenant 1')
    expect(tenant1!.slug).toBe('routing-test-1')
    expect(tenant1!.phone_numbers).toContain(tenant1Phone)

    // Test Tenant 2 phone resolution
    const tenant2 = await resolveTenantFromPhoneNumber(tenant2Phone)

    expect(tenant2).toBeTruthy()
    expect(tenant2!.id).toBe(tenant2Id)
    expect(tenant2!.name).toBe('Routing Test Tenant 2')
    expect(tenant2!.slug).toBe('routing-test-2')
    expect(tenant2!.phone_numbers).toContain(tenant2Phone)
  })

  it('should handle phone number with different formats', async () => {
    // Test with spaces
    const tenant1WithSpaces = await resolveTenantFromPhoneNumber('+1 555 333 1111')
    expect(tenant1WithSpaces).toBeTruthy()
    expect(tenant1WithSpaces!.id).toBe(tenant1Id)

    // Test with dashes
    const tenant1WithDashes = await resolveTenantFromPhoneNumber('+1-555-333-1111')
    expect(tenant1WithDashes).toBeTruthy()
    expect(tenant1WithDashes!.id).toBe(tenant1Id)

    // Test with parentheses
    const tenant1WithParens = await resolveTenantFromPhoneNumber('+1 (555) 333-1111')
    expect(tenant1WithParens).toBeTruthy()
    expect(tenant1WithParens!.id).toBe(tenant1Id)
  })

  it('should load correct tenant config', async () => {
    // Load config for Tenant 1
    const config1 = await loadTenantConfig(tenant1Id)

    expect(config1).toBeTruthy()
    expect(config1!.tenant_id).toBe(tenant1Id)
    expect(config1!.kb_namespace).toBe('routing-test-1-kb')
    expect(config1!.assistant_id).toBe('asst_routing_1')
    expect(config1!.persona_name).toBe('Sales Bot Alpha')
    expect(config1!.voice_id).toBe('voice_001')
    expect(config1!.timezone).toBe('America/New_York')
    expect(config1!.system_prompt).toContain('Tenant 1')

    // Load config for Tenant 2
    const config2 = await loadTenantConfig(tenant2Id)

    expect(config2).toBeTruthy()
    expect(config2!.tenant_id).toBe(tenant2Id)
    expect(config2!.kb_namespace).toBe('routing-test-2-kb')
    expect(config2!.assistant_id).toBe('asst_routing_2')
    expect(config2!.persona_name).toBe('Support Bot Beta')
    expect(config2!.voice_id).toBe('voice_002')
    expect(config2!.timezone).toBe('America/Los_Angeles')
    expect(config2!.system_prompt).toContain('Tenant 2')

    // Verify configs are different
    expect(config1!.assistant_id).not.toBe(config2!.assistant_id)
    expect(config1!.timezone).not.toBe(config2!.timezone)
  })

  it('should resolve full tenant context from phone number', async () => {
    // Get full context for Tenant 1
    const context1 = await getTenantContext(tenant1Phone)

    expect(context1).toBeTruthy()
    expect(context1!.tenant).toBeTruthy()
    expect(context1!.config).toBeTruthy()

    expect(context1!.tenant.id).toBe(tenant1Id)
    expect(context1!.config.tenant_id).toBe(tenant1Id)
    expect(context1!.config.assistant_id).toBe('asst_routing_1')

    // Get full context for Tenant 2
    const context2 = await getTenantContext(tenant2Phone)

    expect(context2).toBeTruthy()
    expect(context2!.tenant).toBeTruthy()
    expect(context2!.config).toBeTruthy()

    expect(context2!.tenant.id).toBe(tenant2Id)
    expect(context2!.config.tenant_id).toBe(tenant2Id)
    expect(context2!.config.assistant_id).toBe('asst_routing_2')
  })

  it('should handle multiple phone numbers for same tenant', async () => {
    // Tenant 1 has two phone numbers
    const secondPhone = '+15553331112'

    const tenant1ViaPrimary = await resolveTenantFromPhoneNumber(tenant1Phone)
    const tenant1ViaSecondary = await resolveTenantFromPhoneNumber(secondPhone)

    expect(tenant1ViaPrimary).toBeTruthy()
    expect(tenant1ViaSecondary).toBeTruthy()

    // Both should resolve to the same tenant
    expect(tenant1ViaPrimary!.id).toBe(tenant1ViaSecondary!.id)
    expect(tenant1ViaPrimary!.id).toBe(tenant1Id)
  })

  it('should return default tenant for unknown phone number', async () => {
    const unknownPhone = '+15559999999'

    const tenant = await resolveTenantFromPhoneNumber(unknownPhone)

    // Should return default tenant or null
    // (depending on implementation - check if default tenant exists)
    if (tenant) {
      expect(tenant.id).toBe('default')
    } else {
      expect(tenant).toBeNull()
    }
  })

  it('should isolate tenant settings', async () => {
    const context1 = await getTenantContext(tenant1Phone)
    const context2 = await getTenantContext(tenant2Phone)

    expect(context1).toBeTruthy()
    expect(context2).toBeTruthy()

    // Verify Tenant 1 settings
    expect(context1!.tenant.settings.feature_flags.advanced_routing).toBe(true)
    expect(context1!.tenant.plan).toBe('pro')

    // Verify Tenant 2 settings
    expect(context2!.tenant.settings.feature_flags.advanced_routing).toBe(false)
    expect(context2!.tenant.plan).toBe('starter')

    // Verify settings are different
    expect(context1!.tenant.plan).not.toBe(context2!.tenant.plan)
  })
})
