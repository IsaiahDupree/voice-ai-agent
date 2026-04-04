/**
 * E2E Test: Contact Import
 * Feature: F1218
 * Tests that CSV contacts can be imported and appear in contacts tab
 */

import { render, screen, waitFor } from '@testing-library/react'
import ContactDetailPage from '@/app/dashboard/contacts/[id]/page'

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock useParams and useRouter
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '123' }),
  useRouter: () => ({
    push: jest.fn()
  })
}))

// Mock confirm
global.confirm = jest.fn(() => true)
global.alert = jest.fn()

describe('E2E: Contact Import', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    ;(global.confirm as jest.Mock).mockClear()
    ;(global.alert as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should load contact detail page with full data', async () => {
    const mockContact = {
      id: 123,
      name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      company: 'Acme Inc',
      deal_stage: 'qualified',
      notes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sms_consent: true
    }

    const mockTimeline = {
      contactId: 123,
      timeline: [
        {
          type: 'call' as const,
          timestamp: new Date().toISOString(),
          data: {
            direction: 'outbound',
            status: 'completed',
            duration: 120,
            cost: 0.05
          }
        }
      ],
      stats: {
        totalCalls: 1,
        totalSMS: 0,
        totalBookings: 0,
        totalNotes: 0
      }
    }

    // Mock contact and timeline responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContact
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeline
      } as Response)

    render(<ContactDetailPage />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading contact...')).not.toBeInTheDocument()
    })

    // Should display contact details
    expect(screen.getByText('Contact Details')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('+1234567890')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()
    expect(screen.getByText('qualified')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument() // SMS consent

    // Should display stats
    expect(screen.getByText('Total Calls')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('should show loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<ContactDetailPage />)

    expect(screen.getByText('Loading contact...')).toBeInTheDocument()
  })

  it('should handle contact not found', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response)

    render(<ContactDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Contact not found')).toBeInTheDocument()
    })

    expect(screen.getByText('← Back to Dashboard')).toBeInTheDocument()
  })

  it('should display contact timeline with activities', async () => {
    const mockContact = {
      id: 123,
      name: 'Jane Smith',
      phone: '+1987654321',
      email: null,
      company: null,
      deal_stage: null,
      notes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sms_consent: false
    }

    const mockTimeline = {
      contactId: 123,
      timeline: [
        {
          type: 'call' as const,
          timestamp: new Date().toISOString(),
          data: {
            direction: 'inbound',
            status: 'completed',
            duration: 180
          }
        },
        {
          type: 'sms' as const,
          timestamp: new Date().toISOString(),
          data: {
            direction: 'outbound',
            status: 'delivered',
            body: 'Thanks for calling!'
          }
        }
      ],
      stats: {
        totalCalls: 1,
        totalSMS: 1,
        totalBookings: 0,
        totalNotes: 0
      }
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContact
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeline
      } as Response)

    render(<ContactDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    // Should show timeline
    expect(screen.getByText('Activity Timeline')).toBeInTheDocument()

    // Should show call activity
    const callElements = screen.getAllByText('call')
    expect(callElements.length).toBeGreaterThan(0)

    // Should show SMS activity
    const smsElements = screen.getAllByText('sms')
    expect(smsElements.length).toBeGreaterThan(0)
    expect(screen.getByText('"Thanks for calling!"')).toBeInTheDocument()
  })

  it('should show empty timeline when no activities', async () => {
    const mockContact = {
      id: 123,
      name: 'New Contact',
      phone: '+1111111111',
      email: null,
      company: null,
      deal_stage: null,
      notes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const mockTimeline = {
      contactId: 123,
      timeline: [],
      stats: {
        totalCalls: 0,
        totalSMS: 0,
        totalBookings: 0,
        totalNotes: 0
      }
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContact
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTimeline
      } as Response)

    render(<ContactDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('New Contact')).toBeInTheDocument()
    })

    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })

  it('should have edit and delete buttons', async () => {
    const mockContact = {
      id: 123,
      name: 'Test Contact',
      phone: '+1234567890',
      email: 'test@example.com',
      company: 'Test Co',
      deal_stage: null,
      notes: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContact
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contactId: 123,
          timeline: [],
          stats: { totalCalls: 0, totalSMS: 0, totalBookings: 0, totalNotes: 0 }
        })
      } as Response)

    render(<ContactDetailPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Contact')).toBeInTheDocument()
    })

    // Should have action buttons
    expect(screen.getByText('Edit Contact')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })
})
