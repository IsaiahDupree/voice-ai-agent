// F0873: SMS analytics by template - delivery rate, click rate per template

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'

interface TemplateStats {
  templateId: string
  templateName: string
  sentCount: number
  deliveredCount: number
  deliveryRate: number
  clickCount: number
  clickRate: number
  replyCount: number
  replyRate: number
  avgSentimentScore: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const templateId = searchParams.get('template_id')

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_sms_messages')
      .select('template_id, status, clicked, replied, sentiment_score, created_at')

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }
    if (templateId) {
      query = query.eq('template_id', templateId)
    }

    const { data: messages, error: messagesError } = await query

    if (messagesError) {
      throw messagesError
    }

    if (!messages || messages.length === 0) {
      return apiSuccess({
        templateStats: [],
        summary: {
          totalSent: 0,
          overallDeliveryRate: 0,
          bestPerformingTemplate: null,
        },
        filters: {
          start_date: startDate,
          end_date: endDate,
          template_id: templateId,
        },
      })
    }

    // Get template names
    const templateIds = Array.from(new Set(messages.map(m => m.template_id).filter(Boolean)))
    const { data: templates } = await supabaseAdmin
      .from('voice_agent_sms_templates')
      .select('id, name')
      .in('id', templateIds)

    const templateNameMap = new Map(
      templates?.map((t: any) => [t.id, t.name]) || []
    )

    // Group by template
    const templateMap = new Map<string, any>()

    messages.forEach((msg: any) => {
      const tid = msg.template_id || 'no-template'
      if (!templateMap.has(tid)) {
        templateMap.set(tid, {
          sentCount: 0,
          deliveredCount: 0,
          clickCount: 0,
          replyCount: 0,
          sentimentScores: [] as number[],
        })
      }

      const data = templateMap.get(tid)!
      data.sentCount++

      if (msg.status === 'delivered') {
        data.deliveredCount++
      }
      if (msg.clicked) {
        data.clickCount++
      }
      if (msg.replied) {
        data.replyCount++
      }
      if (msg.sentiment_score !== null) {
        data.sentimentScores.push(msg.sentiment_score)
      }
    })

    // Build template stats
    const templateStats: TemplateStats[] = Array.from(templateMap.entries()).map(([tid, data]) => {
      const avgSentiment =
        data.sentimentScores.length > 0
          ? data.sentimentScores.reduce((sum: number, s: number) => sum + s, 0) / data.sentimentScores.length
          : 0

      return {
        templateId: tid,
        templateName: templateNameMap.get(tid) || tid,
        sentCount: data.sentCount,
        deliveredCount: data.deliveredCount,
        deliveryRate: data.sentCount > 0 ? (data.deliveredCount / data.sentCount) * 100 : 0,
        clickCount: data.clickCount,
        clickRate: data.deliveredCount > 0 ? (data.clickCount / data.deliveredCount) * 100 : 0,
        replyCount: data.replyCount,
        replyRate: data.deliveredCount > 0 ? (data.replyCount / data.deliveredCount) * 100 : 0,
        avgSentimentScore: Math.round(avgSentiment * 100) / 100,
      }
    })

    // Sort by click rate
    templateStats.sort((a, b) => b.clickRate - a.clickRate)

    // Summary
    const totalSent = messages.length
    const totalDelivered = messages.filter((m: any) => m.status === 'delivered').length
    const overallDeliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0
    const bestTemplate = templateStats[0]

    return apiSuccess({
      templateStats,
      summary: {
        totalSent,
        totalDelivered,
        overallDeliveryRate: Math.round(overallDeliveryRate * 100) / 100,
        bestPerformingTemplate: bestTemplate
          ? {
              templateId: bestTemplate.templateId,
              templateName: bestTemplate.templateName,
              clickRate: bestTemplate.clickRate,
            }
          : null,
      },
      filters: {
        start_date: startDate,
        end_date: endDate,
        template_id: templateId,
      },
    })
  } catch (error: any) {
    console.error('SMS template analytics error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get SMS template analytics: ${error.message}`,
      500
    )
  }
}
