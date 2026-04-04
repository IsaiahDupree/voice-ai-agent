// F0728: API keys status endpoint
// Returns masked status of all API keys

import { NextResponse } from 'next/server'

function maskKey(key: string | undefined): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
}

function checkKeyStatus(key: string | undefined): 'configured' | 'missing' {
  return key && key.length > 0 ? 'configured' : 'missing'
}

export async function GET() {
  try {
    const services = [
      {
        name: 'Vapi API',
        hasKey: !!process.env.VAPI_API_KEY,
        keyPreview: maskKey(process.env.VAPI_API_KEY),
        status: checkKeyStatus(process.env.VAPI_API_KEY),
      },
      {
        name: 'OpenAI API',
        hasKey: !!process.env.OPENAI_API_KEY,
        keyPreview: maskKey(process.env.OPENAI_API_KEY),
        status: checkKeyStatus(process.env.OPENAI_API_KEY),
      },
      {
        name: 'ElevenLabs API',
        hasKey: !!process.env.ELEVENLABS_API_KEY,
        keyPreview: maskKey(process.env.ELEVENLABS_API_KEY),
        status: checkKeyStatus(process.env.ELEVENLABS_API_KEY),
      },
      {
        name: 'Deepgram API',
        hasKey: !!process.env.DEEPGRAM_API_KEY,
        keyPreview: maskKey(process.env.DEEPGRAM_API_KEY),
        status: checkKeyStatus(process.env.DEEPGRAM_API_KEY),
      },
      {
        name: 'Cal.com API',
        hasKey: !!process.env.CALCOM_API_KEY,
        keyPreview: maskKey(process.env.CALCOM_API_KEY),
        status: checkKeyStatus(process.env.CALCOM_API_KEY),
      },
      {
        name: 'Twilio Account SID',
        hasKey: !!process.env.TWILIO_ACCOUNT_SID,
        keyPreview: maskKey(process.env.TWILIO_ACCOUNT_SID),
        status: checkKeyStatus(process.env.TWILIO_ACCOUNT_SID),
      },
      {
        name: 'Twilio Auth Token',
        hasKey: !!process.env.TWILIO_AUTH_TOKEN,
        keyPreview: maskKey(process.env.TWILIO_AUTH_TOKEN),
        status: checkKeyStatus(process.env.TWILIO_AUTH_TOKEN),
      },
      {
        name: 'Supabase URL',
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        keyPreview: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').substring(0, 20) + '...',
        status: checkKeyStatus(process.env.NEXT_PUBLIC_SUPABASE_URL),
      },
      {
        name: 'Supabase Service Role Key',
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        keyPreview: maskKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
        status: checkKeyStatus(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    ]

    return NextResponse.json({
      services,
      summary: {
        total: services.length,
        configured: services.filter((s) => s.status === 'configured').length,
        missing: services.filter((s) => s.status === 'missing').length,
      },
    })
  } catch (error: any) {
    console.error('[Settings] Error checking keys status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check keys status' },
      { status: 500 }
    )
  }
}
