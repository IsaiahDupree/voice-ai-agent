/**
 * Feature 140: Tenant Onboarding Wizard
 * Guided setup for new tenants
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'

interface WizardStep {
  id: string
  title: string
  description: string
}

const steps: WizardStep[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Set up your tenant name and identifier',
  },
  {
    id: 'config',
    title: 'Configuration',
    description: 'Configure voice and assistant settings',
  },
  {
    id: 'phone',
    title: 'Phone Numbers',
    description: 'Assign phone numbers to this tenant',
  },
  {
    id: 'review',
    title: 'Review & Launch',
    description: 'Review your settings and complete setup',
  },
]

interface OnboardingData {
  name: string
  slug: string
  plan: string
  phoneNumbers: string[]
  assistant_id: string
  persona_name: string
  voice_id: string
  system_prompt: string
  timezone: string
}

interface TenantOnboardingWizardProps {
  onComplete?: (data: OnboardingData) => void
  onCancel?: () => void
}

export default function TenantOnboardingWizard({
  onComplete,
  onCancel,
}: TenantOnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<OnboardingData>({
    name: '',
    slug: '',
    plan: 'starter',
    phoneNumbers: [''],
    assistant_id: '',
    persona_name: '',
    voice_id: '',
    system_prompt: '',
    timezone: 'America/New_York',
  })

  const isStepComplete = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Basic Info
        return formData.name.length > 0 && formData.slug.length > 0
      case 1: // Config
        return formData.timezone.length > 0
      case 2: // Phone Numbers
        return formData.phoneNumbers.some((p) => p.length > 0)
      case 3: // Review
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      // Step 1: Create tenant
      const createResponse = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          plan: formData.plan,
          phone_numbers: formData.phoneNumbers.filter((p) => p.length > 0),
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        throw new Error(errorData.error || 'Failed to create tenant')
      }

      const { tenant } = await createResponse.json()

      // Step 2: Run onboarding automation
      const onboardResponse = await fetch(`/api/tenants/${tenant.id}/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assistant_id: formData.assistant_id || undefined,
          persona_name: formData.persona_name || undefined,
          voice_id: formData.voice_id || undefined,
          system_prompt: formData.system_prompt || undefined,
          timezone: formData.timezone,
          create_sample_data: true,
        }),
      })

      if (!onboardResponse.ok) {
        throw new Error('Onboarding automation failed')
      }

      // Success!
      if (onComplete) {
        onComplete(formData)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: keyof OnboardingData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Tenant Name *</Label>
              <Input
                id="name"
                placeholder="Acme Corporation"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug (URL-friendly identifier) *</Label>
              <Input
                id="slug"
                placeholder="acme-corp"
                value={formData.slug}
                onChange={(e) =>
                  updateFormData('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            <div>
              <Label htmlFor="plan">Plan</Label>
              <Select value={formData.plan} onValueChange={(val) => updateFormData('plan', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 1: // Config
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="persona_name">Persona Name</Label>
              <Input
                id="persona_name"
                placeholder="Professional Assistant"
                value={formData.persona_name}
                onChange={(e) => updateFormData('persona_name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="assistant_id">Vapi Assistant ID (optional)</Label>
              <Input
                id="assistant_id"
                placeholder="asst_xxxxx"
                value={formData.assistant_id}
                onChange={(e) => updateFormData('assistant_id', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="voice_id">ElevenLabs Voice ID (optional)</Label>
              <Input
                id="voice_id"
                placeholder="21m00Tcm4TlvDq8ikWAM"
                value={formData.voice_id}
                onChange={(e) => updateFormData('voice_id', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone}
                onValueChange={(val) => updateFormData('timezone', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="system_prompt">System Prompt (optional)</Label>
              <Textarea
                id="system_prompt"
                placeholder="You are a helpful assistant..."
                rows={4}
                value={formData.system_prompt}
                onChange={(e) => updateFormData('system_prompt', e.target.value)}
              />
            </div>
          </div>
        )

      case 2: // Phone Numbers
        return (
          <div className="space-y-4">
            <div>
              <Label>Phone Numbers</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Add phone numbers that will route to this tenant
              </p>
              {formData.phoneNumbers.map((phone, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    placeholder="+1 555 123 4567"
                    value={phone}
                    onChange={(e) => {
                      const updated = [...formData.phoneNumbers]
                      updated[index] = e.target.value
                      updateFormData('phoneNumbers', updated)
                    }}
                  />
                  {index === formData.phoneNumbers.length - 1 && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateFormData('phoneNumbers', [...formData.phoneNumbers, ''])
                      }
                    >
                      +
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case 3: // Review
        return (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Tenant Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Name:</div>
                <div>{formData.name}</div>
                <div className="text-muted-foreground">Slug:</div>
                <div className="font-mono">{formData.slug}</div>
                <div className="text-muted-foreground">Plan:</div>
                <div>{formData.plan}</div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Configuration</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Timezone:</div>
                <div>{formData.timezone}</div>
                {formData.persona_name && (
                  <>
                    <div className="text-muted-foreground">Persona:</div>
                    <div>{formData.persona_name}</div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Phone Numbers</h3>
              <div className="space-y-1 text-sm">
                {formData.phoneNumbers.filter((p) => p.length > 0).map((phone, i) => (
                  <div key={i} className="font-mono">
                    {phone}
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>New Tenant Setup</CardTitle>
        <CardDescription>
          Complete the steps below to set up a new tenant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  index === currentStep
                    ? 'border-primary bg-primary text-primary-foreground'
                    : index < currentStep
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted'
                }`}
              >
                {index < currentStep ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Title */}
        <div>
          <h3 className="text-lg font-semibold">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">
            {steps[currentStep].description}
          </p>
        </div>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? onCancel : handleBack}
            disabled={loading}
          >
            {currentStep === 0 ? 'Cancel' : (
              <>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!isStepComplete(currentStep) || loading}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading || !isStepComplete(currentStep)}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
