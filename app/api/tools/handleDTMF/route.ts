/**
 * POST /api/tools/handleDTMF
 *
 * Vapi function tool for handling DTMF (keypad) input
 * Processes keypresses and returns next action for the call
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DTMFRouter, DTMFMenu } from '@/lib/dtmf-router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HandleDTMFRequest {
  message: {
    type: 'function-call';
    functionCall: {
      name: 'handleDTMF';
      parameters: {
        menu_id: string;
        keypress: string;
        session_state?: string; // JSON string of DTMFSessionState
        tenant_id?: string;
      };
    };
  };
}

/**
 * POST /api/tools/handleDTMF
 * Handle DTMF keypress from Vapi
 */
export async function POST(request: NextRequest) {
  try {
    const body: HandleDTMFRequest = await request.json();
    const params = body.message?.functionCall?.parameters;

    if (!params || !params.menu_id || !params.keypress) {
      return NextResponse.json({
        results: [
          {
            type: 'error',
            error: 'Missing required parameters: menu_id and keypress',
          },
        ],
      });
    }

    const { menu_id, keypress, session_state, tenant_id = 'default' } = params;

    // Load menu configuration from database
    const { data: menu, error: menuError } = await supabase
      .from('dtmf_menus')
      .select('*')
      .eq('id', menu_id)
      .eq('tenant_id', tenant_id)
      .eq('active', true)
      .maybeSingle();

    if (menuError || !menu) {
      console.error('[handleDTMF] Menu not found:', menuError);
      return NextResponse.json({
        results: [
          {
            type: 'error',
            error: `DTMF menu ${menu_id} not found or inactive`,
          },
        ],
      });
    }

    // Initialize router
    const router = new DTMFRouter(
      menu as DTMFMenu,
      session_state ? JSON.parse(session_state) : undefined
    );

    // Process keypress
    const result = router.processKeypress(keypress);

    // Build response based on action type
    let response: unknown;

    if (!result.valid) {
      // Invalid keypress - return error message
      response = {
        type: 'speak',
        message: result.message,
        session_state: JSON.stringify(result.state),
      };
    } else if (result.action) {
      switch (result.action.action) {
        case 'transfer':
          response = {
            type: 'transfer',
            destination: result.action.destination,
            message: result.message,
            session_state: JSON.stringify(result.state),
          };
          break;

        case 'collect_input':
          response = {
            type: 'collect_input',
            input_type: result.action.type,
            length: result.action.length,
            min_length: result.action.min_length,
            max_length: result.action.max_length,
            message: result.message,
            session_state: JSON.stringify(result.state),
          };
          break;

        case 'end_call':
          response = {
            type: 'end_call',
            message: result.message,
            session_state: JSON.stringify(result.state),
          };
          break;

        case 'webhook':
          response = {
            type: 'webhook',
            url: result.action.destination,
            message: result.message,
            session_state: JSON.stringify(result.state),
          };
          break;

        case 'menu':
          // Navigation to submenu - speak the new menu message
          response = {
            type: 'speak',
            message: result.message,
            session_state: JSON.stringify(result.state),
          };
          break;

        default:
          response = {
            type: 'error',
            error: `Unknown action type: ${result.action.action}`,
          };
      }
    } else {
      response = {
        type: 'speak',
        message: result.message,
        session_state: JSON.stringify(result.state),
      };
    }

    return NextResponse.json({
      results: [response],
    });
  } catch (error: unknown) {
    console.error('[/api/tools/handleDTMF] Error:', error);
    return NextResponse.json({
      results: [
        {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error processing DTMF',
        },
      ],
    });
  }
}

/**
 * GET /api/tools/handleDTMF
 * Return tool definition for Vapi
 */
export async function GET() {
  return NextResponse.json({
    type: 'function',
    function: {
      name: 'handleDTMF',
      description: 'Process DTMF (keypad) input and navigate interactive voice menus',
      parameters: {
        type: 'object',
        properties: {
          menu_id: {
            type: 'string',
            description: 'ID of the DTMF menu configuration to use',
          },
          keypress: {
            type: 'string',
            description: 'The key pressed by the caller (0-9, *, or #)',
            pattern: '^[0-9*#]$',
          },
          session_state: {
            type: 'string',
            description: 'JSON string of current session state (optional, for multi-step navigation)',
          },
          tenant_id: {
            type: 'string',
            description: 'Tenant ID (defaults to "default")',
          },
        },
        required: ['menu_id', 'keypress'],
      },
    },
    examples: [
      {
        menu_id: '1',
        keypress: '1',
        tenant_id: 'default',
      },
    ],
  });
}
