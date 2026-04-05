/**
 * Vapi Session Builder — injects business context into assistantOverrides
 */
import { supabaseAdmin } from '@/lib/supabase'
import { compressToBrief, type BusinessProfile } from '@/lib/business-context'

export interface AssistantOverrides {
  variableValues: {
    company_name: string
    business_brief: string
    services: string
    tone: string
    ideal_customers: string
    booking_link: string
  }
  model?: {
    tools?: Array<{
      type: string
      function?: {
        name: string
        description: string
        parameters: Record<string, unknown>
      }
      server?: {
        url: string
      }
      async?: boolean
    }>
  }
}

/**
 * Build Vapi assistantOverrides with business context injected as variableValues.
 * Returns null if the domain is not ready — caller should fall back to default config.
 */
export async function buildAssistantOverrides(
  domain: string
): Promise<AssistantOverrides | null> {
  const { data, error } = await supabaseAdmin
    .from('business_profiles')
    .select('profile, status')
    .eq('domain', domain)
    .single()

  if (error || !data || data.status !== 'ready') {
    return null
  }

  const profile = data.profile as BusinessProfile
  const context = compressToBrief(profile)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    variableValues: {
      company_name: context.company_name,
      business_brief: context.brief,
      services: context.services_summary,
      tone: context.brand_tone,
      ideal_customers: context.ideal_customers,
      booking_link: context.booking_link || '',
    },
    model: {
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_business_context',
            description:
              'Retrieve detailed business context for the company. Use this when you need more specific information about the business services, differentiators, or pricing.',
            parameters: {
              type: 'object',
              properties: {
                domain: {
                  type: 'string',
                  description: 'The business domain to look up',
                },
              },
              required: ['domain'],
            },
          },
          server: {
            url: `${appUrl}/api/business-context`,
          },
          async: false,
        },
      ],
    },
  }
}
