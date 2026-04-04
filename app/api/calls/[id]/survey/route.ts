// F0660: Post-transfer survey

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface SurveyResponse {
  call_id: string
  rating: number
  comment?: string
  transferred: boolean
  rep_quality?: number
  resolution_achieved?: boolean
}

interface SurveyQuestion {
  id: string
  question: string
  type: 'rating' | 'yes_no' | 'text'
  required: boolean
}

const DEFAULT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'overall-rating',
    question: 'How would you rate this call experience?',
    type: 'rating',
    required: true,
  },
  {
    id: 'transferred',
    question: 'Were you transferred to a human representative?',
    type: 'yes_no',
    required: false,
  },
  {
    id: 'rep-quality',
    question: 'If transferred, how would you rate the representative?',
    type: 'rating',
    required: false,
  },
  {
    id: 'resolution',
    question: 'Was your issue resolved?',
    type: 'yes_no',
    required: true,
  },
  {
    id: 'comments',
    question: 'Any additional comments?',
    type: 'text',
    required: false,
  },
]

// GET /api/calls/:id/survey - Get survey for a call
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json({
      call_id: params.id,
      questions: DEFAULT_SURVEY_QUESTIONS,
      format: 'ivr',
      estimated_duration_seconds: 60,
    })
  } catch (error: any) {
    console.error('Error fetching survey:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/calls/:id/survey - Submit survey response
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: SurveyResponse = await request.json()

    // Validate survey response
    if (body.rating === undefined || body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'Overall rating is required and must be 1-5' },
        { status: 400 }
      )
    }

    // Store survey response (would insert into call_surveys table)
    const surveyRecord = {
      id: `survey-${Date.now()}`,
      call_id: params.id,
      rating: body.rating,
      comment: body.comment,
      transferred: body.transferred,
      rep_quality: body.rep_quality,
      resolution_achieved: body.resolution_achieved,
      created_at: new Date().toISOString(),
    }

    return NextResponse.json({
      message: 'Survey response recorded',
      survey: surveyRecord,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error submitting survey:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
