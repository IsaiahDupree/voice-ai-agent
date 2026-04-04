// F1182: Phone number masking - Mask phone numbers in logs and responses

/**
 * F1182: Mask phone number for display
 * Shows only last 4 digits to protect privacy
 * Example: +1-415-555-1234 -> +1-415-555-****
 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''

  // Remove all non-digit characters for processing
  const digits = phoneNumber.replace(/\D/g, '')

  if (digits.length < 4) {
    return '***'
  }

  // Get last 4 digits
  const lastFour = digits.slice(-4)
  const masked = '*'.repeat(digits.length - 4) + lastFour

  // Reconstruct with original formatting if possible
  if (phoneNumber.startsWith('+1')) {
    return `+1-${masked.slice(-10, -7)}-${masked.slice(-7, -4)}-${masked.slice(-4)}`
  }

  return `***-${lastFour}`
}

/**
 * Mask phone number - show only country code and last 4 digits
 * Used in audit logs and api-log tables
 */
export function maskPhoneNumberForLogging(phoneNumber: string): string {
  if (!phoneNumber) return ''

  // Extract components
  const countryMatch = phoneNumber.match(/^\+(\d+)/)
  const lastFour = phoneNumber.slice(-4)

  if (countryMatch) {
    return `+${countryMatch[1]}-****-${lastFour}`
  }

  return `***-${lastFour}`
}

/**
 * Check if a phone number should be masked
 * Always mask unless explicitly authorized
 */
export function shouldMaskPhoneNumber(
  context?: { authenticated?: boolean; adminRole?: boolean }
): boolean {
  // Always mask unless explicitly authorized by admin
  if (context?.authenticated && context?.adminRole) {
    return false
  }

  return true
}

/**
 * Mask phone numbers in an object
 * Recursively finds and masks phone number fields
 */
export function maskPhoneNumbersInObject(obj: any): any {
  if (!obj) return obj

  if (typeof obj === 'string') {
    // Check if it looks like a phone number
    if (obj.match(/^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/)) {
      return maskPhoneNumber(obj)
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskPhoneNumbersInObject(item))
  }

  if (typeof obj === 'object') {
    const masked: any = {}
    for (const key in obj) {
      if (key.includes('phone') || key.includes('number')) {
        masked[key] = maskPhoneNumber(obj[key])
      } else if (typeof obj[key] === 'object') {
        masked[key] = maskPhoneNumbersInObject(obj[key])
      } else {
        masked[key] = obj[key]
      }
    }
    return masked
  }

  return obj
}
