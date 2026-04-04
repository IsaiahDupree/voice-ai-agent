// F0172: Call PII redaction - Redact sensitive information from transcripts

export interface PIIRedactionResult {
  redacted: string
  originalLength: number
  redactedFields: string[]
}

/**
 * F0172: Redact PII from call transcripts before storage
 * Removes: SSN, credit card numbers, email addresses (optional), phone numbers (optional)
 */
export function redactPII(text: string, options?: {
  redactEmails?: boolean
  redactPhones?: boolean
  redactDates?: boolean
}): PIIRedactionResult {
  const {
    redactEmails = false,
    redactPhones = false,
    redactDates = false,
  } = options || {}

  let redacted = text
  const redactedFields: string[] = []

  // F0172: SSN patterns (XXX-XX-XXXX, XXX XX XXXX, XXXXXXXXX)
  const ssnPatterns = [
    /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  ]

  for (const pattern of ssnPatterns) {
    if (pattern.test(redacted)) {
      redacted = redacted.replace(pattern, '[SSN REDACTED]')
      if (!redactedFields.includes('SSN')) {
        redactedFields.push('SSN')
      }
    }
  }

  // F0172: Credit card patterns (16 digits with optional spaces/dashes)
  const ccPatterns = [
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // 16-digit cards
    /\b\d{4}[-\s]?\d{6}[-\s]?\d{5}\b/g, // 15-digit Amex
  ]

  for (const pattern of ccPatterns) {
    if (pattern.test(redacted)) {
      redacted = redacted.replace(pattern, '[CREDIT CARD REDACTED]')
      if (!redactedFields.includes('CREDIT_CARD')) {
        redactedFields.push('CREDIT_CARD')
      }
    }
  }

  // CVV codes (3-4 digits following "CVV", "CVC", or "security code")
  const cvvPattern = /(?:CVV|CVC|security code)[:\s]+\d{3,4}\b/gi
  if (cvvPattern.test(redacted)) {
    redacted = redacted.replace(cvvPattern, '[CVV REDACTED]')
    if (!redactedFields.includes('CVV')) {
      redactedFields.push('CVV')
    }
  }

  // Bank account numbers (8-17 digits)
  const bankAccountPattern = /\b(?:account|routing)(?:\s+number)?[:\s]+\d{8,17}\b/gi
  if (bankAccountPattern.test(redacted)) {
    redacted = redacted.replace(bankAccountPattern, '[ACCOUNT NUMBER REDACTED]')
    if (!redactedFields.includes('BANK_ACCOUNT')) {
      redactedFields.push('BANK_ACCOUNT')
    }
  }

  // Optional: Email addresses
  if (redactEmails) {
    const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
    if (emailPattern.test(redacted)) {
      redacted = redacted.replace(emailPattern, '[EMAIL REDACTED]')
      if (!redactedFields.includes('EMAIL')) {
        redactedFields.push('EMAIL')
      }
    }
  }

  // Optional: Phone numbers (10 digits with various formats)
  if (redactPhones) {
    const phonePattern = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
    if (phonePattern.test(redacted)) {
      redacted = redacted.replace(phonePattern, '[PHONE REDACTED]')
      if (!redactedFields.includes('PHONE')) {
        redactedFields.push('PHONE')
      }
    }
  }

  // Optional: Birth dates (MM/DD/YYYY, etc.)
  if (redactDates) {
    const datePattern = /\b(?:DOB|date of birth|birthday)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi
    if (datePattern.test(redacted)) {
      redacted = redacted.replace(datePattern, '[DATE OF BIRTH REDACTED]')
      if (!redactedFields.includes('DOB')) {
        redactedFields.push('DOB')
      }
    }
  }

  return {
    redacted,
    originalLength: text.length,
    redactedFields,
  }
}

/**
 * Check if text contains potential PII (for compliance logging)
 */
export function containsPII(text: string): boolean {
  const result = redactPII(text, { redactEmails: true, redactPhones: true, redactDates: true })
  return result.redactedFields.length > 0
}

/**
 * Get a safe version of transcript for logging/display
 */
export function getSafeTranscript(transcript: string): string {
  const result = redactPII(transcript, {
    redactEmails: false, // Keep emails visible for business context
    redactPhones: false, // Keep phones visible for business context
    redactDates: false, // Keep dates visible
  })

  return result.redacted
}
