// F1270: SMS failure alert - Alert admin on persistent SMS failure
// F1309: Error monitoring integration - Errors sent to monitoring service (e.g. Sentry)
// F1317: Error dashboard - Admin view of recent errors with frequency
// F1488: Error silencing - Silence known non-critical errors in alerting

import { supabaseAdmin } from './supabase'

export interface ErrorLog {
  id?: string
  error_type: string
  error_message: string
  stack_trace?: string
  service: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: any
  user_id?: string
  silenced?: boolean
  occurred_at: string
}

const silencedErrors = new Set<string>()

// F1488: Load silenced errors from config
export function loadSilencedErrors() {
  const silencedList = process.env.SILENCED_ERRORS?.split(',') || []
  silencedList.forEach((errorType) => silencedErrors.add(errorType.trim()))
  console.log(`Loaded ${silencedErrors.size} silenced error types`)
}

// Initialize on module load
loadSilencedErrors()

export async function logError(error: Omit<ErrorLog, 'occurred_at'>) {
  try {
    const errorLog: ErrorLog = {
      ...error,
      occurred_at: new Date().toISOString(),
      silenced: silencedErrors.has(error.error_type),
    }

    // Log to database
    const { error: dbError } = await supabaseAdmin.from('voice_agent_error_logs').insert(errorLog)

    if (dbError) {
      console.error('Failed to log error to database:', dbError)
    }

    // F1309: Send to external monitoring service (Sentry, etc.)
    if (process.env.SENTRY_DSN) {
      await sendToSentry(errorLog)
    }

    // Send alert if not silenced and severity is high/critical
    if (!errorLog.silenced && (error.severity === 'high' || error.severity === 'critical')) {
      await sendErrorAlert(errorLog)
    }

    return errorLog
  } catch (err) {
    console.error('Error in logError:', err)
  }
}

async function sendToSentry(errorLog: ErrorLog) {
  try {
    // This would integrate with actual Sentry SDK
    // For now, just log that we would send it
    console.log('Would send to Sentry:', errorLog.error_type)

    // Example Sentry integration:
    // Sentry.captureException(new Error(errorLog.error_message), {
    //   level: errorLog.severity,
    //   tags: { service: errorLog.service },
    //   extra: errorLog.context,
    // })
  } catch (error) {
    console.error('Failed to send to Sentry:', error)
  }
}

async function sendErrorAlert(errorLog: ErrorLog) {
  try {
    const webhookUrl = process.env.ERROR_ALERT_WEBHOOK
    if (!webhookUrl) return

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'error_alert',
        error: errorLog,
        timestamp: errorLog.occurred_at,
      }),
    })

    console.log(`Error alert sent for ${errorLog.error_type}`)
  } catch (error) {
    console.error('Failed to send error alert:', error)
  }
}

// F1270: SMS failure alert - Track and alert on persistent failures
export async function trackSMSFailure(phoneNumber: string, error: string) {
  try {
    // Check recent SMS failures for this number
    const { data: recentFailures } = await supabaseAdmin
      .from('voice_agent_sms_logs')
      .select('message_sid')
      .eq('to_number', phoneNumber)
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
      .limit(5)

    const failureCount = recentFailures?.length || 0

    if (failureCount >= 3) {
      // Persistent failures detected
      await logError({
        error_type: 'persistent_sms_failure',
        error_message: `${failureCount} SMS failures to ${phoneNumber} in the last hour`,
        service: 'twilio',
        severity: 'high',
        context: {
          phone_number: phoneNumber,
          failure_count: failureCount,
          last_error: error,
        },
      })
    }
  } catch (err) {
    console.error('Error tracking SMS failure:', err)
  }
}

// F1317: Get error dashboard data
export async function getErrorDashboardData(hours: number = 24) {
  try {
    const since = new Date(Date.now() - hours * 3600000).toISOString()

    const { data: errors, error } = await supabaseAdmin
      .from('voice_agent_error_logs')
      .select('*')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })

    if (error) throw error

    // Group by error_type and count
    const errorFrequency: Record<string, { count: number; lastOccurred: string; severity: string }> = {}

    errors.forEach((err) => {
      if (!errorFrequency[err.error_type]) {
        errorFrequency[err.error_type] = {
          count: 0,
          lastOccurred: err.occurred_at,
          severity: err.severity,
        }
      }
      errorFrequency[err.error_type].count++
    })

    // Sort by frequency
    const topErrors = Object.entries(errorFrequency)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20)
      .map(([errorType, data]) => ({
        error_type: errorType,
        ...data,
      }))

    return {
      total_errors: errors.length,
      unique_error_types: Object.keys(errorFrequency).length,
      top_errors: topErrors,
      recent_errors: errors.slice(0, 50),
    }
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error)
    throw error
  }
}

// F1488: Add/remove silenced errors
export function silenceError(errorType: string) {
  silencedErrors.add(errorType)
  console.log(`Error type silenced: ${errorType}`)
}

export function unsilenceError(errorType: string) {
  silencedErrors.delete(errorType)
  console.log(`Error type unsilenced: ${errorType}`)
}

export function getSilencedErrors() {
  return Array.from(silencedErrors)
}
