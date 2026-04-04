// F1165: Data encryption at rest - Encrypt sensitive fields in database

import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || 'default-key-not-secure'
const IV_LENGTH = 16
const ALGORITHM = 'aes-256-cbc'

/**
 * F1165: Encrypt data for at-rest storage
 * Used for sensitive fields like transcripts, contact details, etc.
 */
export function encryptData(data: string): string {
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

    // Encrypt
    let encrypted = cipher.update(data)
    encrypted = Buffer.concat([encrypted, cipher.final()])

    // Return IV + encrypted data (both as hex)
    return iv.toString('hex') + ':' + encrypted.toString('hex')
  } catch (error: any) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt data that was encrypted with encryptData
 */
export function decryptData(encryptedData: string): string {
  try {
    // Split IV and encrypted data
    const [ivHex, encryptedHex] = encryptedData.split(':')

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)

    // Decrypt
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString()
  } catch (error: any) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Generate encryption key (one-time setup)
 * Should be run once to generate ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Hash sensitive data for indexing (one-way)
 * Used when you need to search/index but not decrypt
 */
export function hashSensitiveData(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data + process.env.HASH_SALT)
    .digest('hex')
}

/**
 * Encrypt an object's sensitive fields
 */
export function encryptSensitiveFields(
  obj: any,
  fieldsToEncrypt: string[]
): any {
  const encrypted = { ...obj }

  for (const field of fieldsToEncrypt) {
    if (encrypted[field]) {
      encrypted[field] = encryptData(encrypted[field])
    }
  }

  return encrypted
}

/**
 * Decrypt an object's encrypted fields
 */
export function decryptSensitiveFields(
  obj: any,
  fieldsToDecrypt: string[]
): any {
  const decrypted = { ...obj }

  for (const field of fieldsToDecrypt) {
    if (decrypted[field]) {
      try {
        decrypted[field] = decryptData(decrypted[field])
      } catch (error) {
        console.warn(`Failed to decrypt field: ${field}`)
      }
    }
  }

  return decrypted
}
