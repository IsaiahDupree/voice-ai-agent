// F0603, F0604: Phone number formatting and normalization utilities

// F0604: Normalize phone to E.164 format
export function normalizePhoneNumber(phone: string): string {
  return normalizePhone(phone)
}

export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  // If it starts with 1 (US/Canada), keep it
  // If it's 10 digits (US/Canada without country code), add +1
  // Otherwise, assume it already has country code
  if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
    return `+${digitsOnly}`
  } else if (digitsOnly.length === 10) {
    return `+1${digitsOnly}`
  } else if (digitsOnly.startsWith('1')) {
    return `+${digitsOnly}`
  } else {
    return `+${digitsOnly}`
  }
}

// F0603: Validate E.164 format
export function isValidE164(phone: string): boolean {
  // E.164 format: +[country code][subscriber number]
  // Max 15 digits, must start with +
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phone)
}

// Format phone for display (US numbers only)
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return ''

  const digitsOnly = phone.replace(/\D/g, '')

  // US/Canada format: (XXX) XXX-XXXX
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    const area = digitsOnly.slice(1, 4)
    const prefix = digitsOnly.slice(4, 7)
    const line = digitsOnly.slice(7, 11)
    return `(${area}) ${prefix}-${line}`
  } else if (digitsOnly.length === 10) {
    const area = digitsOnly.slice(0, 3)
    const prefix = digitsOnly.slice(3, 6)
    const line = digitsOnly.slice(6, 10)
    return `(${area}) ${prefix}-${line}`
  }

  return phone
}
