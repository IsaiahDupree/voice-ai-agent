// F1241: Mock Supabase client for testing

/**
 * F1241: Mock Supabase client
 * In-memory database mock for unit tests
 */
export class MockSupabaseClient {
  private data: Map<string, any[]> = new Map()
  private shouldError: boolean = false
  private errorMessage: string = 'Mock error'

  constructor() {
    this.reset()
  }

  /**
   * Mock from() method
   */
  from(table: string) {
    return {
      select: (columns?: string) => ({
        data: this.data.get(table) || [],
        error: this.shouldError ? { message: this.errorMessage } : null,
        eq: (column: string, value: any) => ({
          data:
            this.data.get(table)?.filter((row) => row[column] === value) || [],
          error: this.shouldError ? { message: this.errorMessage } : null,
          single: () => ({
            data:
              this.data.get(table)?.find((row) => row[column] === value) ||
              null,
            error: this.shouldError ? { message: this.errorMessage } : null,
          }),
        }),
        single: () => ({
          data: this.data.get(table)?.[0] || null,
          error: this.shouldError ? { message: this.errorMessage } : null,
        }),
      }),
      insert: (record: any) => ({
        select: () => ({
          data: [{ id: Math.random(), ...record }],
          error: this.shouldError ? { message: this.errorMessage } : null,
        }),
      }),
      update: (updates: any) => ({
        eq: (column: string, value: any) => ({
          select: () => ({
            data: [{ id: value, ...updates }],
            error: this.shouldError ? { message: this.errorMessage } : null,
          }),
        }),
      }),
      delete: () => ({
        eq: (column: string, value: any) => ({
          data: null,
          error: this.shouldError ? { message: this.errorMessage } : null,
        }),
      }),
      upsert: (records: any, options?: any) => ({
        select: () => ({
          data: Array.isArray(records) ? records.map((r, i) => ({ id: i + 1, ...r })) : [{ id: 1, ...records }],
          error: this.shouldError ? { message: this.errorMessage } : null,
        }),
      }),
    }
  }

  /**
   * Set mock data for a table
   */
  setData(table: string, data: any[]) {
    this.data.set(table, data)
  }

  /**
   * Get mock data for a table
   */
  getData(table: string): any[] {
    return this.data.get(table) || []
  }

  /**
   * Force next operation to error
   */
  forceError(message: string = 'Mock error') {
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
    this.data.clear()
    this.shouldError = false
    this.errorMessage = 'Mock error'

    // Set up default empty tables
    this.data.set('contacts', [])
    this.data.set('call_logs', [])
    this.data.set('sms_logs', [])
    this.data.set('bookings', [])
    this.data.set('campaigns', [])
    this.data.set('agent_personas', [])
    this.data.set('dnc_list', [])
  }
}

export const mockSupabase = new MockSupabaseClient()
