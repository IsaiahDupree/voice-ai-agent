/**
 * POST /api/language/detect
 *
 * Detect language from transcript snippet
 * Used for testing and by Vapi webhook to determine if language switch needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectLanguage, detectLanguageBatch, isSupportedLanguage } from '@/lib/language-detector';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, chunks, confidenceThreshold, currentLanguage } = body;

    // Validate input
    if (!text && (!chunks || !Array.isArray(chunks))) {
      return NextResponse.json(
        {
          error: 'Missing required field: text or chunks',
          success: false,
        },
        { status: 400 }
      );
    }

    // Validate confidence threshold if provided
    const threshold = confidenceThreshold !== undefined ? Number(confidenceThreshold) : 80;
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      return NextResponse.json(
        {
          error: 'confidenceThreshold must be a number between 0 and 100',
          success: false,
        },
        { status: 400 }
      );
    }

    // Validate current language if provided
    const current = currentLanguage || 'en';
    if (!isSupportedLanguage(current)) {
      return NextResponse.json(
        {
          error: `Unsupported language code: ${current}. Supported: en, es, fr, de, pt, zh, hi, ja`,
          success: false,
        },
        { status: 400 }
      );
    }

    // Detect language
    let result;
    if (chunks && Array.isArray(chunks)) {
      result = await detectLanguageBatch(chunks, threshold, current);
    } else {
      result = await detectLanguage(text, threshold, current);
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        threshold,
        currentLanguage: current,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('[/api/language/detect] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: 'Language detection failed',
        details: errorMessage,
        success: false,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/language/detect
 * Health check for language detection service
 */
export async function GET() {
  try {
    // Test detection with simple English phrase
    const testResult = await detectLanguage('Hello, how are you?', 80, 'en');

    return NextResponse.json({
      status: 'healthy',
      service: 'language-detection',
      supportedLanguages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ja'],
      test: {
        input: 'Hello, how are you?',
        detected: testResult.language,
        confidence: testResult.confidence,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[/api/language/detect] Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'language-detection',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
