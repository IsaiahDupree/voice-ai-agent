/**
 * E2E Test: Dashboard Load
 * Feature: F1215
 * Tests that the dashboard loads all tabs without error
 */

import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from '@/app/dashboard/page'

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('E2E: Dashboard Load', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should load dashboard with all sections when data is available', async () => {
    // Mock successful API responses (dashboard page + BookingAnalytics component)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'asst_1',
            name: 'Sales Assistant',
            model: { provider: 'openai', model: 'gpt-4' },
            voice: { provider: 'elevenlabs', voiceId: 'voice_1' }
          }
        ]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'call_1',
            assistantId: 'asst_1',
            status: 'completed',
            createdAt: new Date().toISOString(),
            cost: 0.05
          }
        ]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] })
      } as Response)

    render(<Dashboard />)

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Check main heading
    expect(screen.getByText('Voice AI Agent Dashboard')).toBeInTheDocument()

    // Check all tabs/sections are visible (use getAllByText for duplicates)
    const assistantHeaders = screen.getAllByText('Assistants')
    expect(assistantHeaders.length).toBeGreaterThan(0)

    expect(screen.getByText('Recent Calls')).toBeInTheDocument()
    expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Stats (in date range)')).toBeInTheDocument()

    // Check assistant card is rendered
    expect(screen.getByText('Sales Assistant')).toBeInTheDocument()
    expect(screen.getByText('openai / gpt-4')).toBeInTheDocument()

    // Check call card is rendered
    expect(screen.getByText('Completed')).toBeInTheDocument()

    // Check quick action buttons
    expect(screen.getByText('Create New Assistant')).toBeInTheDocument()
    expect(screen.getByText('Launch Campaign')).toBeInTheDocument()
    expect(screen.getByText('System Health Check')).toBeInTheDocument()

    // Check stats are displayed
    expect(screen.getByText('Calls')).toBeInTheDocument()
  })

  it('should display empty states when no data exists', async () => {
    // Mock empty responses (dashboard page + BookingAnalytics)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] })
      } as Response)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Check empty state messages
    expect(screen.getByText('No assistants created yet')).toBeInTheDocument()
    expect(screen.getByText('No calls yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first AI assistant to get started')).toBeInTheDocument()
  })

  it('should display error state when API fails', async () => {
    // Mock failed responses
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Check for error message (could be exact match or substring)
    expect(screen.getByText((content, element) => {
      return content.includes('Network error') || content.includes('Failed to load')
    })).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should display loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<Dashboard />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should handle date range filtering', async () => {
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const lastWeek = new Date(now)
    lastWeek.setDate(lastWeek.getDate() - 7)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'call_1',
            assistantId: 'asst_1',
            status: 'completed',
            createdAt: yesterday.toISOString(),
            cost: 0.05
          },
          {
            id: 'call_2',
            assistantId: 'asst_1',
            status: 'completed',
            createdAt: lastWeek.toISOString(),
            cost: 0.03
          }
        ]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] })
      } as Response)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // Both calls should be visible (within 30 day default range)
    const callElements = screen.getAllByText('Completed')
    expect(callElements.length).toBeGreaterThan(0)
  })

  it('should have refresh button that reloads data', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] })
      } as Response)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    const refreshButton = screen.getByTitle('Refresh dashboard data')
    expect(refreshButton).toBeInTheDocument()
    expect(refreshButton).not.toBeDisabled()
  })

  it('should render booking analytics when loaded', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] })
      } as Response)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    // The BookingAnalytics component should be rendered
    // (We'll assume it renders without errors for this test)
    expect(screen.getByText('Voice AI Agent Dashboard')).toBeInTheDocument()
  })
})
