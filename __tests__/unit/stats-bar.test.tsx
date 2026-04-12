/**
 * Unit tests for StatsBar dashboard component
 * Tests: loading state, error state, stat card rendering with real data
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Phone: () => <svg data-testid="icon-phone" />,
  PhoneOutgoing: () => <svg data-testid="icon-phone-outgoing" />,
  PhoneIncoming: () => <svg data-testid="icon-phone-incoming" />,
  Clock: () => <svg data-testid="icon-clock" />,
  CheckCircle: () => <svg data-testid="icon-check-circle" />,
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

// Lazily import after mocks are set up
let StatsBar: React.FC
beforeAll(async () => {
  const mod = await import('@/app/dashboard/components/stats-bar')
  StatsBar = mod.StatsBar
})

afterEach(() => {
  jest.clearAllMocks()
})

const mockStats = {
  inbound_count: 12,
  outbound_count: 8,
  total_duration: 3600,
  answer_rate: 0.75,
  goal_achieved_count: 5,
}

describe('StatsBar', () => {
  describe('loading state', () => {
    it('shows 4 skeleton cards while loading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})) // never resolves
      const { container } = render(<StatsBar />)
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBe(4)
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load call statistics')).toBeInTheDocument()
      })
    })

    it('shows error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false } as Response)
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load call statistics')).toBeInTheDocument()
      })
    })
  })

  describe('success state', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as Response)
    })

    it('fetches from /api/analytics/calls?period=today', async () => {
      render(<StatsBar />)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/analytics/calls?period=today')
      })
    })

    it('shows Total Calls as sum of inbound + outbound', async () => {
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Total Calls')).toBeInTheDocument()
        expect(screen.getByText('20')).toBeInTheDocument() // 12 + 8
      })
    })

    it('shows inbound count', async () => {
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Inbound')).toBeInTheDocument()
        expect(screen.getByText('12')).toBeInTheDocument()
      })
    })

    it('shows outbound count', async () => {
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Outbound')).toBeInTheDocument()
        expect(screen.getByText('8')).toBeInTheDocument()
      })
    })

    it('shows goal_achieved_count as Successful', async () => {
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Successful')).toBeInTheDocument()
        expect(screen.getByText('5')).toBeInTheDocument()
      })
    })

    it('renders 4 stat cards', async () => {
      const { container } = render(<StatsBar />)
      await waitFor(() => {
        const cards = container.querySelectorAll('.rounded-lg.border.bg-card')
        expect(cards.length).toBe(4)
      })
    })
  })

  describe('edge cases', () => {
    it('shows 0 for missing goal_achieved_count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ inbound_count: 3, outbound_count: 2, total_duration: 100, answer_rate: 0.5 }),
      } as Response)
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Successful')).toBeInTheDocument()
        // goal_achieved_count is undefined → defaults to 0
        const values = screen.getAllByText('0')
        expect(values.length).toBeGreaterThan(0)
      })
    })

    it('shows 0 total when both inbound and outbound are 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ inbound_count: 0, outbound_count: 0, total_duration: 0, answer_rate: 0, goal_achieved_count: 0 }),
      } as Response)
      render(<StatsBar />)
      await waitFor(() => {
        expect(screen.getByText('Total Calls')).toBeInTheDocument()
        const zeros = screen.getAllByText('0')
        expect(zeros.length).toBe(4) // all four cards show 0
      })
    })
  })
})
