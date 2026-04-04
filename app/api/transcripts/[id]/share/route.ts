// F0499: Transcript sharing link - Generate shareable link for transcript

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transcriptId = parseInt(params.id)
    const body = await request.json()
    const { expires_in_days = 7, password_protected = false } = body

    // Verify transcript exists
    const { data: transcript, error: transcriptError } = await supabaseAdmin
      .from('transcripts')
      .select('id')
      .eq('id', transcriptId)
      .single()

    if (transcriptError || !transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      )
    }

    // Generate share token
    const shareToken = randomBytes(32).toString('hex')

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_in_days)

    // Optional password protection
    let password = null
    if (password_protected) {
      password = randomBytes(8).toString('hex')
    }

    // Store share link
    const { data: shareLink, error } = await supabaseAdmin
      .from('transcript_shares')
      .insert({
        transcript_id: transcriptId,
        share_token: shareToken,
        password,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/transcript/${shareToken}`

    return NextResponse.json({
      success: true,
      share_url: shareUrl,
      share_token: shareToken,
      expires_at: expiresAt.toISOString(),
      password: password || undefined,
    })
  } catch (error: any) {
    console.error('Error creating share link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create share link' },
      { status: 500 }
    )
  }
}

// Get share link info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transcriptId = parseInt(params.id)

    // Get active share links for this transcript
    const { data: shareLinks, error } = await supabaseAdmin
      .from('transcript_shares')
      .select('*')
      .eq('transcript_id', transcriptId)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      share_links: shareLinks?.map(link => ({
        share_url: `${process.env.NEXT_PUBLIC_APP_URL}/share/transcript/${link.share_token}`,
        expires_at: link.expires_at,
        password_protected: !!link.password,
        created_at: link.created_at,
      })) || [],
    })
  } catch (error: any) {
    console.error('Error getting share links:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get share links' },
      { status: 500 }
    )
  }
}
