/**
 * Unit tests for RecentCallsFeed dashboard component
 * Tests: loading, error, empty state, badge colors, goal_achieved highlight
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

jest.mock('lucide-react', () => ({
  ChevronRight: () => <svg data-testid="icon-chevron" />,
  Clock: () => <svg data-testid="icon-clock" />,
}))

jest.mock('next/link', () => {
  const Link = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  )
  Link.displayName = 'Link'
  return Link
})

const mockFetch = jest.fn()
global.fetch = mockFetch

let RecentCallsFeed: React.FC
beforeAll(async () => {
  const mod = await import('@/app/dashboard/components/recent-calls-feed')
  RecentCallsFeed = mod.RecentCallsFeed
})

afterEach(() => {
  jest.clearAllMocks()
})

const mockCalls = [
  {
    id: 'call-1',
    phone_number: '+15551234567',
    direction: 'inbound',
    outcome: 'booking_made',
    duration: 120,
    started_at: '2024-01-15T10:00:00Z',
    goal_achieved: true,
  },
  {
    id: 'call-2',
    phone_number: '+15559876543',
    direction: 'outbound',
    outcome: 'no_answer',
    duration: 0,
    started_at: '2024-01-15T11:00:00Z',
    goal_achieved: false,
  },
  {
    id: 'call-3',
    phone_number: '+15555551234',
    direction: 'inbound',
    outcome: 'voicemail',
    duration: 30,
    started_at: '2024-01-15T12:00:00Z',
    goal_achieved: false,
  },
]

describe('RecentCallsFeed', () => {
  describe('loading state', () => {
    it('shows skeleton rows while loading', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))
      const { container } = render(<RecentCallsFeed />)
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBe(3)
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText('Failed to load calls')).toBeInTheDocument()
      })
    })

    it('shows Recent Calls header even on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText('Recent Calls')).toBeInTheDocument()
      })
    })
  })

  describe('empty state', () => {
    it('shows empty state message when no calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText(/No calls yet/)).toBeInTheDocument()
      })
    })

    it('handles data.calls array format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ calls: mockCalls }),
      } as Response)
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText('+15551234567')).toBeInTheDocument()
      })
    })
  })

  describe('success state', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCalls,
      } as Response)
    })

    it('fetches from /api/calls?limit=5', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/calls?limit=5')
      })
    })

    it('shows phone numbers', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText('+15551234567')).toBeInTheDocument()
        expect(screen.getByText('+15559876543')).toBeInTheDocument()
      })
    })

    it('shows direction badges', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getAllByText('inbound').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('outbound').length).toBeGreaterThanOrEqual(1)
      })
    })

    it('applies green badge for inbound direction', async () => {
      const { container } = render(<RecentCallsFeed />)
      await waitFor(() => {
        const inboundBadges = container.querySelectorAll('.bg-green-100.text-green-800')
        expect(inboundBadges.length).toBeGreaterThan(0)
      })
    })

    it('applies blue badge for outbound direction', async () => {
      const { container } = render(<RecentCallsFeed />)
      await waitFor(() => {
        const outboundBadges = container.querySelectorAll('.bg-blue-100.text-blue-800')
        expect(outboundBadges.length).toBeGreaterThan(0)
      })
    })

    it('shows goal badge when goal_achieved is true', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText('✓ Goal')).toBeInTheDocument()
      })
    })

    it('does not show goal badge when goal_achieved is false', async () => {
      // Only call-1 has goal_achieved=true, so there should be exactly 1 goal badge
      render(<RecentCallsFeed />)
      await waitFor(() => {
        const goalBadges = screen.getAllByText('✓ Goal')
        expect(goalBadges.length).toBe(1)
      })
    })

    it('links each call to /dashboard/calls/[id]', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        const link = screen.getByRole('link', { name: /15551234567/ })
        expect(link).toHaveAttribute('href', '/dashboard/calls/call-1')
      })
    })

    it('shows View All Calls link', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        const link = screen.getByText('View All Calls →')
        expect(link).toBeInTheDocument()
        expect(link.closest('a')).toHaveAttribute('href', '/dashboard/calls')
      })
    })

    it('shows duration in seconds', async () => {
      render(<RecentCallsFeed />)
      await waitFor(() => {
        expect(screen.getByText(/120s/)).toBeInTheDocument()
      })
    })
  })

  describe('outcome badge colors', () => {
    it('applies emerald badge for booking_made', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCalls[0]],
      } as Response)
      const { container } = render(<RecentCallsFeed />)
      await waitFor(() => {
        const badges = container.querySelectorAll('.bg-emerald-100.text-emerald-700')
        // booking_made outcome + goal badge both use emerald
        expect(badges.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('applies red badge for no_answer', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCalls[1]],
      } as Response)
      const { container } = render(<RecentCallsFeed />)
      await waitFor(() => {
        const badges = container.querySelectorAll('.bg-red-100.text-red-700')
        expect(badges.length).toBeGreaterThan(0)
      })
    })

    it('applies gray badge for voicemail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCalls[2]],
      } as Response)
      const { container } = render(<RecentCallsFeed />)
      await waitFor(() => {
        const badges = container.querySelectorAll('.bg-gray-100.text-gray-600')
        expect(badges.length).toBeGreaterThan(0)
      })
    })
  })
})
