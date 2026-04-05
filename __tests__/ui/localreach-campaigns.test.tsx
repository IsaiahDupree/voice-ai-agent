/**
 * LocalReach V3 — Campaign UI Tests
 * Tests campaign card rendering, status badges, quota bars, and form validation.
 */

import { render, screen, fireEvent, within } from '@testing-library/react'
import React, { useState } from 'react'

// ─── Components under test ───

function CampaignCard({
  name,
  niche,
  status,
  quotaUsed,
  quotaMax,
  callingHoursStart,
  callingHoursEnd,
}: {
  name: string
  niche: string
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  quotaUsed: number
  quotaMax: number
  callingHoursStart?: string
  callingHoursEnd?: string
}) {
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-400 text-gray-900',
    active: 'bg-emerald-500 text-white',
    paused: 'bg-yellow-500 text-yellow-900',
    completed: 'bg-blue-500 text-white',
    archived: 'bg-red-400 text-white',
  }

  const pct = Math.min(100, Math.round((quotaUsed / quotaMax) * 100))

  return (
    <div
      data-testid="campaign-card"
      className="w-full rounded-xl border p-4 flex flex-col gap-2 sm:p-5 md:p-6"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base md:text-lg truncate">{name}</h3>
        <span
          data-testid="status-badge"
          className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColors[status]}`}
        >
          {status}
        </span>
      </div>
      <span
        data-testid="niche-badge"
        className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full w-fit"
      >
        {niche}
      </span>
      <div data-testid="quota-section">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Quota</span>
          <span>{quotaUsed}/{quotaMax}</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            data-testid="quota-fill"
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {callingHoursStart && callingHoursEnd && (
        <p className="text-xs text-gray-400">
          Calling: {callingHoursStart} — {callingHoursEnd}
        </p>
      )}
    </div>
  )
}

function NewCampaignForm({
  onSubmit,
}: {
  onSubmit: (data: { name: string; niche: string }) => void
}) {
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Campaign name is required'
    if (!niche.trim()) newErrors.niche = 'Niche is required'
    return newErrors
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors = validate()
    setErrors(newErrors)
    if (Object.keys(newErrors).length === 0) {
      onSubmit({ name: name.trim(), niche: niche.trim() })
    }
  }

  return (
    <form data-testid="campaign-form" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="campaign-name">Campaign Name</label>
        <input
          id="campaign-name"
          data-testid="input-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg p-2"
        />
        {errors.name && (
          <p data-testid="error-name" className="text-red-500 text-xs mt-1">
            {errors.name}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="campaign-niche">Niche</label>
        <input
          id="campaign-niche"
          data-testid="input-niche"
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          className="w-full border rounded-lg p-2"
        />
        {errors.niche && (
          <p data-testid="error-niche" className="text-red-500 text-xs mt-1">
            {errors.niche}
          </p>
        )}
      </div>
      <button
        type="submit"
        data-testid="submit-btn"
        className="min-h-[44px] px-4 py-2 bg-emerald-600 text-white rounded-lg mt-4"
      >
        Create Campaign
      </button>
    </form>
  )
}

// ─── Tests ───

describe('LocalReach Campaign UI Tests', () => {
  describe('CampaignCard on mobile viewport', () => {
    it('renders campaign name and niche', () => {
      render(
        <CampaignCard
          name="Dentist Outreach Q2"
          niche="dentist"
          status="active"
          quotaUsed={15}
          quotaMax={50}
        />
      )

      expect(screen.getByText('Dentist Outreach Q2')).toBeInTheDocument()
      expect(screen.getByTestId('niche-badge')).toHaveTextContent('dentist')
    })

    it('card is full width for mobile viewport', () => {
      render(
        <CampaignCard name="Test" niche="plumber" status="draft" quotaUsed={0} quotaMax={50} />
      )

      const card = screen.getByTestId('campaign-card')
      expect(card.className).toContain('w-full')
    })

    it('card has responsive padding', () => {
      render(
        <CampaignCard name="Test" niche="plumber" status="draft" quotaUsed={0} quotaMax={50} />
      )

      const card = screen.getByTestId('campaign-card')
      expect(card.className).toContain('p-4')
      expect(card.className).toContain('sm:p-5')
      expect(card.className).toContain('md:p-6')
    })

    it('truncates long campaign names', () => {
      render(
        <CampaignCard
          name="Super Long Campaign Name That Should Be Truncated On Small Screens"
          niche="hvac"
          status="active"
          quotaUsed={10}
          quotaMax={50}
        />
      )

      const heading = screen.getByRole('heading')
      expect(heading.className).toContain('truncate')
    })

    it('renders calling hours when provided', () => {
      render(
        <CampaignCard
          name="Test"
          niche="dentist"
          status="active"
          quotaUsed={0}
          quotaMax={50}
          callingHoursStart="09:00"
          callingHoursEnd="17:00"
        />
      )

      expect(screen.getByText(/Calling: 09:00/)).toBeInTheDocument()
    })
  })

  describe('Status badge colors', () => {
    it('draft status uses gray background', () => {
      render(
        <CampaignCard name="Draft" niche="dentist" status="draft" quotaUsed={0} quotaMax={50} />
      )
      const badge = screen.getByTestId('status-badge')
      expect(badge.className).toContain('bg-gray-400')
      expect(badge).toHaveTextContent('draft')
    })

    it('active status uses emerald background', () => {
      render(
        <CampaignCard name="Active" niche="dentist" status="active" quotaUsed={10} quotaMax={50} />
      )
      const badge = screen.getByTestId('status-badge')
      expect(badge.className).toContain('bg-emerald-500')
      expect(badge.className).toContain('text-white')
    })

    it('paused status uses yellow background', () => {
      render(
        <CampaignCard name="Paused" niche="dentist" status="paused" quotaUsed={5} quotaMax={50} />
      )
      const badge = screen.getByTestId('status-badge')
      expect(badge.className).toContain('bg-yellow-500')
    })

    it('completed status uses blue background', () => {
      render(
        <CampaignCard name="Done" niche="dentist" status="completed" quotaUsed={50} quotaMax={50} />
      )
      const badge = screen.getByTestId('status-badge')
      expect(badge.className).toContain('bg-blue-500')
    })

    it('archived status uses red background', () => {
      render(
        <CampaignCard name="Old" niche="dentist" status="archived" quotaUsed={50} quotaMax={50} />
      )
      const badge = screen.getByTestId('status-badge')
      expect(badge.className).toContain('bg-red-400')
    })
  })

  describe('Quota progress bar', () => {
    it('renders with correct width percentage', () => {
      render(
        <CampaignCard name="Test" niche="dentist" status="active" quotaUsed={25} quotaMax={100} />
      )

      const fill = screen.getByTestId('quota-fill')
      expect(fill).toHaveStyle({ width: '25%' })
    })

    it('shows 0% when no calls made', () => {
      render(
        <CampaignCard name="New" niche="dentist" status="draft" quotaUsed={0} quotaMax={50} />
      )

      const fill = screen.getByTestId('quota-fill')
      expect(fill).toHaveStyle({ width: '0%' })
    })

    it('caps at 100% when over quota', () => {
      render(
        <CampaignCard name="Over" niche="dentist" status="active" quotaUsed={75} quotaMax={50} />
      )

      const fill = screen.getByTestId('quota-fill')
      expect(fill).toHaveStyle({ width: '100%' })
    })

    it('shows quota fraction text', () => {
      render(
        <CampaignCard name="Test" niche="dentist" status="active" quotaUsed={30} quotaMax={50} />
      )

      expect(screen.getByText('30/50')).toBeInTheDocument()
    })

    it('progress bar has correct height and rounding', () => {
      render(
        <CampaignCard name="Test" niche="dentist" status="active" quotaUsed={10} quotaMax={50} />
      )

      const fill = screen.getByTestId('quota-fill')
      expect(fill.className).toContain('h-full')
      expect(fill.className).toContain('rounded-full')
    })
  })

  describe('New campaign form validation', () => {
    it('shows error when name is empty on submit', () => {
      const onSubmit = jest.fn()
      render(<NewCampaignForm onSubmit={onSubmit} />)

      fireEvent.click(screen.getByTestId('submit-btn'))

      expect(screen.getByTestId('error-name')).toHaveTextContent('Campaign name is required')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows error when niche is empty on submit', () => {
      const onSubmit = jest.fn()
      render(<NewCampaignForm onSubmit={onSubmit} />)

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'My Campaign' } })
      fireEvent.click(screen.getByTestId('submit-btn'))

      expect(screen.getByTestId('error-niche')).toHaveTextContent('Niche is required')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows both errors when both fields are empty', () => {
      const onSubmit = jest.fn()
      render(<NewCampaignForm onSubmit={onSubmit} />)

      fireEvent.click(screen.getByTestId('submit-btn'))

      expect(screen.getByTestId('error-name')).toBeInTheDocument()
      expect(screen.getByTestId('error-niche')).toBeInTheDocument()
    })

    it('submits successfully when both fields are filled', () => {
      const onSubmit = jest.fn()
      render(<NewCampaignForm onSubmit={onSubmit} />)

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: 'Dentist Q2' } })
      fireEvent.change(screen.getByTestId('input-niche'), { target: { value: 'dentist' } })
      fireEvent.click(screen.getByTestId('submit-btn'))

      expect(onSubmit).toHaveBeenCalledWith({ name: 'Dentist Q2', niche: 'dentist' })
      expect(screen.queryByTestId('error-name')).not.toBeInTheDocument()
      expect(screen.queryByTestId('error-niche')).not.toBeInTheDocument()
    })

    it('trims whitespace from field values on submit', () => {
      const onSubmit = jest.fn()
      render(<NewCampaignForm onSubmit={onSubmit} />)

      fireEvent.change(screen.getByTestId('input-name'), { target: { value: '  Spaced Name  ' } })
      fireEvent.change(screen.getByTestId('input-niche'), { target: { value: '  hvac  ' } })
      fireEvent.click(screen.getByTestId('submit-btn'))

      expect(onSubmit).toHaveBeenCalledWith({ name: 'Spaced Name', niche: 'hvac' })
    })

    it('submit button has minimum touch target height', () => {
      render(<NewCampaignForm onSubmit={jest.fn()} />)

      const btn = screen.getByTestId('submit-btn')
      expect(btn.className).toContain('min-h-[44px]')
    })
  })
})
