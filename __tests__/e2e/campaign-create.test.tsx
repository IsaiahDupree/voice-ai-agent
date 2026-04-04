/**
 * E2E Test: Campaign Creation
 * Feature: F1216
 * Tests that campaigns can be created via UI and appear in the list
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CampaignTab from '@/app/dashboard/components/CampaignTab'

// Mock fetch globally
global.fetch = jest.fn()
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

// Mock alert and confirm
global.alert = jest.fn()
global.confirm = jest.fn(() => true)

describe('E2E: Campaign Creation', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    ;(global.alert as jest.Mock).mockClear()
    ;(global.confirm as jest.Mock).mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should display campaign creation button', async () => {
    // Mock empty campaigns
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [] })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.queryByText('Loading campaigns...')).not.toBeInTheDocument()
    })

    // Should show "New Campaign" button
    expect(screen.getByText('+ New Campaign')).toBeInTheDocument()
    expect(screen.getByText('+ New Campaign')).toHaveAttribute('href', '/dashboard/campaigns/new')
  })

  it('should display empty state when no campaigns exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [] })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('No campaigns yet. Create one to get started.')).toBeInTheDocument()
    })
  })

  it('should display existing campaigns with all details', async () => {
    const mockCampaigns = [
      {
        id: 1,
        name: 'Test Campaign',
        status: 'draft' as const,
        total_contacts: 100,
        calls_attempted: 0,
        calls_completed: 0,
        calls_successful: 0,
        started_at: null,
        ended_at: null
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Test Campaign')).toBeInTheDocument()
    })

    // Check campaign details (use getAllByText for potentially duplicate text)
    const draftElements = screen.getAllByText('draft')
    expect(draftElements.length).toBeGreaterThan(0)
    expect(screen.getByText('0 / 100 contacts attempted')).toBeInTheDocument()

    const percentageElements = screen.getAllByText('0%')
    expect(percentageElements.length).toBeGreaterThan(0)

    // Should show Start button for draft campaigns
    const startButtons = screen.getAllByText('Start')
    expect(startButtons.length).toBeGreaterThan(0)
    const viewDetailsLinks = screen.getAllByText('View Details')
    expect(viewDetailsLinks.length).toBeGreaterThan(0)
  })

  it('should show progress for running campaigns', async () => {
    const mockCampaigns = [
      {
        id: 2,
        name: 'Active Campaign',
        status: 'running' as const,
        total_contacts: 100,
        calls_attempted: 50,
        calls_completed: 45,
        calls_successful: 30,
        started_at: new Date().toISOString(),
        ended_at: null
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Active Campaign')).toBeInTheDocument()
    })

    // Check status
    expect(screen.getByText('running')).toBeInTheDocument()

    // Check progress
    expect(screen.getByText('50 / 100 contacts attempted')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()

    // Check stats
    expect(screen.getByText('45')).toBeInTheDocument() // Completed
    expect(screen.getByText('30')).toBeInTheDocument() // Successful

    // Should show Stop button for running campaigns
    expect(screen.getByText('Stop')).toBeInTheDocument()
  })

  it('should calculate success rate correctly', async () => {
    const mockCampaigns = [
      {
        id: 3,
        name: 'Success Rate Test',
        status: 'running' as const,
        total_contacts: 100,
        calls_attempted: 80,
        calls_completed: 80,
        calls_successful: 60,
        started_at: new Date().toISOString(),
        ended_at: null
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Success Rate Test')).toBeInTheDocument()
    })

    // Success rate should be 60/80 = 75%
    const successRateElements = screen.getAllByText('75%')
    expect(successRateElements.length).toBeGreaterThan(0)
  })

  it('should allow starting a draft campaign', async () => {
    const user = userEvent.setup()

    const mockCampaigns = [
      {
        id: 4,
        name: 'Draft Campaign',
        status: 'draft' as const,
        total_contacts: 50,
        calls_attempted: 0,
        calls_completed: 0,
        calls_successful: 0,
        started_at: null,
        ended_at: null
      }
    ]

    // Initial load
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Draft Campaign')).toBeInTheDocument()
    })

    // Mock start campaign response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response)

    // Mock reload after start
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        campaigns: [
          { ...mockCampaigns[0], status: 'running', started_at: new Date().toISOString() }
        ]
      })
    } as Response)

    const startButton = screen.getByText('Start')
    await user.click(startButton)

    // Should confirm
    expect(global.confirm).toHaveBeenCalledWith('Start this campaign?')

    // Should show success alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Campaign started!')
    })

    // Should call start API
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaigns/4/start',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should allow stopping a running campaign', async () => {
    const user = userEvent.setup()

    const mockCampaigns = [
      {
        id: 5,
        name: 'Running Campaign',
        status: 'running' as const,
        total_contacts: 50,
        calls_attempted: 25,
        calls_completed: 20,
        calls_successful: 15,
        started_at: new Date().toISOString(),
        ended_at: null
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Running Campaign')).toBeInTheDocument()
    })

    // Mock stop campaign response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    } as Response)

    // Mock reload after stop
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        campaigns: [
          { ...mockCampaigns[0], status: 'paused' }
        ]
      })
    } as Response)

    const stopButton = screen.getByText('Stop')
    await user.click(stopButton)

    // Should confirm
    expect(global.confirm).toHaveBeenCalledWith('Stop this campaign?')

    // Should show success alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Campaign stopped!')
    })

    // Should call stop API
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/campaigns/5/stop',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should show completed campaigns without action buttons', async () => {
    const mockCampaigns = [
      {
        id: 6,
        name: 'Completed Campaign',
        status: 'completed' as const,
        total_contacts: 100,
        calls_attempted: 100,
        calls_completed: 95,
        calls_successful: 80,
        started_at: new Date(Date.now() - 86400000).toISOString(),
        ended_at: new Date().toISOString()
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Completed Campaign')).toBeInTheDocument()
    })

    // Should show completed status
    expect(screen.getByText('completed')).toBeInTheDocument()

    // Should show 100% progress
    expect(screen.getByText('100%')).toBeInTheDocument()

    // Should only have View Details button, no Start/Stop
    expect(screen.queryByText('Start')).not.toBeInTheDocument()
    expect(screen.queryByText('Stop')).not.toBeInTheDocument()
    expect(screen.getByText('View Details')).toBeInTheDocument()
  })

  it('should handle start campaign errors gracefully', async () => {
    const user = userEvent.setup()

    const mockCampaigns = [
      {
        id: 7,
        name: 'Error Test Campaign',
        status: 'draft' as const,
        total_contacts: 50,
        calls_attempted: 0,
        calls_completed: 0,
        calls_successful: 0,
        started_at: null,
        ended_at: null
      }
    ]

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: mockCampaigns })
    } as Response)

    render(<CampaignTab />)

    await waitFor(() => {
      expect(screen.getByText('Error Test Campaign')).toBeInTheDocument()
    })

    // Mock failed start
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'No contacts in campaign' })
    } as Response)

    const startButton = screen.getByText('Start')
    await user.click(startButton)

    // Should show error alert
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to start: No contacts in campaign')
    })
  })

  it('should display loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<CampaignTab />)

    expect(screen.getByText('Loading campaigns...')).toBeInTheDocument()
  })
})
