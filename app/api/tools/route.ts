import { NextRequest, NextResponse } from 'next/server'
import { allFunctionTools, exportToolDefinitions } from '@/lib/function-tools'

// F1419: Tool documentation endpoint
// GET /api/tools returns all tool definitions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'

    if (format === 'json') {
      // Return structured JSON
      return NextResponse.json({
        tools: allFunctionTools.map(tool => ({
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
          async: tool.async ?? false,
          messages: tool.messages || [],
        })),
        count: allFunctionTools.length,
      })
    }

    if (format === 'openapi') {
      // Return OpenAPI-style schema
      const openApiTools = allFunctionTools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: {
          ...tool.function.parameters,
          additionalProperties: false,
        },
      }))

      return NextResponse.json({
        openapi: '3.0.0',
        info: {
          title: 'Voice AI Agent Function Tools',
          version: '1.0.0',
        },
        paths: {},
        components: {
          schemas: {
            tools: openApiTools,
          },
        },
      })
    }

    // Default: return plain text documentation
    const toolsText = exportToolDefinitions(allFunctionTools)

    return new NextResponse(toolsText, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  } catch (error: any) {
    console.error('Error fetching tools:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tools' },
      { status: 500 }
    )
  }
}
