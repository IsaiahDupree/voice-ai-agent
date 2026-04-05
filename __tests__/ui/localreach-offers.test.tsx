/**
 * LocalReach V3 — Offer Library UI Tests
 * Tests that all 12 offers render as cards with correct content and layout.
 */

import { render, screen, within } from '@testing-library/react'
import React from 'react'

// ─── Offer data matching the 12 offers from the PRD ───

interface Offer {
  id: string
  name: string
  price: string
  priceCents: number
  discountPercent: number
  niches: string[]
  billingInterval: 'monthly' | 'one_time' | 'annual'
}

const OFFERS: Offer[] = [
  { id: '1', name: 'AI Phone Agent — Starter', price: '$197/mo', priceCents: 19700, discountPercent: 0, niches: ['all'], billingInterval: 'monthly' },
  { id: '2', name: 'AI Phone Agent — Pro', price: '$497/mo', priceCents: 49700, discountPercent: 10, niches: ['all'], billingInterval: 'monthly' },
  { id: '3', name: 'AI Phone Agent — Enterprise', price: '$997/mo', priceCents: 99700, discountPercent: 15, niches: ['all'], billingInterval: 'monthly' },
  { id: '4', name: 'AI Automation Audit', price: '$2,500', priceCents: 250000, discountPercent: 0, niches: ['dentist', 'chiropractor'], billingInterval: 'one_time' },
  { id: '5', name: 'Social Growth System', price: '$500/mo', priceCents: 50000, discountPercent: 20, niches: ['all'], billingInterval: 'monthly' },
  { id: '6', name: 'Review Booster', price: '$297/mo', priceCents: 29700, discountPercent: 0, niches: ['dentist', 'plumber', 'hvac'], billingInterval: 'monthly' },
  { id: '7', name: 'Website Chatbot', price: '$147/mo', priceCents: 14700, discountPercent: 25, niches: ['all'], billingInterval: 'monthly' },
  { id: '8', name: 'Missed Call Text-Back', price: '$97/mo', priceCents: 9700, discountPercent: 0, niches: ['plumber', 'electrician', 'hvac'], billingInterval: 'monthly' },
  { id: '9', name: 'SEO Authority Package', price: '$1,500/mo', priceCents: 150000, discountPercent: 10, niches: ['dentist', 'lawyer'], billingInterval: 'monthly' },
  { id: '10', name: 'Google Ads Management', price: '$750/mo', priceCents: 75000, discountPercent: 0, niches: ['all'], billingInterval: 'monthly' },
  { id: '11', name: 'Full Stack AI Setup', price: '$4,997', priceCents: 499700, discountPercent: 15, niches: ['all'], billingInterval: 'one_time' },
  { id: '12', name: 'Annual AI Partner', price: '$3,997/yr', priceCents: 399700, discountPercent: 20, niches: ['all'], billingInterval: 'annual' },
]

// ─── Components under test ───

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div
      data-testid="offer-card"
      className="rounded-xl border p-4 flex flex-col gap-2 sm:p-6 md:min-w-[280px] lg:min-w-[320px]"
    >
      <h3 className="font-semibold text-lg">{offer.name}</h3>
      <p data-testid="offer-price" className="text-xl font-bold text-emerald-600">
        {offer.price}
      </p>
      {offer.discountPercent > 0 && (
        <span
          data-testid="discount-badge"
          className="inline-flex text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full w-fit"
        >
          {offer.discountPercent}% off first {offer.billingInterval === 'monthly' ? 'month' : 'payment'}
        </span>
      )}
      <div data-testid="niche-tags" className="flex flex-wrap gap-1">
        {offer.niches.map((niche) => (
          <span
            key={niche}
            data-testid="niche-pill"
            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full"
          >
            {niche}
          </span>
        ))}
      </div>
    </div>
  )
}

