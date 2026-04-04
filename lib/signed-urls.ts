// F1166: Recording URL signed - Generate signed URLs for secure file access

import crypto from 'crypto'

/**
 * F1166: Generate a signed URL for secure file access
 * Used for recording downloads and transcript downloads
 * Prevents direct URL sharing and allows time-limited access
 */
export function generateSignedUrl(params: {
  filePath: string
  bucket: string
  expiresIn?: number // seconds, default 1 hour
}): string {
  const expiresIn = params.expiresIn || 3600 // 1 hour default
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn

  // Create signature
  const signature = crypto
    .createHmac('sha256', process.env.SIGNED_URL_SECRET || 'secret')
    .update(`${params.bucket}/${params.filePath}/${expiresAt}`)
    .digest('hex')

  // Return signed URL
  const baseUrl = process.env.STORAGE_URL || 'https://storage.example.com'
  return `${baseUrl}/${params.bucket}/${params.filePath}?sig=${signature}&exp=${expiresAt}`
}

/**
 * Verify a signed URL is valid
 */
export function verifySignedUrl(url: string, bucket: string): {
  valid: boolean
  error?: string
} {
  try {
    const urlObj = new URL(url)
    const signature = urlObj.searchParams.get('sig')
    const expiresAt = parseInt(urlObj.searchParams.get('exp') || '0')
    const filePath = urlObj.pathname.replace(`/${bucket}/`, '')

    if (!signature || !expiresAt) {
      return { valid: false, error: 'Missing signature or expiration' }
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (now > expiresAt) {
      return { valid: false, error: 'URL has expired' }
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.SIGNED_URL_SECRET || 'secret')
      .update(`${bucket}/${filePath}/${expiresAt}`)
      .digest('hex')

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' }
    }

    return { valid: true }
  } catch (error: any) {
    return { valid: false, error: error.message }
  }
}

/**
 * Create a signed download URL for a recording
 */
export function createRecordingDownloadUrl(callId: string): string {
  return generateSignedUrl({
    filePath: `recordings/${callId}.mp3`,
    bucket: 'voice-ai-agent-files',
    expiresIn: 24 * 3600, // 24 hours
  })
}

/**
 * Create a signed download URL for a transcript
 */
export function createTranscriptDownloadUrl(callId: string): string {
  return generateSignedUrl({
    filePath: `transcripts/${callId}.json`,
    bucket: 'voice-ai-agent-files',
    expiresIn: 24 * 3600, // 24 hours
  })
}
