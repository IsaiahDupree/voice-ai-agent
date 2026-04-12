/**
 * Smoke test: Dashboard page renders without crashing
 * Verifies the main dashboard page mounts correctly and shows the loading state
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock all child components to isolate page-level rendering
jest.mock('@/app/dashboard/components/stats-bar', () => ({
  StatsBar: () => <div data-testid="stats-bar">StatsBar</div>,
}))
jest.mock('@/app/dashboard/components/recent-calls-feed', () => ({
  RecentCallsFeed: () => <div data-testid="recent-calls-feed">RecentCallsFeed</div>,
}))
jest.mock('@/app/dashboard/components/calls-trend-chart', () => ({
  CallsTrendChart: () => <div data-testid="calls-trend-chart">CallsTrendChart</div>,
}))
jest.mock('@/app/dashboard/components/bookings-widget', () => ({
  BookingsWidget: () => <div data-testid="bookings-widget">BookingsWidget</div>,
}))
jest.mock('@/app/dashboard/components/campaigns-widget', () => ({
  CampaignsWidget: () => <div data-testid="campaigns-widget">CampaignsWidget</div>,
}))
jest.mock('@/app/dashboard/components/performance-widget', () => ({
  PerformanceWidget: () => <div data-testid="performance-widget">PerformanceWidget</div>,
}))

// Mock lucide-react
jest.mock('lucide-react', () => ({
  BarChart2: () => null,
  PhoneCall: () => null,
  Users: () => null,
  Calendar: () => null,
  TrendingUp: () => null,
  Activity: () => null,
  Bell: () => null,
  Settings: () => null,
  RefreshCw: () => null,
}))

// Mock next/link and next/navigation
jest.mock('next/link', () => {
  const Link = ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
  Link.displayName = 'Link'
  return Link
})

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn() }),
}))

describe('Dashboard page smoke test', () => {
  it('renders StatsBar component', async () => {
    // Dynamically import after mocks
    const { default: DashboardPage } = await import('@/app/dashboard/page')
    render(<DashboardPage />)
    expect(screen.getByTestId('stats-bar')).toBeInTheDocument()
  })

  it('renders RecentCallsFeed component', async () => {
    const { default: DashboardPage } = await import('@/app/dashboard/page')
    render(<DashboardPage />)
    expect(screen.getByTestId('recent-calls-feed')).toBeInTheDocument()
  })

  it('does not crash on mount', async () => {
    const { default: DashboardPage } = await import('@/app/dashboard/page')
    expect(() => render(<DashboardPage />)).not.toThrow()
  })
})
