// F1359: Feature flags

import { NextRequest, NextResponse } from 'next/server'

interface FeatureFlag {
  name: string
  enabled: boolean
  rollout_percentage?: number
  description?: string
}

const FLAGS: Record<string, FeatureFlag> = {
  'advanced-analytics': { name: 'advanced-analytics', enabled: true, description: 'Advanced analytics dashboard' },
  'a-b-testing': { name: 'a-b-testing', enabled: true, description: 'Campaign A/B testing' },
  'custom-integrations': { name: 'custom-integrations', enabled: false, rollout_percentage: 50 },
  'voice-cloning': { name: 'voice-cloning', enabled: true, description: 'Custom voice cloning' },
  'team-collaboration': { name: 'team-collaboration', enabled: true, description: 'Team features' },
}

export async function GET() {
  try {
    return NextResponse.json({ flags: Object.values(FLAGS) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, enabled, rollout_percentage } = await request.json()

    FLAGS[name] = { name, enabled, rollout_percentage }

    return NextResponse.json({
      message: 'Feature flag updated',
      flag: FLAGS[name],
    }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
