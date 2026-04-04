// F1242: Mock Vapi SDK for testing

/**
 * F1242: Mock Vapi SDK
 */
export class MockVapiClient {
  public assistants: any[] = []
  public calls: any[] = []
  public phoneNumbers: any[] = []
  private shouldError: boolean = false
  private errorMessage: string = 'Mock Vapi error'

  /**
   * Mock assistants API
   */
  assistant = {
    create: async (config: any) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      const assistant = { id: `asst_${Date.now()}`, ...config }
      this.assistants.push(assistant)
      return assistant
    },
    list: async () => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      return this.assistants
    },
    get: async (id: string) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      return this.assistants.find((a) => a.id === id) || null
    },
    update: async (id: string, updates: any) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      const index = this.assistants.findIndex((a) => a.id === id)
      if (index >= 0) {
        this.assistants[index] = { ...this.assistants[index], ...updates }
        return this.assistants[index]
      }
      return null
    },
    delete: async (id: string) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      const index = this.assistants.findIndex((a) => a.id === id)
      if (index >= 0) {
        this.assistants.splice(index, 1)
        return { success: true }
      }
      return { success: false }
    },
  }

  /**
   * Mock calls API
   */
  call = {
    create: async (params: any) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      const call = {
        id: `call_${Date.now()}`,
        status: 'queued',
        ...params,
      }
      this.calls.push(call)
      return call
    },
    list: async () => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      return this.calls
    },
    get: async (id: string) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      return this.calls.find((c) => c.id === id) || null
    },
  }

  /**
   * Mock phone numbers API
   */
  phoneNumber = {
    buy: async (params: any) => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      const phone = {
        id: `pn_${Date.now()}`,
        number: params.number || '+15555550000',
        ...params,
      }
      this.phoneNumbers.push(phone)
      return phone
    },
    list: async () => {
      if (this.shouldError) {
        throw new Error(this.errorMessage)
      }
      return this.phoneNumbers
    },
  }

  /**
   * Force next operation to error
   */
  forceError(message: string = 'Mock Vapi error') {
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
    this.assistants = []
    this.calls = []
    this.phoneNumbers = []
    this.shouldError = false
    this.errorMessage = 'Mock Vapi error'
  }
}

export const mockVapi = new MockVapiClient()
