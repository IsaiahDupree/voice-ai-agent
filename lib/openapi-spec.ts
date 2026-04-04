// F0973: OpenAPI spec - Generate OpenAPI 3.0 specification for all API endpoints

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Voice AI Agent API',
    description:
      'Complete API for managing AI phone agents powered by Vapi.ai. Handle inbound/outbound calls, book appointments via Cal.com, manage contacts, and track analytics.',
    version: '1.0.0',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Local development',
    },
    {
      url: 'https://voice-ai-agent.vercel.app/api',
      description: 'Production',
    },
  ],
  tags: [
    { name: 'Calls', description: 'Call management and initiation' },
    { name: 'Contacts', description: 'Contact/CRM management' },
    { name: 'Personas', description: 'AI assistant persona configuration' },
    { name: 'Transcripts', description: 'Call transcripts and analysis' },
    { name: 'Bookings', description: 'Calendar bookings via Cal.com' },
    { name: 'SMS', description: 'SMS follow-ups via Twilio' },
    { name: 'Analytics', description: 'Call analytics and reporting' },
    { name: 'Campaigns', description: 'Outbound calling campaigns' },
    { name: 'Webhooks', description: 'Webhook endpoints for Vapi/Cal.com/Twilio' },
    { name: 'Tools', description: 'Function tools for AI agents' },
    { name: 'Health', description: 'System health and status' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Check system health and connectivity to external services',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    services: {
                      type: 'object',
                      properties: {
                        vapi: { type: 'string', example: 'connected' },
                        supabase: { type: 'string', example: 'connected' },
                        twilio: { type: 'string', example: 'connected' },
                        calcom: { type: 'string', example: 'connected' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/calls': {
      get: {
        tags: ['Calls'],
        summary: 'List calls',
        description: 'Get paginated list of calls with optional filtering and sorting',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Sort' },
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['in-progress', 'completed', 'failed', 'no-answer'] },
          },
          {
            name: 'filter[sentiment]',
            in: 'query',
            schema: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          },
          {
            name: 'filter[duration][gte]',
            in: 'query',
            description: 'Filter calls with duration >= value (seconds)',
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': {
            description: 'List of calls',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Call' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Calls'],
        summary: 'Start call',
        description: 'Initiate an outbound or inbound call',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['assistantId'],
                properties: {
                  assistantId: { type: 'string', description: 'Vapi assistant ID' },
                  phoneNumberId: { type: 'string', description: 'Outbound phone number ID (for outbound calls)' },
                  customerNumber: { type: 'string', description: 'Customer phone number (E.164 format)' },
                  assistantOverrides: {
                    type: 'object',
                    description: 'Per-call assistant configuration overrides',
                  },
                  metadata: {
                    type: 'object',
                    description: 'Custom metadata for the call',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Call initiated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Call' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/calls/{id}': {
      get: {
        tags: ['Calls'],
        summary: 'Get call',
        parameters: [{ $ref: '#/components/parameters/CallId' }],
        responses: {
          '200': {
            description: 'Call details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Call' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/contacts': {
      get: {
        tags: ['Contacts'],
        summary: 'List contacts',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Sort' },
          {
            name: 'filter[opted_out]',
            in: 'query',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': {
            description: 'List of contacts',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Contact' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Contacts'],
        summary: 'Create contact',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ContactInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Contact created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Contact' },
              },
            },
          },
        },
      },
    },
    '/personas': {
      get: {
        tags: ['Personas'],
        summary: 'List personas',
        parameters: [{ $ref: '#/components/parameters/Page' }, { $ref: '#/components/parameters/Limit' }],
        responses: {
          '200': {
            description: 'List of personas',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Persona' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Personas'],
        summary: 'Create persona',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PersonaInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Persona created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Persona' },
              },
            },
          },
        },
      },
    },
    '/transcripts/{callId}': {
      get: {
        tags: ['Transcripts'],
        summary: 'Get transcript',
        parameters: [{ name: 'callId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Transcript details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transcript' },
              },
            },
          },
        },
      },
    },
    '/analytics/overview': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics overview',
        parameters: [
          {
            name: 'start_date',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
          {
            name: 'end_date',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': {
            description: 'Analytics overview',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AnalyticsOverview' },
              },
            },
          },
        },
      },
    },
    '/campaigns': {
      get: {
        tags: ['Campaigns'],
        summary: 'List campaigns',
        responses: {
          '200': {
            description: 'List of campaigns',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Campaign' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Campaigns'],
        summary: 'Create campaign',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CampaignInput' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Campaign created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Campaign' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number (1-indexed)',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Page size (max 100)',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      Sort: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., "created_at:desc" or "-created_at")',
        schema: { type: 'string' },
      },
      CallId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Call ID',
        schema: { type: 'string' },
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
              requestId: { type: 'string' },
              version: { type: 'string' },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  pageSize: { type: 'integer' },
                  totalCount: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      Call: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          vapi_call_id: { type: 'string' },
          status: { type: 'string', enum: ['in-progress', 'completed', 'failed', 'no-answer'] },
          direction: { type: 'string', enum: ['inbound', 'outbound'] },
          caller_number: { type: 'string' },
          customer_number: { type: 'string' },
          duration_seconds: { type: 'integer' },
          recording_url: { type: 'string', format: 'uri' },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          booking_made: { type: 'boolean' },
          transferred: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          ended_at: { type: 'string', format: 'date-time' },
          metadata: { type: 'object' },
        },
      },
      Contact: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          company: { type: 'string' },
          opted_out: { type: 'boolean' },
          last_call_at: { type: 'string', format: 'date-time' },
          total_calls: { type: 'integer' },
          metadata: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      ContactInput: {
        type: 'object',
        required: ['phone'],
        properties: {
          phone: { type: 'string', description: 'E.164 format (e.g., +14155551234)' },
          email: { type: 'string', format: 'email' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          company: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      Persona: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          vapi_assistant_id: { type: 'string' },
          voice_id: { type: 'string' },
          system_prompt: { type: 'string' },
          first_message: { type: 'string' },
          model: { type: 'string' },
          tools: { type: 'array', items: { type: 'object' } },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      PersonaInput: {
        type: 'object',
        required: ['name', 'voice_id', 'system_prompt'],
        properties: {
          name: { type: 'string' },
          voice_id: { type: 'string' },
          system_prompt: { type: 'string' },
          first_message: { type: 'string' },
          model: { type: 'string', default: 'gpt-4o' },
          tools: { type: 'array', items: { type: 'object' } },
        },
      },
      Transcript: {
        type: 'object',
        properties: {
          call_id: { type: 'string' },
          transcript_text: { type: 'string' },
          segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                speaker: { type: 'string', enum: ['agent', 'user'] },
                text: { type: 'string' },
                timestamp: { type: 'number' },
              },
            },
          },
          summary: { type: 'string' },
          action_items: { type: 'array', items: { type: 'string' } },
          keywords: { type: 'array', items: { type: 'string' } },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AnalyticsOverview: {
        type: 'object',
        properties: {
          total_calls: { type: 'integer' },
          completed_calls: { type: 'integer' },
          answer_rate: { type: 'number' },
          avg_duration: { type: 'number' },
          bookings_made: { type: 'integer' },
          booking_rate: { type: 'number' },
          sentiment_breakdown: {
            type: 'object',
            properties: {
              positive: { type: 'integer' },
              neutral: { type: 'integer' },
              negative: { type: 'integer' },
            },
          },
        },
      },
      Campaign: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'scheduled', 'running', 'paused', 'completed'] },
          assistant_id: { type: 'string' },
          total_contacts: { type: 'integer' },
          calls_made: { type: 'integer' },
          start_time: { type: 'string', format: 'date-time' },
          end_time: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      CampaignInput: {
        type: 'object',
        required: ['name', 'assistant_id', 'contact_list'],
        properties: {
          name: { type: 'string' },
          assistant_id: { type: 'string' },
          contact_list: { type: 'array', items: { type: 'string' } },
          start_time: { type: 'string', format: 'date-time' },
          end_time: { type: 'string', format: 'date-time' },
          calling_hours: {
            type: 'object',
            properties: {
              start_hour: { type: 'integer', minimum: 0, maximum: 23 },
              end_hour: { type: 'integer', minimum: 0, maximum: 23 },
            },
          },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'BAD_REQUEST' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean', example: false },
                error: {
                  type: 'object',
                  properties: {
                    code: { type: 'string', example: 'NOT_FOUND' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication',
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
}
