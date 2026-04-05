'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Offer {
  id: string
  name: string
  niche: string
}

interface FormData {
  name: string
  niche: string
  offer_id: string
  center_lat: string
  center_lng: string
  radius_miles: string
  daily_call_quota: string
  calling_hours_start: string
  calling_hours_end: string
}

interface FormErrors {
  [key: string]: string
}

const NICHE_OPTIONS = [
  'HVAC',
  'Plumbing',
  'Roofing',
  'Pest Control',
  'Landscaping',
  'Electrical',
  'Auto Repair',
  'Dental',
  'Chiropractic',
  'Real Estate',
  'Insurance',
  'Legal',
]

const INITIAL_FORM: FormData = {
  name: '',
  niche: '',
  offer_id: '',
  center_lat: '',
  center_lng: '',
  radius_miles: '25',
  daily_call_quota: '50',
  calling_hours_start: '09:00',
  calling_hours_end: '17:00',
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const [offers, setOffers] = useState<Offer[]>([])
  const [offersLoading, setOffersLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOffers() {
      try {
        const res = await fetch('/api/localreach/offers')
        if (res.ok) {
          const data = await res.json()
          setOffers(Array.isArray(data) ? data : data.offers ?? [])
        }
      } catch {
        // Non-critical — user can still type offer_id
      } finally {
        setOffersLoading(false)
      }
    }
    loadOffers()
  }, [])

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear field error on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!form.name.trim()) errs.name = 'Campaign name is required'
    if (!form.niche) errs.niche = 'Select a niche'
    if (!form.offer_id) errs.offer_id = 'Select an offer'

    const lat = parseFloat(form.center_lat)
    if (!form.center_lat || isNaN(lat) || lat < -90 || lat > 90) {
      errs.center_lat = 'Enter a valid latitude (-90 to 90)'
    }

    const lng = parseFloat(form.center_lng)
    if (!form.center_lng || isNaN(lng) || lng < -180 || lng > 180) {
      errs.center_lng = 'Enter a valid longitude (-180 to 180)'
    }

    const radius = parseFloat(form.radius_miles)
    if (!form.radius_miles || isNaN(radius) || radius <= 0 || radius > 500) {
      errs.radius_miles = 'Enter a radius between 1 and 500 miles'
    }

    const quota = parseInt(form.daily_call_quota, 10)
    if (!form.daily_call_quota || isNaN(quota) || quota < 1 || quota > 1000) {
      errs.daily_call_quota = 'Enter a quota between 1 and 1000'
    }

    if (!form.calling_hours_start) errs.calling_hours_start = 'Start time is required'
    if (!form.calling_hours_end) errs.calling_hours_end = 'End time is required'
    if (form.calling_hours_start && form.calling_hours_end && form.calling_hours_start >= form.calling_hours_end) {
      errs.calling_hours_end = 'End time must be after start time'
    }

    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: form.name.trim(),
        niche: form.niche,
        offer_id: form.offer_id,
        center_lat: parseFloat(form.center_lat),
        center_lng: parseFloat(form.center_lng),
        radius_miles: parseFloat(form.radius_miles),
        daily_call_quota: parseInt(form.daily_call_quota, 10),
        calling_hours_start: form.calling_hours_start,
        calling_hours_end: form.calling_hours_end,
      }

      const res = await fetch('/api/campaigns/localreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to create campaign: ${res.statusText}`)
      }

      router.push('/localreach/campaigns')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredOffers = form.niche
    ? offers.filter((o) => o.niche.toLowerCase() === form.niche.toLowerCase() || !o.niche)
    : offers

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/localreach/campaigns"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold">New Campaign</h1>
      </div>

      {submitError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
          <p className="text-sm text-red-700 dark:text-red-400">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Campaign Name */}
        <FieldWrapper label="Campaign Name" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Denver HVAC Spring 2026"
            className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.name ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
            }`}
          />
        </FieldWrapper>

        {/* Niche */}
        <FieldWrapper label="Niche" error={errors.niche}>
          <select
            value={form.niche}
            onChange={(e) => handleChange('niche', e.target.value)}
            className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.niche ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <option value="">Select niche...</option>
            {NICHE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </FieldWrapper>

        {/* Offer */}
        <FieldWrapper label="Offer" error={errors.offer_id}>
          {offersLoading ? (
            <div className="h-[44px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <select
              value={form.offer_id}
              onChange={(e) => handleChange('offer_id', e.target.value)}
              className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.offer_id ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <option value="">Select offer...</option>
              {filteredOffers.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
        </FieldWrapper>

        {/* Location */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Campaign Center</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Latitude" error={errors.center_lat} compact>
              <input
                type="number"
                step="any"
                value={form.center_lat}
                onChange={(e) => handleChange('center_lat', e.target.value)}
                placeholder="39.7392"
                className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.center_lat ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                }`}
              />
            </FieldWrapper>
            <FieldWrapper label="Longitude" error={errors.center_lng} compact>
              <input
                type="number"
                step="any"
                value={form.center_lng}
                onChange={(e) => handleChange('center_lng', e.target.value)}
                placeholder="-104.9903"
                className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.center_lng ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                }`}
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Radius */}
        <FieldWrapper label="Radius (miles)" error={errors.radius_miles}>
          <input
            type="number"
            min={1}
            max={500}
            value={form.radius_miles}
            onChange={(e) => handleChange('radius_miles', e.target.value)}
            className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.radius_miles ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
            }`}
          />
        </FieldWrapper>

        {/* Daily Quota */}
        <FieldWrapper label="Daily Call Quota" error={errors.daily_call_quota}>
          <input
            type="number"
            min={1}
            max={1000}
            value={form.daily_call_quota}
            onChange={(e) => handleChange('daily_call_quota', e.target.value)}
            className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.daily_call_quota ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
            }`}
          />
        </FieldWrapper>

        {/* Calling Hours */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Calling Hours</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrapper label="Start" error={errors.calling_hours_start} compact>
              <input
                type="time"
                value={form.calling_hours_start}
                onChange={(e) => handleChange('calling_hours_start', e.target.value)}
                className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.calling_hours_start ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                }`}
              />
            </FieldWrapper>
            <FieldWrapper label="End" error={errors.calling_hours_end} compact>
              <input
                type="time"
                value={form.calling_hours_end}
                onChange={(e) => handleChange('calling_hours_end', e.target.value)}
                className={`w-full min-h-[44px] px-4 py-3 rounded-xl border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.calling_hours_end ? 'border-red-400 dark:border-red-600' : 'border-gray-200 dark:border-gray-800'
                }`}
              />
            </FieldWrapper>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] px-4 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </span>
          ) : (
            'Create Campaign'
          )}
        </button>
      </form>
    </div>
  )
}

function FieldWrapper({
  label,
  error,
  compact,
  children,
}: {
  label: string
  error?: string
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${compact ? 'mb-1' : 'mb-2'}`}>
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
