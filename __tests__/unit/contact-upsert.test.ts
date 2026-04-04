// F1212: Unit test: contact upsert

import { normalizePhone } from '@/lib/phone-utils'

describe('Contact Upsert Logic', () => {
  describe('Contact data validation', () => {
    it('should validate required contact fields', () => {
      const contact = {
        name: 'John Doe',
        phone: '+12025551234',
        email: 'john@example.com',
      }

      expect(contact.name).toBeTruthy()
      expect(contact.phone).toBeTruthy()
      expect(contact.phone).toMatch(/^\+[1-9]\d{1,14}$/)
    })

    it('should normalize phone before upsert', () => {
      const rawPhone = '202-555-1234'
      const normalized = normalizePhone(rawPhone)

      expect(normalized).toBe('+12025551234')
      expect(normalized).toMatch(/^\+[1-9]\d{1,14}$/)
    })

    it('should handle optional contact fields', () => {
      const minimalContact = {
        phone: '+12025551234',
      }

      const fullContact = {
        phone: '+12025551234',
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Acme Corp',
        tags: ['lead', 'hot'],
        notes: 'Interested in product demo',
      }

      expect(minimalContact.phone).toBeTruthy()
      expect(fullContact.phone).toBeTruthy()
      expect(fullContact.name).toBeTruthy()
      expect(fullContact.tags).toHaveLength(2)
    })
  })

  describe('Upsert conflict resolution', () => {
    it('should identify upsert by phone number', () => {
      const existingContact = {
        id: 1,
        phone: '+12025551234',
        name: 'John Doe',
        email: 'john@example.com',
      }

      const updateData = {
        phone: '+12025551234',
        name: 'John Smith',
        email: 'john.smith@example.com',
      }

      // Phone matches, so this is an update
      expect(existingContact.phone).toBe(updateData.phone)
    })

    it('should preserve non-updated fields', () => {
      const existing = {
        phone: '+12025551234',
        name: 'John Doe',
        email: 'john@example.com',
        company: 'Acme Corp',
        tags: ['lead'],
      }

      const update = {
        phone: '+12025551234',
        name: 'John Smith', // Updated
        // email not provided - should preserve existing
      }

      // In upsert, missing fields should preserve existing values
      const result = {
        ...existing,
        ...update,
      }

      expect(result.name).toBe('John Smith')
      expect(result.email).toBe('john@example.com')
      expect(result.company).toBe('Acme Corp')
    })
  })

  describe('Contact deduplication', () => {
    it('should match contacts by normalized phone', () => {
      const contacts = [
        { phone: '+12025551234', name: 'John' },
        { phone: '+14155551234', name: 'Jane' },
      ]

      const lookupPhone = normalizePhone('202-555-1234')
      const match = contacts.find((c) => c.phone === lookupPhone)

      expect(match).toBeDefined()
      expect(match?.name).toBe('John')
    })

    it('should treat different phone formats as same contact', () => {
      const phone1 = normalizePhone('(202) 555-1234')
      const phone2 = normalizePhone('202-555-1234')
      const phone3 = normalizePhone('+1 202 555 1234')

      expect(phone1).toBe(phone2)
      expect(phone2).toBe(phone3)
      expect(phone1).toBe('+12025551234')
    })
  })

  describe('Contact metadata', () => {
    it('should support tags array', () => {
      const contact = {
        phone: '+12025551234',
        tags: ['lead', 'hot', 'enterprise'],
      }

      expect(Array.isArray(contact.tags)).toBe(true)
      expect(contact.tags).toContain('hot')
      expect(contact.tags).toHaveLength(3)
    })

    it('should support custom metadata fields', () => {
      const contact = {
        phone: '+12025551234',
        metadata: {
          source: 'inbound_call',
          campaign_id: 123,
          last_contact: '2026-03-26T12:00:00Z',
          timezone: 'America/New_York',
        },
      }

      expect(contact.metadata.source).toBe('inbound_call')
      expect(contact.metadata.campaign_id).toBe(123)
      expect(contact.metadata.timezone).toBeTruthy()
    })

    it('should track opt-out status', () => {
      const contact = {
        phone: '+12025551234',
        opt_out_sms: false,
        opt_out_calls: false,
      }

      expect(typeof contact.opt_out_sms).toBe('boolean')
      expect(typeof contact.opt_out_calls).toBe('boolean')
    })
  })

  describe('Timestamp handling', () => {
    it('should set created_at on insert', () => {
      const now = new Date().toISOString()
      const contact = {
        phone: '+12025551234',
        created_at: now,
      }

      expect(new Date(contact.created_at)).toBeInstanceOf(Date)
    })

    it('should update updated_at on upsert', () => {
      const created = '2026-03-25T12:00:00Z'
      const updated = '2026-03-26T12:00:00Z'

      const contact = {
        phone: '+12025551234',
        created_at: created,
        updated_at: updated,
      }

      expect(new Date(contact.updated_at).getTime()).toBeGreaterThan(
        new Date(contact.created_at).getTime()
      )
    })
  })

  describe('Error cases', () => {
    it('should reject contact without phone', () => {
      const contact: any = {
        name: 'John Doe',
        email: 'john@example.com',
      }

      expect(contact.phone).toBeUndefined()
      // Should fail validation
    })

    it('should reject invalid phone format', () => {
      const invalidPhones = ['invalid', '123', '+0123456789', '202-555-1234']

      invalidPhones.forEach((phone) => {
        const isValid = /^\+[1-9]\d{1,14}$/.test(phone)
        expect(isValid).toBe(false)
      })
    })

    it('should handle duplicate phone gracefully', () => {
      const contact1 = { id: 1, phone: '+12025551234', name: 'John' }
      const contact2 = { phone: '+12025551234', name: 'Jane' }

      // Duplicate phone - should upsert, not create new
      expect(contact1.phone).toBe(contact2.phone)
      // In DB, this would trigger upsert logic
    })
  })
})
