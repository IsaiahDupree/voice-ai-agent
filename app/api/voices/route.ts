// F0943: GET /api/voices - Lists available ElevenLabs voices
// F0766: Voice search by name, gender, accent

import { NextRequest, NextResponse } from 'next/server'

interface Voice {
  voice_id: string
  name: string
  category: string
  description: string
  preview_url: string
  gender?: 'male' | 'female' | 'neutral'
  accent?: string
  age?: string
}

/**
 * F0943, F0766, F0767: GET /api/voices?search=name&gender=female&accent=american&category=premade
 * Returns list of available ElevenLabs voices with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('search')?.toLowerCase()
    const genderFilter = searchParams.get('gender')?.toLowerCase()
    const accentFilter = searchParams.get('accent')?.toLowerCase()
    const categoryFilter = searchParams.get('category')?.toLowerCase() // F0767

    // In a real implementation, this would call:
    // const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    //   headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    // })

    // For now, return a static list of popular ElevenLabs voices
    const voices: Voice[] = [
      {
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Sarah',
        category: 'premade',
        description: 'Friendly and professional female voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/EXAVITQu4vr4xnSDxMaL/bf48d7d5-3fc8-4b76-9c2e-29373a041b63.mp3',
        gender: 'female',
        accent: 'american',
        age: 'middle-aged',
      },
      {
        voice_id: 'VR6AewLTigWG4xSOukaG',
        name: 'Josh',
        category: 'premade',
        description: 'Deep and confident male voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/VR6AewLTigWG4xSOukaG/8e01a046-e51f-4991-a37b-f5f41687a2c0.mp3',
        gender: 'male',
        accent: 'american',
        age: 'middle-aged',
      },
      {
        voice_id: 'pNInz6obpgDQGcFmaJgB',
        name: 'Adam',
        category: 'premade',
        description: 'Warm and engaging male voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/19fdb7a9-fd26-4c7f-b055-bb3fdb7d09b7.mp3',
        gender: 'male',
        accent: 'american',
        age: 'young',
      },
      {
        voice_id: 'ThT5KcBeYPX3keUQqHPh',
        name: 'Rachel',
        category: 'premade',
        description: 'Clear and articulate female voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/ThT5KcBeYPX3keUQqHPh/1cb4bcf3-14f4-4cfc-a8dd-f0e4ef5e86cf.mp3',
        gender: 'female',
        accent: 'american',
        age: 'middle-aged',
      },
      {
        voice_id: 'TX3LPaxmHKxFdv7VOQHJ',
        name: 'Liam',
        category: 'premade',
        description: 'Young and energetic male voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/TX3LPaxmHKxFdv7VOQHJ/54b5ffab-9048-45e9-8e68-cdebf54a1e09.mp3',
        gender: 'male',
        accent: 'british',
        age: 'young',
      },
      {
        voice_id: '21m00Tcm4TlvDq8ikWAM',
        name: 'Bella',
        category: 'premade',
        description: 'Soft and calming female voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/aa5e78e8-c2d5-4e88-b8e3-06ea6e70ada8.mp3',
        gender: 'female',
        accent: 'american',
        age: 'young',
      },
      {
        voice_id: 'pqHfZKP75CvOlQylNhV4',
        name: 'Bill',
        category: 'premade',
        description: 'Authoritative and trustworthy male voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/pqHfZKP75CvOlQylNhV4/89958219-e2c8-4f99-8ee9-0fc1e5e5fb60.mp3',
        gender: 'male',
        accent: 'american',
        age: 'middle-aged',
      },
      {
        voice_id: 'XB0fDUnXU5powFXDhCwa',
        name: 'Charlotte',
        category: 'premade',
        description: 'Professional and polished female voice',
        preview_url: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/XB0fDUnXU5powFXDhCwa/31b66e83-81c3-4f32-885c-7c2f8f8b0954.mp3',
        gender: 'female',
        accent: 'british',
        age: 'middle-aged',
      },
    ]

    // F0766, F0767: Apply search and filters
    let filteredVoices = voices

    if (searchQuery) {
      filteredVoices = filteredVoices.filter((voice) =>
        voice.name.toLowerCase().includes(searchQuery) ||
        voice.description.toLowerCase().includes(searchQuery)
      )
    }

    if (genderFilter) {
      filteredVoices = filteredVoices.filter((voice) => voice.gender === genderFilter)
    }

    if (accentFilter) {
      filteredVoices = filteredVoices.filter((voice) => voice.accent === accentFilter)
    }

    // F0767: Category filter (premade/cloned/professional)
    if (categoryFilter) {
      filteredVoices = filteredVoices.filter((voice) => voice.category === categoryFilter)
    }

    return NextResponse.json({
      success: true,
      count: filteredVoices.length,
      total: voices.length,
      filters: {
        search: searchQuery,
        gender: genderFilter,
        accent: accentFilter,
        category: categoryFilter, // F0767
      },
      voices: filteredVoices,
    })
  } catch (error: any) {
    console.error('Error fetching voices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch voices' },
      { status: 500 }
    )
  }
}
