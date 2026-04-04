import { VapiAssistant } from './vapi'

// F0098: Call whisper - Play hidden context to AI agent before call connects
// This provides context to the AI that the caller doesn't hear

export interface CallWhisperContext {
  contactName?: string
  contactCompany?: string
  previousInteractions?: string
  callReason?: string
  specialNotes?: string
  accountValue?: string
  lastPurchaseDate?: string
  customFields?: Record<string, any>
}

/**
 * F0098: Generate assistant overrides with whispered context
 * This pre-seeds the AI's conversation history with context the caller doesn't hear
 *
 * Example usage:
 * ```typescript
 * const whisperContext = {
 *   contactName: 'John Smith',
 *   contactCompany: 'Acme Corp',
 *   callReason: 'Follow-up on quote #1234',
 *   accountValue: '$50,000 ARR',
 * }
 *
 * const overrides = generateWhisperOverrides(whisperContext)
 *
 * await startCall({
 *   assistantId: 'asst_123',
 *   customerNumber: '+15555551234',
 *   assistantOverrides: overrides, // Includes whispered context
 * })
 * ```
 */
export function generateWhisperOverrides(
  context: CallWhisperContext
): Partial<VapiAssistant> {
  // Build a system message with the whispered context
  const whisperParts: string[] = []

  if (context.contactName) {
    whisperParts.push(`Caller: ${context.contactName}`)
  }

  if (context.contactCompany) {
    whisperParts.push(`Company: ${context.contactCompany}`)
  }

  if (context.previousInteractions) {
    whisperParts.push(`Previous interactions: ${context.previousInteractions}`)
  }

  if (context.callReason) {
    whisperParts.push(`Call reason: ${context.callReason}`)
  }

  if (context.accountValue) {
    whisperParts.push(`Account value: ${context.accountValue}`)
  }

  if (context.lastPurchaseDate) {
    whisperParts.push(`Last purchase: ${context.lastPurchaseDate}`)
  }

  if (context.specialNotes) {
    whisperParts.push(`Important notes: ${context.specialNotes}`)
  }

  if (context.customFields) {
    Object.entries(context.customFields).forEach(([key, value]) => {
      whisperParts.push(`${key}: ${value}`)
    })
  }

  if (whisperParts.length === 0) {
    return {} // No context to whisper
  }

  const whisperMessage = [
    '# Context (caller is not aware of this information)',
    ...whisperParts,
    '',
    'Use this information naturally in the conversation without revealing that you have it beforehand.',
  ].join('\n')

  // Pre-seed the conversation with a system message
  return {
    model: {
      messages: [
        {
          role: 'system',
          content: whisperMessage,
        },
      ],
    } as any,
  }
}

/**
 * Example: Generate whisper context from CRM contact data
 */
export function generateWhisperFromContact(contact: any): CallWhisperContext {
  return {
    contactName: contact.name,
    contactCompany: contact.company,
    specialNotes: contact.notes,
    customFields: contact.metadata,
  }
}