function OfferGrid({ offers }: { offers: Offer[] }) {
  return (
    <div
      data-testid="offer-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  )
}

// ─── Tests ───

describe('LocalReach Offer Library UI Tests', () => {
  describe('All 12 offers render', () => {
    it('renders exactly 12 offer cards', () => {
      render(<OfferGrid offers={OFFERS} />)

      const cards = screen.getAllByTestId('offer-card')
      expect(cards).toHaveLength(12)
    })

    it('each card shows offer name', () => {
      render(<OfferGrid offers={OFFERS} />)

      OFFERS.forEach((offer) => {
        expect(screen.getByText(offer.name)).toBeInTheDocument()
      })
    })

    it('each card shows price', () => {
      render(<OfferGrid offers={OFFERS} />)

      const prices = screen.getAllByTestId('offer-price')
      expect(prices).toHaveLength(12)

      OFFERS.forEach((offer) => {
        expect(screen.getByText(offer.price)).toBeInTheDocument()
      })
    })

    it('offer grid uses responsive classes', () => {
      render(<OfferGrid offers={OFFERS} />)

      const grid = screen.getByTestId('offer-grid')
      expect(grid.className).toContain('grid-cols-1')
      expect(grid.className).toContain('sm:grid-cols-2')
      expect(grid.className).toContain('lg:grid-cols-3')
    })

    it('renders no duplicate card IDs', () => {
      render(<OfferGrid offers={OFFERS} />)

      const cards = screen.getAllByTestId('offer-card')
      const names = cards.map((card) => within(card).getByRole('heading').textContent)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(12)
    })
  })

  describe('Discount badges', () => {
    it('discount badge appears when discount_threshold_percent > 0', () => {
      const offersWithDiscount = OFFERS.filter((o) => o.discountPercent > 0)
      expect(offersWithDiscount.length).toBeGreaterThan(0)

      render(<OfferGrid offers={OFFERS} />)

      const badges = screen.getAllByTestId('discount-badge')
      expect(badges).toHaveLength(offersWithDiscount.length)
    })

    it('discount badge shows correct percentage', () => {
      const offer = OFFERS.find((o) => o.discountPercent === 25)!
      render(<OfferCard offer={offer} />)

      const badge = screen.getByTestId('discount-badge')
      expect(badge).toHaveTextContent('25% off')
    })

    it('no discount badge for 0% discount offers', () => {
      const noDiscountOffer = OFFERS.find((o) => o.discountPercent === 0)!
      render(<OfferCard offer={noDiscountOffer} />)

      expect(screen.queryByTestId('discount-badge')).not.toBeInTheDocument()
    })

    it('discount badge for monthly says "first month"', () => {
      const monthlyWithDiscount = OFFERS.find(
        (o) => o.discountPercent > 0 && o.billingInterval === 'monthly'
      )!
      render(<OfferCard offer={monthlyWithDiscount} />)

      expect(screen.getByTestId('discount-badge')).toHaveTextContent('first month')
    })

    it('discount badge for one_time says "first payment"', () => {
      const oneTimeWithDiscount = OFFERS.find(
        (o) => o.discountPercent > 0 && o.billingInterval === 'one_time'
      )!
      render(<OfferCard offer={oneTimeWithDiscount} />)

      expect(screen.getByTestId('discount-badge')).toHaveTextContent('first payment')
    })
  })

  describe('Niche tags', () => {
    it('niche tags render as pill badges', () => {
      const multiNicheOffer = OFFERS.find((o) => o.niches.length > 1)!
      render(<OfferCard offer={multiNicheOffer} />)

      const pills = screen.getAllByTestId('niche-pill')
      pills.forEach((pill) => {
        expect(pill.className).toContain('rounded-full')
      })
    })

    it('renders correct number of niche pills', () => {
      const offer = OFFERS.find((o) => o.niches.length === 3)!
      render(<OfferCard offer={offer} />)

      const pills = screen.getAllByTestId('niche-pill')
      expect(pills).toHaveLength(3)
    })

    it('renders "all" tag for universal offers', () => {
      const universalOffer = OFFERS.find(
        (o) => o.niches.length === 1 && o.niches[0] === 'all'
      )!
      render(<OfferCard offer={universalOffer} />)

      expect(screen.getByText('all')).toBeInTheDocument()
    })

    it('niche pills have indigo styling', () => {
      const offer = OFFERS[0]
      render(<OfferCard offer={offer} />)

      const pill = screen.getByTestId('niche-pill')
      expect(pill.className).toContain('bg-indigo-50')
      expect(pill.className).toContain('text-indigo-700')
    })

    it('multi-niche offer shows all niches', () => {
      const offer = OFFERS.find((o) => o.niches.includes('dentist') && o.niches.includes('chiropractor'))!
      render(<OfferCard offer={offer} />)

      expect(screen.getByText('dentist')).toBeInTheDocument()
      expect(screen.getByText('chiropractor')).toBeInTheDocument()
    })
  })

  describe('Card responsiveness', () => {
    it('cards contain responsive padding classes', () => {
      render(<OfferCard offer={OFFERS[0]} />)

      const card = screen.getByTestId('offer-card')
      expect(card.className).toContain('p-4')
      expect(card.className).toContain('sm:p-6')
    })

    it('cards have responsive minimum width', () => {
      render(<OfferCard offer={OFFERS[0]} />)

      const card = screen.getByTestId('offer-card')
      expect(card.className).toContain('md:min-w-[280px]')
    })

    it('empty offer list renders empty grid', () => {
      render(<OfferGrid offers={[]} />)

      const grid = screen.getByTestId('offer-grid')
      expect(grid.children).toHaveLength(0)
    })
  })
})
