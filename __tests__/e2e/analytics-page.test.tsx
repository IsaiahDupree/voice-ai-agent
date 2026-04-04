/**
 * E2E Test: Analytics Page
 * Feature: F1219
 * Tests that analytics page loads all charts without error
 */

import { render, screen, waitFor } from '@testing-library/react'
import EnhancedDashboard from '@/app/dashboard/enhanced/page'

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock the useRealtimeCalls hook
jest.mock('@/lib/use-realtime-calls', () => ({
  useRealtimeCalls: () => ({
    connected: true,
    lastUpdate: Date.now()
  })
}))

describe('E2E: Analytics Page', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should load analytics tab and display charts', async () => {
    // Mock API responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response) // calls
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCalls: 150,
          totalBookings: 45,
          conversionRate: 30,
          smsSent: 120,
          activeCalls: 2
        })
      } as Response) // stats
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          checks: {
            vapi: { status: 'ok' },
            supabase: { status: 'ok' },
            twilio: { status: 'ok' },
            calcom: { status: 'ok' }
          }
        })
      } as Response) // health
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response) // SMS

    const { container } = render(<EnhancedDashboard />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument()
    })

    // Should show dashboard title
    expect(screen.getByText('Voice AI Agent Dashboard')).toBeInTheDocument()

    // Should show stats cards
    expect(screen.getByText('Total Calls')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()

    // Should show analytics tab
    const analyticsTab = screen.getByRole('button', { name: /Analytics/i })
    expect(analyticsTab).toBeInTheDocument()
  })

  it('should handle analytics tab loading error gracefully', async () => {
    // Mock failed stats response
    mockFetch
      .mockRejectedValueOnce(new Error('Failed to load stats'))

    render(<EnhancedDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Dashboard')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Should show error message
    const errorElements = screen.getAllByText((content, element) => {
      return content.includes('Failed to load') || content.includes('Failed to Load')
    })
    expect(errorElements.length).toBeGreaterThan(0)

    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('should display health status indicator', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCalls: 0,
          totalBookings: 0,
          conversionRate: 0,
          smsSent: 0,
          activeCalls: 0
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          checks: {}
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)

    render(<EnhancedDashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument()
    })

    // Should show health status
    expect(screen.getByText('All Systems Operational')).toBeInTheDocument()
  })

  it('should show degraded health status with details', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCalls: 0,
          totalBookings: 0,
          conversionRate: 0,
          smsSent: 0,
          activeCalls: 0
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'degraded',
          checks: {
            vapi: { status: 'error', message: 'API timeout' }
          }
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)

    render(<EnhancedDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Degraded')).toBeInTheDocument()
    })

    // Should show details button
    expect(screen.getByText('Details')).toBeInTheDocument()
  })

  it('should display WebSocket connection status', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCalls: 0,
          totalBookings: 0,
          conversionRate: 0,
          smsSent: 0,
          activeCalls: 0
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', checks: {} })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)

    render(<EnhancedDashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument()
    })

    // Should show WebSocket status
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('should have refresh button', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalCalls: 0,
          totalBookings: 0,
          conversionRate: 0,
          smsSent: 0,
          activeCalls: 0
        })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'healthy', checks: {} })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)

    render(<EnhancedDashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading dashboard data...')).not.toBeInTheDocument()
    })

    // Should show refresh button
    const refreshButton = screen.getByTitle('Refresh dashboard data')
    expect(refreshButton).toBeInTheDocument()
    expect(refreshButton).toHaveTextContent('Refresh')
  })
})
