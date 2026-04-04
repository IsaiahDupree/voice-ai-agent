// F1243: Mock Twilio client for testing

/**
 * F1243: Mock Twilio client
 */
export class MockTwilioClient {
  public messages: any[] = []
  private shouldError: boolean = false
  private errorMessage: string = 'Mock Twilio error'

  /**
   * Mock messages API
   */
  messages = {
    create: async (params: any) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      const message = {
        sid: `SM${Math.random().toString(36).substring(2, 34)}`,
        from: params.from,
        to: params.to,
        body: params.body,
        status: 'queued',
        dateCreated: new Date(),
        dateSent: null,
        dateUpdated: new Date(),
      }
      this.messages.push(message)
      return message
    },
    list: async (params?: any) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      let filtered = [...this.messages]
      if (params?.to) {
        filtered = filtered.filter((m) => m.to === params.to)
      }
      if (params?.from) {
        filtered = filtered.filter((m) => m.from === params.from)
      }
      return filtered
    },
    get: (sid: string) => ({
      fetch: async () => {
        if (this.shouldError) {
          throw new Error(this.errorMessage)
        }
        return this.messages.find((m) => m.sid === sid) || null
      },
    }),
  }

  /**
   * Force next operation to error
   */
  forceError(message: string = 'Mock Twilio error') {
    this.shouldError = true
    this.errorMessage = message
  }

  /**
   * Clear error state
   */
  clearError() {
    this.shouldError = false
  }

  /**
   * Reset mock to initial state
   */
  reset() {
    this.messages = []
    this.shouldError = false
    this.errorMessage = 'Mock Twilio error'
  }
}

export const mockTwilio = new MockTwilioClient()
