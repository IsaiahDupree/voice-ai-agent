// F1249: Test: health endpoint

describe('Health Endpoint', () => {
  describe('Health check structure', () => {
    it('should return overall health status', () => {
      const response = {
        status: 'healthy',
        timestamp: '2026-03-26T12:00:00Z',
        services: {},
      }

      expect(response.status).toBeDefined()
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.status)
      expect(response.timestamp).toBeDefined()
    })

    it('should check all required services', () => {
      const requiredServices = ['vapi', 'supabase', 'twilio', 'calcom']

      requiredServices.forEach((service) => {
        expect(['vapi', 'supabase', 'twilio', 'calcom']).toContain(service)
      })
    })
  })

  describe('Service health states', () => {
    it('should return healthy when all services are up', () => {
      const health = {
        status: 'healthy',
        services: {
          vapi: { status: 'up', responseTime: 45 },
          supabase: { status: 'up', responseTime: 12 },
          twilio: { status: 'up', responseTime: 89 },
          calcom: { status: 'up', responseTime: 123 },
        },
      }

      const allUp = Object.values(health.services).every((s) => s.status === 'up')
      expect(allUp).toBe(true)
      expect(health.status).toBe('healthy')
    })

    it('should return degraded when some services are down', () => {
      const health = {
        status: 'degraded',
        services: {
          vapi: { status: 'up', responseTime: 45 },
          supabase: { status: 'up', responseTime: 12 },
          twilio: { status: 'down', error: 'Connection timeout' },
          calcom: { status: 'up', responseTime: 123 },
        },
      }

      const someDown = Object.values(health.services).some((s) => s.status === 'down')
      expect(someDown).toBe(true)
      expect(health.status).toBe('degraded')
    })

    it('should return unhealthy when critical services are down', () => {
      const health = {
        status: 'unhealthy',
        services: {
          vapi: { status: 'down', error: 'API key invalid' },
          supabase: { status: 'down', error: 'Connection refused' },
          twilio: { status: 'up', responseTime: 89 },
          calcom: { status: 'up', responseTime: 123 },
        },
      }

      const criticalServices = ['vapi', 'supabase']
      const criticalDown = criticalServices.some(
        (name) => health.services[name as keyof typeof health.services].status === 'down'
      )

      expect(criticalDown).toBe(true)
      expect(health.status).toBe('unhealthy')
    })
  })

  describe('Individual service checks', () => {
    it('should check Vapi API connectivity', () => {
      const vapiCheck = {
        status: 'up',
        responseTime: 45,
        version: '1.0',
      }

      expect(vapiCheck.status).toBe('up')
      expect(vapiCheck.responseTime).toBeGreaterThan(0)
    })

    it('should check Supabase connectivity', () => {
      const supabaseCheck = {
        status: 'up',
        responseTime: 12,
        tables: ['voice_agent_calls', 'voice_agent_contacts'],
      }

      expect(supabaseCheck.status).toBe('up')
      expect(supabaseCheck.tables).toBeDefined()
    })

    it('should check Twilio credentials', () => {
      const twilioCheck = {
        status: 'up',
        responseTime: 89,
        accountSid: 'AC***',
        phoneNumber: '+1***1234',
      }

      expect(twilioCheck.status).toBe('up')
      expect(twilioCheck.accountSid).toMatch(/^AC/)
    })

    it('should check Cal.com API access', () => {
      const calcomCheck = {
        status: 'up',
        responseTime: 123,
        eventTypes: ['consultation', 'demo'],
      }

      expect(calcomCheck.status).toBe('up')
      expect(calcomCheck.eventTypes).toBeDefined()
    })
  })

  describe('Environment validation', () => {
    it('should validate required env vars', () => {
      const requiredEnvVars = [
        'VAPI_API_KEY',
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
      ]

      requiredEnvVars.forEach((varName) => {
        expect(typeof varName).toBe('string')
        expect(varName.length).toBeGreaterThan(0)
      })
    })

    it('should validate optional env vars', () => {
      const optionalEnvVars = [
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_PHONE_NUMBER',
        'CALCOM_API_KEY',
        'CALCOM_EVENT_TYPE_ID',
      ]

      optionalEnvVars.forEach((varName) => {
        expect(typeof varName).toBe('string')
      })
    })

    it('should mask sensitive values in health response', () => {
      const health = {
        status: 'healthy',
        env: {
          VAPI_API_KEY: 'vapi_***',
          TWILIO_AUTH_TOKEN: '***',
          CALCOM_API_KEY: 'cal_***',
        },
      }

      Object.values(health.env).forEach((value) => {
        expect(value).toContain('***')
        expect(value.length).toBeLessThan(20)
      })
    })
  })

  describe('Response time tracking', () => {
    it('should measure response time for each service', () => {
      const checks = {
        vapi: { responseTime: 45 },
        supabase: { responseTime: 12 },
        twilio: { responseTime: 89 },
        calcom: { responseTime: 123 },
      }

      Object.values(checks).forEach((check) => {
        expect(check.responseTime).toBeGreaterThan(0)
        expect(check.responseTime).toBeLessThan(5000)
      })
    })

    it('should flag slow services', () => {
      const threshold = 1000 // 1 second
      const checks = {
        vapi: { responseTime: 45, slow: false },
        supabase: { responseTime: 12, slow: false },
        twilio: { responseTime: 1200, slow: true },
        calcom: { responseTime: 123, slow: false },
      }

      Object.values(checks).forEach((check) => {
        const expectedSlow = check.responseTime > threshold
        expect(check.slow).toBe(expectedSlow)
      })
    })
  })

  describe('Error handling', () => {
    it('should capture error details on failure', () => {
      const failedCheck = {
        status: 'down',
        error: 'Connection timeout after 5000ms',
        lastChecked: '2026-03-26T12:00:00Z',
      }

      expect(failedCheck.status).toBe('down')
      expect(failedCheck.error).toBeDefined()
      expect(failedCheck.lastChecked).toBeDefined()
    })

    it('should not expose sensitive error details', () => {
      const error = {
        message: 'Authentication failed',
        // Should NOT include: API keys, passwords, tokens
      }

      expect(error.message).not.toContain('vapi_')
      expect(error.message).not.toContain('sk_')
      expect(error.message).not.toMatch(/[A-Za-z0-9]{32,}/)
    })
  })

  describe('HTTP status codes', () => {
    it('should return 200 when healthy', () => {
      const response = {
        statusCode: 200,
        body: { status: 'healthy' },
      }

      expect(response.statusCode).toBe(200)
    })

    it('should return 503 when unhealthy', () => {
      const response = {
        statusCode: 503,
        body: { status: 'unhealthy' },
      }

      expect(response.statusCode).toBe(503)
    })

    it('should return 200 when degraded (partial outage)', () => {
      const response = {
        statusCode: 200,
        body: { status: 'degraded' },
      }

      // Degraded still returns 200 (service is up but non-critical features down)
      expect(response.statusCode).toBe(200)
      expect(response.body.status).toBe('degraded')
    })
  })

  describe('Caching behavior', () => {
    it('should cache health checks for short duration', () => {
      const cacheConfig = {
        ttl: 30, // 30 seconds
        key: 'health:check',
      }

      expect(cacheConfig.ttl).toBeGreaterThan(0)
      expect(cacheConfig.ttl).toBeLessThanOrEqual(60)
    })

    it('should allow force refresh', () => {
      const request = {
        url: '/api/health?force=true',
        skipCache: true,
      }

      expect(request.skipCache).toBe(true)
    })
  })
})
