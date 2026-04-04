// F0651, F0652: Escalation levels and SLA management for human handoff

export type EscalationLevel = 'low' | 'medium' | 'high' | 'critical'

export interface EscalationRule {
  level: EscalationLevel
  triggers: {
    sentiment?: 'negative'
    keywords?: string[]
    callDuration?: { operator: 'gt' | 'lt'; value: number } // seconds
    transferAttempts?: { operator: 'gte'; value: number }
    highValue?: boolean // Based on contact metadata
  }
  sla: {
    responseTimeMinutes: number // Max time to respond
    escalateAfterMinutes: number // Auto-escalate if not handled
  }
  routing: {
    skillRequired?: string
    priority: number // 1-10, higher = more urgent
    notifyReps: string[] // Rep IDs or "all"
  }
}

/**
 * F0651: Default escalation levels with SLA
 */
export const defaultEscalationLevels: Record<EscalationLevel, EscalationRule> = {
  low: {
    level: 'low',
    triggers: {},
    sla: {
      responseTimeMinutes: 30,
      escalateAfterMinutes: 60,
    },
    routing: {
      priority: 2,
      notifyReps: [],
    },
  },
  medium: {
    level: 'medium',
    triggers: {
      callDuration: { operator: 'gt', value: 300 }, // > 5 min
    },
    sla: {
      responseTimeMinutes: 15,
      escalateAfterMinutes: 30,
    },
    routing: {
      priority: 5,
      notifyReps: [],
    },
  },
  high: {
    level: 'high',
    triggers: {
      sentiment: 'negative',
      transferAttempts: { operator: 'gte', value: 2 },
    },
    sla: {
      responseTimeMinutes: 5,
      escalateAfterMinutes: 15,
    },
    routing: {
      priority: 8,
      notifyReps: ['all'],
    },
  },
  critical: {
    level: 'critical',
    triggers: {
      keywords: ['urgent', 'emergency', 'lawyer', 'sue', 'cancel account'],
      highValue: true,
    },
    sla: {
      responseTimeMinutes: 2,
      escalateAfterMinutes: 5,
    },
    routing: {
      skillRequired: 'senior',
      priority: 10,
      notifyReps: ['all'],
    },
  },
}

/**
 * F0651: Determine escalation level based on call data
 */
export function determineEscalationLevel(call: {
  sentiment?: string
  duration_seconds?: number
  transfer_attempts?: number
  transcript_text?: string
  contact_metadata?: Record<string, any>
}): EscalationLevel {
  const levels: EscalationLevel[] = ['low', 'medium', 'high', 'critical']

  for (let i = levels.length - 1; i >= 0; i--) {
    const level = levels[i]
    const rule = defaultEscalationLevels[level]

    // Check triggers
    if (rule.triggers.sentiment && call.sentiment === rule.triggers.sentiment) {
      return level
    }

    if (rule.triggers.keywords && call.transcript_text) {
      const hasKeyword = rule.triggers.keywords.some((kw) =>
        call.transcript_text!.toLowerCase().includes(kw.toLowerCase())
      )
      if (hasKeyword) return level
    }

    if (rule.triggers.callDuration && call.duration_seconds) {
      const { operator, value } = rule.triggers.callDuration
      if (operator === 'gt' && call.duration_seconds > value) return level
      if (operator === 'lt' && call.duration_seconds < value) return level
    }

    if (rule.triggers.transferAttempts && call.transfer_attempts) {
      const { operator, value } = rule.triggers.transferAttempts
      if (operator === 'gte' && call.transfer_attempts >= value) return level
    }

    if (rule.triggers.highValue && call.contact_metadata?.high_value === true) {
      return level
    }
  }

  return 'low'
}

/**
 * F0652: Check if escalation SLA is breached
 */
export function checkSLABreach(
  escalationLevel: EscalationLevel,
  createdAt: Date,
  respondedAt?: Date
): {
  breached: boolean
  elapsedMinutes: number
  slaMinutes: number
  shouldEscalate: boolean
} {
  const rule = defaultEscalationLevels[escalationLevel]
  const now = respondedAt || new Date()
  const elapsedMs = now.getTime() - createdAt.getTime()
  const elapsedMinutes = Math.floor(elapsedMs / 60000)

  const breached = elapsedMinutes > rule.sla.responseTimeMinutes
  const shouldEscalate = elapsedMinutes > rule.sla.escalateAfterMinutes

  return {
    breached,
    elapsedMinutes,
    slaMinutes: rule.sla.responseTimeMinutes,
    shouldEscalate,
  }
}

/**
 * F0651, F0652: Create escalation record in database
 */
export async function createEscalation(data: {
  call_id: string
  level: EscalationLevel
  reason: string
  assigned_to?: string
}): Promise<any> {
  const { supabaseAdmin } = await import('@/lib/supabase')
  const supabase = supabaseAdmin

  const rule = defaultEscalationLevels[data.level]

  const { data: escalation, error } = await supabase
    .from('escalations')
    .insert({
      call_id: data.call_id,
      level: data.level,
      priority: rule.routing.priority,
      reason: data.reason,
      assigned_to: data.assigned_to,
      sla_response_minutes: rule.sla.responseTimeMinutes,
      sla_escalate_minutes: rule.sla.escalateAfterMinutes,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create escalation: ${error.message}`)
  }

  return escalation
}
