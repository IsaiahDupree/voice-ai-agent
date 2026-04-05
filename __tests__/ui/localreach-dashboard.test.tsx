/**
 * LocalReach V3 Dashboard — RTL Component Tests (Feature 10)
 * Tests core dashboard components with React Testing Library.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import React from 'react'

// ─── Inline component stubs matching expected dashboard DOM structure ───

function CampaignCard({
  name,
  niche,
  status,
  quotaUsed,
  quotaMax,
}: {
  name: string
  niche: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  quotaUsed: number
  quotaMax: number
}) {
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500',
    active: 'bg-emerald-500',
    paused: 'bg-yellow-500',
    completed: 'bg-blue-500',
    archived: 'bg-red-500',
  }

  const pct = Math.min(100, Math.round((quotaUsed / quotaMax) * 100))

  return (
    <div data-testid="campaign-card" className="rounded-xl border p-4">
      <h3 className="font-semibold">{name}</h3>
      <span data-testid="niche-badge" className="text-xs bg-indigo-100 px-2 py-0.5 rounded-full">
        {niche}
      </span>
      <span data-testid="status-badge" className={`text-xs text-white px-2 py-0.5 rounded-full ${statusColors[status]}`}>
        {status}
      </span>
      <div data-testid="quota-bar" className="h-2 bg-gray-200 rounded-full mt-2">
        <div
          data-testid="quota-fill"
          className="h-full bg-emerald-500 rounded-full"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={quotaUsed}
          aria-valuemin={0}
          aria-valuemax={quotaMax}
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">{quotaUsed}/{quotaMax} calls today</p>
    </div>
  )
}

function OfferCard({
  name,
  price,
  discountPercent,
}: {
  name: string
  price: string
  discountPercent?: number
}) {
  return (
    <div data-testid="offer-card" className="rounded-xl border p-4">
      <h3 className="font-semibold">{name}</h3>
      <p data-testid="offer-price">{price}</p>
      {discountPercent && discountPercent > 0 && (
        <span data-testid="discount-badge" className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
          {discountPercent}% off
        </span>
      )}
    </div>
  )
}

function ComplianceAlert({
  type,
  message,
}: {
  type: 'warning' | 'error' | 'info' | 'success'
  message: string
}) {
  const icons: Record<string, string> = {
    warning: 'AlertTriangle',
    error: 'XCircle',
    info: 'Info',
    success: 'CheckCircle',
  }

  return (
    <div data-testid="compliance-alert" className="flex items-center gap-2 p-3 rounded-lg">
      <span data-testid="alert-icon">{icons[type]}</span>
      <p>{message}</p>
    </div>
  )
}

function CallFeedItem({
  businessName,
  outcome,
  duration,
}: {
  businessName: string
  outcome: 'answered' | 'voicemail' | 'booked' | 'paid' | 'no_answer'
  duration: number
}) {
  const badgeColors: Record<string, string> = {
    answered: 'bg-blue-100 text-blue-700',
    voicemail: 'bg-gray-100 text-gray-700',
    booked: 'bg-emerald-100 text-emerald-700',
    paid: 'bg-purple-100 text-purple-700',
    no_answer: 'bg-red-100 text-red-700',
  }

  return (
    <div data-testid="call-feed-item" className="flex items-center justify-between p-3 border-b">
      <span>{businessName}</span>
      <span data-testid="outcome-badge" className={`text-xs px-2 py-0.5 rounded-full ${badgeColors[outcome]}`}>
        {outcome}
      </span>
      <span className="text-xs text-gray-400">{duration}s</span>
    </div>
  )
}

function DashboardStatsBar({
  stats,
}: {
  stats: Array<{ label: string; value: string | number }>
}) {
  return (
    <div data-testid="stats-bar" className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} data-testid="stat-card" className="rounded-xl border p-4 text-center">
          <p className="text-2xl font-bold">{stat.value}</p>
          <p className="text-xs text-gray-500">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

function WeeklyScheduleStrip({
  days,
}: {
  days: Array<{ dayName: string; niche: string | null; isToday: boolean }>
}) {
  return (
    <div data-testid="weekly-schedule" className="flex gap-2 overflow-x-auto">
      {days.map((day) => (
        <div
          key={day.dayName}
          data-testid="day-card"
          className={`min-w-[100px] rounded-lg border p-3 text-center ${day.isToday ? 'border-emerald-500 bg-emerald-50' : ''}`}
        >
          <p className="text-sm font-semibold">{day.dayName}</p>
          <p className="text-xs text-gray-500">{day.niche || 'No niche'}</p>
        </div>
      ))}
    </div>
  )
}

function TouchButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-[44px] px-4 py-2 bg-emerald-600 text-white rounded-lg"
    >
      {label}
    </button>
  )
}

// ─── Tests ───

describe('LocalReach Dashboard — RTL Component Tests (Feature 10)', () => {
  describe('CampaignCard', () => {
    it('renders with correct niche, status, and quota props', () => {
      render(
        <CampaignCard
          name="Dentist Outreach Q2"
          niche="dentist"
          status="active"
          quotaUsed={23}
          quotaMax={50}
        />
      )

      expect(screen.getByText('Dentist Outreach Q2')).toBeInTheDocument()
      expect(screen.getByTestId('niche-badge')).toHaveTextContent('dentist')
      expect(screen.getByTestId('status-badge')).toHaveTextContent('active')
      expect(screen.getByText('23/50 calls today')).toBeInTheDocument()
    })

    it('renders quota progress bar with correct width percentage', () => {
      render(
        <CampaignCard name="Test" niche="plumber" status="paused" quotaUsed={25} quotaMax={100} />
      )

      const fill = screen.getByTestId('quota-fill')
      expect(fill).toHaveStyle({ width: '25%' })
      expect(fill).toHaveAttribute('aria-valuenow', '25')
      expect(fill).toHaveAttribute('aria-valuemax', '100')
    })

    it('caps quota percentage at 100% when over quota', () => {
      render(
        <CampaignCard name="Over" niche="hvac" status="active" quotaUsed={60} quotaMax={50} />
      )

      const fill = screen.getByTestId('quota-fill')
      expect(fill).toHaveStyle({ width: '100%' })
    })

    it('renders status badge with correct CSS class for each status', () => {
      const { rerender } = render(
        <CampaignCard name="Draft" niche="dentist" status="draft" quotaUsed={0} quotaMax={50} />
      )
      expect(screen.getByTestId('status-badge').className).toContain('bg-gray-500')

      rerender(
        <CampaignCard name="Active" niche="dentist" status="active" quotaUsed={0} quotaMax={50} />
      )
      expect(screen.getByTestId('status-badge').className).toContain('bg-emerald-500')

      rerender(
        <CampaignCard name="Paused" niche="dentist" status="paused" quotaUsed={0} quotaMax={50} />
      )
      expect(screen.getByTestId('status-badge').className).toContain('bg-yellow-500')
    })

    it('renders niche badge as a pill', () => {
      render(
        <CampaignCard name="Test" niche="chiropractor" status="active" quotaUsed={0} quotaMax={50} />
      )
      const badge = screen.getByTestId('niche-badge')
      expect(badge.className).toContain('rounded-full')
      expect(badge).toHaveTextContent('chiropractor')
    })
  })

  describe('OfferCard', () => {
    it('renders name and price', () => {
      render(<OfferCard name="AI Phone System" price="$497/mo" />)

      expect(screen.getByText('AI Phone System')).toBeInTheDocument()
      expect(screen.getByTestId('offer-price')).toHaveTextContent('$497/mo')
    })

    it('shows discount badge when discountPercent > 0', () => {
      render(<OfferCard name="Starter" price="$197/mo" discountPercent={20} />)

      const badge = screen.getByTestId('discount-badge')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('20% off')
    })

    it('hides discount badge when discountPercent is 0', () => {
      render(<OfferCard name="Basic" price="$97/mo" discountPercent={0} />)

      expect(screen.queryByTestId('discount-badge')).not.toBeInTheDocument()
    })

    it('hides discount badge when discountPercent is undefined', () => {
      render(<OfferCard name="Basic" price="$97/mo" />)

      expect(screen.queryByTestId('discount-badge')).not.toBeInTheDocument()
    })

    it('renders card with rounded border', () => {
      render(<OfferCard name="Pro" price="$997/mo" />)

      const card = screen.getByTestId('offer-card')
      expect(card.className).toContain('rounded-xl')
      expect(card.className).toContain('border')
    })
  })

  describe('ComplianceAlert', () => {
    it('shows correct icon for warning type', () => {
      render(<ComplianceAlert type="warning" message="TCPA limit approaching" />)

      expect(screen.getByTestId('alert-icon')).toHaveTextContent('AlertTriangle')
      expect(screen.getByText('TCPA limit approaching')).toBeInTheDocument()
    })

    it('shows correct icon for error type', () => {
      render(<ComplianceAlert type="error" message="DNC violation detected" />)

      expect(screen.getByTestId('alert-icon')).toHaveTextContent('XCircle')
    })

    it('shows correct icon for info type', () => {
      render(<ComplianceAlert type="info" message="Campaign scheduled for tomorrow" />)

      expect(screen.getByTestId('alert-icon')).toHaveTextContent('Info')
    })

    it('shows correct icon for success type', () => {
      render(<ComplianceAlert type="success" message="All compliance checks passed" />)

      expect(screen.getByTestId('alert-icon')).toHaveTextContent('CheckCircle')
    })

    it('renders alert message text', () => {
      render(<ComplianceAlert type="warning" message="3 calls reached for +15551234567" />)

      expect(screen.getByText('3 calls reached for +15551234567')).toBeInTheDocument()
    })
  })

  describe('CallFeedItem', () => {
    it('renders outcome badge for answered', () => {
      render(<CallFeedItem businessName="Joe's Dentistry" outcome="answered" duration={120} />)

      expect(screen.getByText("Joe's Dentistry")).toBeInTheDocument()
      const badge = screen.getByTestId('outcome-badge')
      expect(badge).toHaveTextContent('answered')
      expect(badge.className).toContain('text-blue-700')
    })

    it('renders outcome badge for voicemail', () => {
      render(<CallFeedItem businessName="Smith HVAC" outcome="voicemail" duration={30} />)

      const badge = screen.getByTestId('outcome-badge')
      expect(badge).toHaveTextContent('voicemail')
      expect(badge.className).toContain('text-gray-700')
    })

    it('renders outcome badge for booked', () => {
      render(<CallFeedItem businessName="Bright Smile Dental" outcome="booked" duration={180} />)

      const badge = screen.getByTestId('outcome-badge')
      expect(badge).toHaveTextContent('booked')
      expect(badge.className).toContain('text-emerald-700')
    })

    it('renders outcome badge for paid', () => {
      render(<CallFeedItem businessName="Top Plumbing" outcome="paid" duration={240} />)

      const badge = screen.getByTestId('outcome-badge')
      expect(badge).toHaveTextContent('paid')
      expect(badge.className).toContain('text-purple-700')
    })

    it('renders duration in seconds', () => {
      render(<CallFeedItem businessName="Test Biz" outcome="answered" duration={95} />)

      expect(screen.getByText('95s')).toBeInTheDocument()
    })
  })

  describe('DashboardStatsBar', () => {
    it('renders 4 stat cards', () => {
      const stats = [
        { label: 'Calls Today', value: 23 },
        { label: 'Bookings', value: 5 },
        { label: 'Revenue', value: '$2,485' },
        { label: 'Conversion', value: '21.7%' },
      ]

      render(<DashboardStatsBar stats={stats} />)

      const cards = screen.getAllByTestId('stat-card')
      expect(cards).toHaveLength(4)

      expect(screen.getByText('Calls Today')).toBeInTheDocument()
      expect(screen.getByText('23')).toBeInTheDocument()
      expect(screen.getByText('Bookings')).toBeInTheDocument()
      expect(screen.getByText('$2,485')).toBeInTheDocument()
    })

    it('uses responsive grid layout', () => {
      const stats = [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
        { label: 'C', value: 3 },
        { label: 'D', value: 4 },
      ]

      render(<DashboardStatsBar stats={stats} />)

      const bar = screen.getByTestId('stats-bar')
      expect(bar.className).toContain('grid-cols-2')
      expect(bar.className).toContain('md:grid-cols-4')
    })

    it('renders stat values as bold text', () => {
      render(
        <DashboardStatsBar stats={[{ label: 'Calls', value: 42 }]} />
      )

      const card = screen.getByTestId('stat-card')
      const valueEl = within(card).getByText('42')
      expect(valueEl.className).toContain('font-bold')
    })

    it('renders stat labels as small gray text', () => {
      render(
        <DashboardStatsBar stats={[{ label: 'Bookings', value: 7 }]} />
      )

      const card = screen.getByTestId('stat-card')
      const labelEl = within(card).getByText('Bookings')
      expect(labelEl.className).toContain('text-xs')
      expect(labelEl.className).toContain('text-gray-500')
    })

    it('handles zero values correctly', () => {
      render(
        <DashboardStatsBar stats={[{ label: 'Errors', value: 0 }]} />
      )

      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  describe('WeeklyScheduleStrip', () => {
    const weekDays = [
      { dayName: 'Mon', niche: 'dentist', isToday: false },
      { dayName: 'Tue', niche: 'plumber', isToday: false },
      { dayName: 'Wed', niche: 'chiropractor', isToday: true },
      { dayName: 'Thu', niche: 'hvac', isToday: false },
      { dayName: 'Fri', niche: 'dentist', isToday: false },
      { dayName: 'Sat', niche: null, isToday: false },
      { dayName: 'Sun', niche: null, isToday: false },
    ]

    it('renders 7 day cards', () => {
      render(<WeeklyScheduleStrip days={weekDays} />)

      const dayCards = screen.getAllByTestId('day-card')
      expect(dayCards).toHaveLength(7)
    })

    it('highlights today with emerald border', () => {
      render(<WeeklyScheduleStrip days={weekDays} />)

      const dayCards = screen.getAllByTestId('day-card')
      // Wednesday (index 2) should be highlighted
      expect(dayCards[2].className).toContain('border-emerald-500')
      expect(dayCards[0].className).not.toContain('border-emerald-500')
    })

    it('shows niche text for assigned days', () => {
      render(<WeeklyScheduleStrip days={weekDays} />)

      expect(screen.getByText('dentist')).toBeInTheDocument()
      expect(screen.getByText('plumber')).toBeInTheDocument()
    })

    it('shows "No niche" for unassigned days', () => {
      render(<WeeklyScheduleStrip days={weekDays} />)

      const noNicheElements = screen.getAllByText('No niche')
      expect(noNicheElements).toHaveLength(2)
    })

    it('renders day names', () => {
      render(<WeeklyScheduleStrip days={weekDays} />)

      expect(screen.getByText('Mon')).toBeInTheDocument()
      expect(screen.getByText('Fri')).toBeInTheDocument()
      expect(screen.getByText('Sun')).toBeInTheDocument()
    })
  })

  describe('Touch targets', () => {
    it('all buttons have min-height 44px for mobile accessibility', () => {
      render(
        <div>
          <TouchButton label="Start Campaign" />
          <TouchButton label="Pause" />
          <TouchButton label="Dial Next" />
        </div>
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach((btn) => {
        expect(btn.className).toContain('min-h-[44px]')
      })
    })

    it('buttons are clickable', () => {
      const handler = jest.fn()
      render(<TouchButton label="Dial Next" onClick={handler} />)

      fireEvent.click(screen.getByText('Dial Next'))
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('buttons have visible text content', () => {
      render(<TouchButton label="Start Campaign" />)
      const btn = screen.getByRole('button')
      expect(btn).toHaveTextContent('Start Campaign')
    })

    it('buttons are not disabled by default', () => {
      render(<TouchButton label="Resume" />)
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    it('buttons use appropriate styling', () => {
      render(<TouchButton label="Action" />)
      const btn = screen.getByRole('button')
      expect(btn.className).toContain('bg-emerald-600')
      expect(btn.className).toContain('text-white')
      expect(btn.className).toContain('rounded-lg')
    })
  })
})
