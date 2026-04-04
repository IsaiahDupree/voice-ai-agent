// F0563: SMS unsubscribe page - landing page for SMS unsubscribe confirmation

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/sms/unsubscribe?phone=+1234567890
 * F0563: Display unsubscribe confirmation page
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const phone = searchParams.get('phone')

  if (!phone) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMS Unsubscribe</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              margin-top: 0;
            }
            .error {
              color: #d32f2f;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>SMS Unsubscribe</h1>
            <p class="error">Invalid unsubscribe link. Please use the link from your SMS message.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }

  // Check if already unsubscribed
  const { data: existing } = await supabaseAdmin
    .from('voice_agent_sms_unsubscribes')
    .select('created_at')
    .eq('phone', phone)
    .single()

  if (existing) {
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Already Unsubscribed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              margin-top: 0;
            }
            .success {
              color: #388e3c;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Already Unsubscribed</h1>
            <p class="success">You are already unsubscribed from SMS messages.</p>
            <p>Your phone number (${phone}) was removed from our SMS list on ${new Date(existing.created_at).toLocaleDateString()}.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }

  // Show confirmation form
  return new NextResponse(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Unsubscribe from SMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .card {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            color: #333;
            margin-top: 0;
          }
          button {
            background: #d32f2f;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
          }
          button:hover {
            background: #b71c1c;
          }
          .cancel {
            background: #757575;
            margin-top: 10px;
          }
          .cancel:hover {
            background: #616161;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Unsubscribe from SMS</h1>
          <p>Are you sure you want to unsubscribe from SMS messages?</p>
          <p><strong>Phone number:</strong> ${phone}</p>
          <p>You will no longer receive any SMS messages from us.</p>

          <form method="POST" action="/api/sms/unsubscribe">
            <input type="hidden" name="phone" value="${phone}" />
            <input type="hidden" name="reason" value="user_request" />
            <button type="submit">Yes, Unsubscribe Me</button>
          </form>

          <button class="cancel" onclick="window.close()">Cancel</button>
        </div>
      </body>
    </html>
    `,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    }
  )
}

/**
 * POST /api/sms/unsubscribe
 * F0563: Process unsubscribe request and update database
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const phone = formData.get('phone') as string
    const reason = formData.get('reason') as string

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 })
    }

    // Add to unsubscribe list
    const { error: unsubError } = await supabaseAdmin
      .from('voice_agent_sms_unsubscribes')
      .insert({
        phone,
        reason: reason || 'user_request',
        source: 'web',
      })

    if (unsubError && unsubError.code !== '23505') {
      // Ignore duplicate key errors
      console.error('[SMS Unsubscribe] Error:', unsubError)
      throw unsubError
    }

    // Update contact opt-out flag
    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({ opt_out_sms: true })
      .eq('phone', phone)

    // Return success page
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              margin-top: 0;
            }
            .success {
              color: #388e3c;
              font-size: 18px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Successfully Unsubscribed</h1>
            <p class="success">✓ You have been removed from our SMS list.</p>
            <p>Phone number: ${phone}</p>
            <p>You will no longer receive SMS messages from us.</p>
            <p><small>If you received this in error, please contact us.</small></p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  } catch (error: any) {
    console.error('[SMS Unsubscribe] Error processing:', error)

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            .card {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              margin-top: 0;
            }
            .error {
              color: #d32f2f;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Error</h1>
            <p class="error">An error occurred while processing your request. Please try again later.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }
}
