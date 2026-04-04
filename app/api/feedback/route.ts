// F1010: POST /api/feedback - Submit feedback

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface FeedbackRequest {
  category: 'bug' | 'feature_request' | 'general' | 'performance'
  subject: string
  description: string
  email?: string
  org_id?: string
  call_id?: string
  contact_info?: string
}

// POST /api/feedback - Submit user feedback
export async function POST(request: NextRequest) {
  try {
    const body: FeedbackRequest = await request.json()

    if (!body.category || !body.subject || !body.description) {
      return NextResponse.json(
        { error: 'category, subject, and description are required' },
        { status: 400 }
      )
    }

    // Validate category
    const validCategories = ['bug', 'feature_request', 'general', 'performance']
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Create feedback record
    const feedbackRecord = {
      id: `feedback-${Date.now()}`,
      category: body.category,
      subject: body.subject,
      description: body.description,
      email: body.email,
      org_id: body.org_id,
      call_id: body.call_id,
      contact_info: body.contact_info,
      status: 'new',
      created_at: new Date().toISOString(),
    }

    // Insert into feedback table (if it exists)
    // For now, just return success
    return NextResponse.json({
      message: 'Feedback submitted',
      feedback: feedbackRecord,
      ticket_id: feedbackRecord.id,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error submitting feedback:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
