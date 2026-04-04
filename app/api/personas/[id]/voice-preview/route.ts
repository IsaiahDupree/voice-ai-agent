// F0942: GET /api/personas/:id/voice-preview - Returns voice preview audio

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0942: GET /api/personas/:id/voice-preview
 * Returns voice preview audio URL for the persona's voice
 * This would typically generate a sample audio using ElevenLabs or return a preview URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get persona
    const { data: persona, error } = await supabaseAdmin
      .from('personas')
      .select('id, name, voice_id, first_message')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
      }
      throw error
    }

    if (!persona.voice_id) {
      return NextResponse.json(
        { error: 'Persona does not have a voice configured' },
        { status: 400 }
      )
    }

    // In a real implementation, this would call ElevenLabs to generate audio:
    // const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${persona.voice_id}`, {
    //   method: 'POST',
    //   headers: {
    //     'xi-api-key': process.env.ELEVENLABS_API_KEY,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     text: persona.first_message || 'Hello! This is a preview of my voice.',
    //     voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    //   })
    // })
    // const audioBuffer = await response.arrayBuffer()
    // return new NextResponse(audioBuffer, {
    //   headers: { 'Content-Type': 'audio/mpeg' }
    // })

    // For now, return a preview URL based on voice_id
    // These URLs are from the ElevenLabs premade voices
    const voicePreviewUrls: Record<string, string> = {
      'EXAVITQu4vr4xnSDxMaL': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/bf48d7d5-3fc8-4b76-9c2e-29373a041b63.mp3',
      'VR6AewLTigWG4xSOukaG': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/8e01a046-e51f-4991-a37b-f5f41687a2c0.mp3',
      'pNInz6obpgDQGcFmaJgB': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/19fdb7a9-fd26-4c7f-b055-bb3fdb7d09b7.mp3',
      'ThT5KcBeYPX3keUQqHPh': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/ThT5KcBeYPX3keUQqHPh/1cb4bcf3-14f4-4cfc-a8dd-f0e4ef5e86cf.mp3',
      'TX3LPaxmHKxFdv7VOQHJ': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/54b5ffab-9048-45e9-8e68-cdebf54a1e09.mp3',
      '21m00Tcm4TlvDq8ikWAM': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/aa5e78e8-c2d5-4e88-b8e3-06ea6e70ada8.mp3',
      'pqHfZKP75CvOlQylNhV4': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/89958219-e2c8-4f99-8ee9-0fc1e5e5fb60.mp3',
      'XB0fDUnXU5powFXDhCwa': 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/31b66e83-81c3-4f32-885c-7c2f8f8b0954.mp3',
    }

    const previewUrl = voicePreviewUrls[persona.voice_id]

    if (!previewUrl) {
      return NextResponse.json(
        {
          success: true,
          message: 'No preview available for this voice',
          voice_id: persona.voice_id,
          preview_url: null
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      success: true,
      persona_id: persona.id,
      persona_name: persona.name,
      voice_id: persona.voice_id,
      preview_url: previewUrl,
      text: persona.first_message || 'Hello! This is a preview of my voice.',
    })
  } catch (error: any) {
    console.error('Error fetching voice preview:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch voice preview' },
      { status: 500 }
    )
  }
}
