// F0771: Prompt character count
// F0772: Prompt max length validation
// F0775: Fallback phrase validation
// F0776: Fallback phrase minimum count

/**
 * F0771: Get character count for prompt
 */
export function getPromptCharacterCount(text: string): {
  characters: number
  words: number
  lines: number
} {
  return {
    characters: text.length,
    words: text.trim().split(/\s+/).filter(Boolean).length,
    lines: text.split('\n').length,
  }
}

/**
 * F0772: Validate prompt length
 * System prompts should be under 4000 characters for optimal LLM performance
 */
export function validatePromptLength(text: string): {
  valid: boolean
  characterCount: number
  maxCharacters: number
  message?: string
} {
  const MAX_CHARACTERS = 4000
  const characterCount = text.length

  if (characterCount === 0) {
    return {
      valid: false,
      characterCount: 0,
      maxCharacters: MAX_CHARACTERS,
      message: 'Prompt cannot be empty',
    }
  }

  if (characterCount > MAX_CHARACTERS) {
    return {
      valid: false,
      characterCount,
      maxCharacters: MAX_CHARACTERS,
      message: `Prompt exceeds maximum length by ${characterCount - MAX_CHARACTERS} characters`,
    }
  }

  return {
    valid: true,
    characterCount,
    maxCharacters: MAX_CHARACTERS,
  }
}

/**
 * F0775: Validate fallback phrase
 * Ensures phrase is appropriate and not empty
 */
export function validateFallbackPhrase(phrase: string): {
  valid: boolean
  message?: string
} {
  // Check not empty
  if (!phrase || phrase.trim().length === 0) {
    return {
      valid: false,
      message: 'Fallback phrase cannot be empty',
    }
  }

  // Check minimum length (at least 3 words)
  const words = phrase.trim().split(/\s+/)
  if (words.length < 3) {
    return {
      valid: false,
      message: 'Fallback phrase should be at least 3 words',
    }
  }

  // Check maximum length (under 200 characters)
  if (phrase.length > 200) {
    return {
      valid: false,
      message: 'Fallback phrase should be under 200 characters',
    }
  }

  // Check no special characters that might break TTS
  const invalidChars = /[<>{}[\]\\]/
  if (invalidChars.test(phrase)) {
    return {
      valid: false,
      message: 'Fallback phrase contains invalid characters',
    }
  }

  return { valid: true }
}

/**
 * F0776: Validate minimum fallback phrases
 * Persona should have at least 3 fallback phrases
 */
export function validateFallbackPhrases(phrases: string[]): {
  valid: boolean
  count: number
  minimum: number
  message?: string
} {
  const MINIMUM_PHRASES = 3

  if (!phrases || phrases.length === 0) {
    return {
      valid: false,
      count: 0,
      minimum: MINIMUM_PHRASES,
      message: 'At least 3 fallback phrases are required',
    }
  }

  // Filter out empty phrases
  const validPhrases = phrases.filter(p => p && p.trim().length > 0)

  if (validPhrases.length < MINIMUM_PHRASES) {
    return {
      valid: false,
      count: validPhrases.length,
      minimum: MINIMUM_PHRASES,
      message: `At least ${MINIMUM_PHRASES} fallback phrases are required (found ${validPhrases.length})`,
    }
  }

  // Validate each phrase
  for (const phrase of validPhrases) {
    const validation = validateFallbackPhrase(phrase)
    if (!validation.valid) {
      return {
        valid: false,
        count: validPhrases.length,
        minimum: MINIMUM_PHRASES,
        message: `Invalid phrase: ${validation.message}`,
      }
    }
  }

  return {
    valid: true,
    count: validPhrases.length,
    minimum: MINIMUM_PHRASES,
  }
}

/**
 * F0773: Generate first message preview
 * Shows how the first message will sound with variables filled
 */
export function generateFirstMessagePreview(
  template: string,
  sampleVariables: Record<string, string> = {}
): string {
  // Default sample variables if none provided
  const defaults: Record<string, string> = {
    contact_name: 'John',
    contact_company: 'Acme Corp',
    agent_name: 'Sarah',
    campaign_name: 'Q1 Outreach',
  }

  const variables = { ...defaults, ...sampleVariables }

  // Replace variables in template
  let preview = template
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    preview = preview.replace(regex, value)
  }

  return preview
}

/**
 * F0769: Get system prompt templates
 */
export function getSystemPromptTemplates(): Array<{
  id: string
  name: string
  description: string
  template: string
  category: string
}> {
  return [
    {
      id: 'sales-sdr',
      name: 'Sales SDR',
      description: 'Outbound sales development representative',
      category: 'sales',
      template: `You are {{agent_name}}, a friendly sales development representative calling on behalf of {{company_name}}.

Your goal is to:
1. Qualify if the prospect is a good fit
2. Book a meeting with an account executive
3. Answer basic questions about our product

Be conversational, listen actively, and don't be pushy. If they're not interested, thank them and end the call politely.

Key qualification questions:
- Company size
- Current solution
- Budget timeframe
- Decision-making process`,
    },
    {
      id: 'appointment-scheduler',
      name: 'Appointment Scheduler',
      description: 'Books appointments and answers scheduling questions',
      category: 'support',
      template: `You are {{agent_name}}, an appointment scheduler for {{company_name}}.

Your role is to:
1. Confirm caller's details
2. Check availability
3. Book appointments
4. Send confirmation details

Be professional, efficient, and friendly. Always confirm the appointment details before ending the call.`,
    },
    {
      id: 'customer-support',
      name: 'Customer Support',
      description: 'Handles support inquiries and escalates when needed',
      category: 'support',
      template: `You are {{agent_name}}, a customer support agent for {{company_name}}.

Your responsibilities:
1. Gather information about the issue
2. Provide solutions for common problems
3. Escalate to human agent when needed

Be empathetic, patient, and solution-oriented. Always ask if there's anything else you can help with before ending the call.`,
    },
    {
      id: 'lead-qualifier',
      name: 'Lead Qualifier',
      description: 'Qualifies inbound leads',
      category: 'sales',
      template: `You are {{agent_name}}, calling to qualify a lead for {{company_name}}.

Your goal is to determine:
1. Need/pain point
2. Timeline
3. Budget
4. Authority (decision maker)

Use BANT qualification framework. Be consultative, not salesy.`,
    },
  ]
}
