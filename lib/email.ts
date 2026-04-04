// F0859, F0860, F0323: Email utilities for automated reports and notifications

import { Resend } from 'resend'

let resendInstance: Resend | null = null

function getResendClient(): Resend {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY)
  }
  return resendInstance
}

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

/**
 * Send an email using Resend
 */
export async function sendEmail({ to, subject, html, from }: EmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not set - email not sent')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const resend = getResendClient()
    const result = await resend.emails.send({
      from: from || process.env.EMAIL_FROM || 'Voice AI Agent <noreply@voiceaiagent.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    console.log('✅ Email sent:', result)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('❌ Email send failed:', error)
    return { success: false, error: error.message }
  }
}

/**
 * F0859: Format daily analytics report email
 */
export function formatDailyReport(analytics: {
  date: string
  totalCalls: number
  answeredCalls: number
  avgDuration: number
  avgSentiment: number
  bookingsCreated: number
  smssSent: number
  topCampaign?: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .metric-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 32px; font-weight: bold; color: #667eea; margin: 10px 0; }
    .metric-label { font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Daily Voice AI Report</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${analytics.date}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Key Metrics</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Total Calls</div>
          <div class="metric-value">${analytics.totalCalls}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Answer Rate</div>
          <div class="metric-value">${analytics.totalCalls > 0 ? Math.round((analytics.answeredCalls / analytics.totalCalls) * 100) : 0}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Duration</div>
          <div class="metric-value">${Math.round(analytics.avgDuration / 60)}m</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Sentiment</div>
          <div class="metric-value">${analytics.avgSentiment.toFixed(1)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Bookings</div>
          <div class="metric-value">${analytics.bookingsCreated}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">SMS Sent</div>
          <div class="metric-value">${analytics.smssSent}</div>
        </div>
      </div>
      ${
        analytics.topCampaign
          ? `<p style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px;">
               <strong>🏆 Top Campaign:</strong> ${analytics.topCampaign}
             </p>`
          : ''
      }
      <p style="margin-top: 30px; text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard"
           style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View Full Dashboard
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Voice AI Agent | Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * F0860: Format weekly analytics report email
 */
export function formatWeeklyReport(analytics: {
  weekStart: string
  weekEnd: string
  totalCalls: number
  answeredCalls: number
  avgDuration: number
  avgSentiment: number
  bookingsCreated: number
  smssSent: number
  topCampaigns: Array<{ name: string; calls: number }>
  dailyBreakdown: Array<{ date: string; calls: number }>
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 20px 0; }
    .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
    .metric-value { font-size: 28px; font-weight: bold; color: #667eea; margin: 8px 0; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .section { margin: 30px 0; }
    .campaign-list { list-style: none; padding: 0; }
    .campaign-item { background: #f8f9fa; padding: 12px; margin: 8px 0; border-radius: 6px; display: flex; justify-content: space-between; }
    .daily-chart { display: flex; align-items: flex-end; justify-content: space-between; height: 100px; margin: 20px 0; }
    .day-bar { flex: 1; margin: 0 2px; background: #667eea; border-radius: 4px 4px 0 0; display: flex; flex-direction: column; justify-content: flex-end; text-align: center; }
    .day-label { font-size: 10px; color: #666; margin-top: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 Weekly Voice AI Report</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">${analytics.weekStart} - ${analytics.weekEnd}</p>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Week Summary</h2>
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-label">Total Calls</div>
          <div class="metric-value">${analytics.totalCalls}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Answer Rate</div>
          <div class="metric-value">${analytics.totalCalls > 0 ? Math.round((analytics.answeredCalls / analytics.totalCalls) * 100) : 0}%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Sentiment</div>
          <div class="metric-value">${analytics.avgSentiment.toFixed(1)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Bookings</div>
          <div class="metric-value">${analytics.bookingsCreated}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">SMS Sent</div>
          <div class="metric-value">${analytics.smssSent}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Duration</div>
          <div class="metric-value">${Math.round(analytics.avgDuration / 60)}m</div>
        </div>
      </div>

      <div class="section">
        <h3>Daily Activity</h3>
        <div class="daily-chart">
          ${analytics.dailyBreakdown
            .map((day) => {
              const maxCalls = Math.max(...analytics.dailyBreakdown.map((d) => d.calls))
              const height = maxCalls > 0 ? (day.calls / maxCalls) * 100 : 0
              return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                  <div class="day-bar" style="height: ${height}%; min-height: 20px; width: 80%;">
                    <span style="color: white; font-size: 11px; padding: 2px;">${day.calls}</span>
                  </div>
                  <div class="day-label">${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                </div>
              `
            })
            .join('')}
        </div>
      </div>

      ${
        analytics.topCampaigns.length > 0
          ? `
        <div class="section">
          <h3>Top Campaigns</h3>
          <ul class="campaign-list">
            ${analytics.topCampaigns
              .slice(0, 5)
              .map(
                (campaign, index) => `
              <li class="campaign-item">
                <span><strong>#${index + 1}</strong> ${campaign.name}</span>
                <span style="color: #667eea; font-weight: bold;">${campaign.calls} calls</span>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      `
          : ''
      }

      <p style="margin-top: 30px; text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard"
           style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View Full Dashboard
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Voice AI Agent | Generated at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `
}

/**
 * F0323: Format booking created notification email
 */
export function formatBookingNotification(booking: {
  contactName: string
  contactPhone: string
  eventType: string
  startTime: string
  endTime: string
  calendarLink?: string
  notes?: string
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .info-row { padding: 15px; margin: 10px 0; background: #f8f9fa; border-left: 4px solid #10b981; border-radius: 4px; }
    .label { font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
    .value { font-size: 16px; color: #333; margin-top: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ New Booking Created</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">AI Agent successfully scheduled an appointment</p>
    </div>
    <div class="content">
      <div class="info-row">
        <div class="label">Contact</div>
        <div class="value">${booking.contactName}</div>
        <div class="value" style="color: #667eea; font-size: 14px;">${booking.contactPhone}</div>
      </div>
      <div class="info-row">
        <div class="label">Event Type</div>
        <div class="value">${booking.eventType}</div>
      </div>
      <div class="info-row">
        <div class="label">Scheduled Time</div>
        <div class="value">${new Date(booking.startTime).toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })}</div>
        <div class="value" style="font-size: 14px; color: #666;">Duration: ${Math.round((new Date(booking.endTime).getTime() - new Date(booking.startTime).getTime()) / 60000)} minutes</div>
      </div>
      ${
        booking.notes
          ? `
        <div class="info-row">
          <div class="label">Notes</div>
          <div class="value">${booking.notes}</div>
        </div>
      `
          : ''
      }
      <p style="margin-top: 30px; text-align: center;">
        ${
          booking.calendarLink
            ? `<a href="${booking.calendarLink}"
             style="display: inline-block; background: #10b981; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-right: 10px;">
            View in Calendar
          </a>`
            : ''
        }
        <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard"
           style="display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View Dashboard
        </a>
      </p>
    </div>
    <div class="footer">
      <p>Voice AI Agent | Booked at ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>
  `
}
