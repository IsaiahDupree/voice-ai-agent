// F0973: OpenAPI spec endpoint - serves OpenAPI 3.0 specification as JSON

import { NextResponse } from 'next/server'
import { openApiSpec } from '@/lib/openapi-spec'

export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Allow Swagger UI from anywhere
    },
  })
}
