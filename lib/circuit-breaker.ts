// F1293: Circuit breaker: Cal.com - Circuit breaker opens after 5 Cal.com failures
// F1294: Circuit breaker: Twilio - Circuit breaker opens after 5 Twilio failures
// F1295: Circuit breaker: Vapi - Circuit breaker opens after 5 Vapi failures

type ServiceName = 'calcom' | 'twilio' | 'vapi'

interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
  lastTransitionTime: number
}

class CircuitBreaker {
  private states: Map<ServiceName, CircuitBreakerState> = new Map()
  private readonly FAILURE_THRESHOLD = 5
  private readonly TIMEOUT = 60000 // 60 seconds
  private readonly HALF_OPEN_MAX_CALLS = 3

  private getState(service: ServiceName): CircuitBreakerState {
    if (!this.states.has(service)) {
      this.states.set(service, {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed',
        lastTransitionTime: Date.now(),
      })
    }
    return this.states.get(service)!
  }

  public async execute<T>(
    service: ServiceName,
    operation: () => Promise<T>
  ): Promise<{ success: boolean; data?: T; error?: string; circuitOpen?: boolean }> {
    const state = this.getState(service)

    // Check if circuit is open
    if (state.state === 'open') {
      const timeSinceOpen = Date.now() - state.lastTransitionTime

      // Try transitioning to half-open after timeout
      if (timeSinceOpen >= this.TIMEOUT) {
        state.state = 'half-open'
        state.lastTransitionTime = Date.now()
        console.log(`Circuit breaker for ${service} transitioning to half-open`)
      } else {
        // Circuit is still open, reject immediately
        console.warn(`Circuit breaker for ${service} is OPEN, request rejected`)
        return {
          success: false,
          error: `${service} service is currently unavailable (circuit breaker open)`,
          circuitOpen: true,
        }
      }
    }

    // Execute the operation
    try {
      const result = await operation()

      // Success - reset failure count
      if (state.state === 'half-open') {
        // If in half-open and successful, close the circuit
        state.state = 'closed'
        state.failures = 0
        state.lastTransitionTime = Date.now()
        console.log(`Circuit breaker for ${service} closed after successful call`)
      } else {
        state.failures = 0
      }

      return { success: true, data: result }
    } catch (error: any) {
      // Failure - increment counter
      state.failures++
      state.lastFailureTime = Date.now()

      console.error(`${service} operation failed (${state.failures}/${this.FAILURE_THRESHOLD}):`, error.message)

      // Check if we should open the circuit
      if (state.failures >= this.FAILURE_THRESHOLD) {
        state.state = 'open'
        state.lastTransitionTime = Date.now()
        console.error(`Circuit breaker for ${service} is now OPEN after ${state.failures} failures`)

        // Send alert
        await this.sendAlert(service, state.failures)
      }

      return {
        success: false,
        error: error.message || 'Operation failed',
        circuitOpen: state.state === 'open',
      }
    }
  }

  private async sendAlert(service: ServiceName, failures: number) {
    try {
      const webhookUrl = process.env.ERROR_ALERT_WEBHOOK
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'circuit_breaker_open',
            service,
            failures,
            timestamp: new Date().toISOString(),
          }),
        })
      }
    } catch (error) {
      console.error('Failed to send circuit breaker alert:', error)
    }
  }

  public getStatus(service: ServiceName) {
    return this.getState(service)
  }

  public reset(service: ServiceName) {
    this.states.set(service, {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed',
      lastTransitionTime: Date.now(),
    })
    console.log(`Circuit breaker for ${service} manually reset`)
  }
}

export const circuitBreaker = new CircuitBreaker()

// Helper functions for each service
export async function executeCalComOperation<T>(operation: () => Promise<T>) {
  return circuitBreaker.execute('calcom', operation)
}

export async function executeTwilioOperation<T>(operation: () => Promise<T>) {
  return circuitBreaker.execute('twilio', operation)
}

export async function executeVapiOperation<T>(operation: () => Promise<T>) {
  return circuitBreaker.execute('vapi', operation)
}
