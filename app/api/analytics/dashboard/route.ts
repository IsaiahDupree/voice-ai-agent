// F0877: Analytics dashboard widgets

import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({
      widgets: [
        { id: 'calls', title: 'Total Calls', type: 'metric', value: 0 },
        { id: 'conversion', title: 'Conversion Rate', type: 'metric', value: 0 },
        { id: 'duration', title: 'Avg Call Duration', type: 'metric', value: 0 },
        { id: 'sentiment', title: 'Avg Sentiment', type: 'gauge', value: 0 },
        { id: 'timeline', title: 'Calls Over Time', type: 'chart', data: [] },
        { id: 'top_campaigns', title: 'Top Campaigns', type: 'table', data: [] },
      ],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
