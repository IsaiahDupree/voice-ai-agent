// F0973: OpenAPI spec
import { NextResponse } from 'next/server'

export async function GET() {
  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Voice AI Agent API',
      version: '1.0.0',
      description: 'Complete API for AI-powered phone agent system with real-time calling, booking, and CRM integration',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      }
    ],
    paths: {
      '/api/health': {
        get: {
          summary: 'Health Check',
          description: 'Check API health and integration status (Vapi, Supabase, Twilio, Cal.com)',
          tags: ['System'],
          responses: {
            '200': {
              description: 'Health status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', enum: ['healthy', 'degraded'] },
                      timestamp: { type: 'string', format: 'date-time' },
                      checks: {
                        type: 'object',
                        properties: {
                          vapi: { $ref: '#/components/schemas/HealthCheck' },
                          supabase: { $ref: '#/components/schemas/HealthCheck' },
                          twilio: { $ref: '#/components/schemas/HealthCheck' },
                          calcom: { $ref: '#/components/schemas/HealthCheck' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/calls': {
        get: {
          summary: 'List Calls',
          description: 'Get paginated list of all calls',
          tags: ['Calls'],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['in-progress', 'completed', 'failed'] } }
          ],
          responses: {
            '200': {
              description: 'List of calls',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      calls: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Call' }
                      },
                      total: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/calls/{id}': {
        get: {
          summary: 'Get Call',
          description: 'Get call details by ID',
          tags: ['Calls'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
          ],
          responses: {
            '200': {
              description: 'Call details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Call' }
                }
              }
            },
            '404': {
              description: 'Call not found'
            }
          }
        }
      },
      '/api/calls/outbound': {
        post: {
          summary: 'Start Outbound Call',
          description: 'Initiate an outbound call using Vapi',
          tags: ['Calls'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phoneNumber', 'assistantId'],
                  properties: {
                    phoneNumber: { type: 'string', pattern: '^\\+[1-9]\\d{1,14}$' },
                    assistantId: { type: 'string', format: 'uuid' },
                    customData: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Call initiated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      callId: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/campaigns': {
        get: {
          summary: 'List Campaigns',
          description: 'Get all outbound campaigns',
          tags: ['Campaigns'],
          responses: {
            '200': {
              description: 'List of campaigns',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Campaign' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create Campaign',
          description: 'Create new outbound call campaign',
          tags: ['Campaigns'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'assistantId', 'contacts'],
                  properties: {
                    name: { type: 'string' },
                    assistantId: { type: 'string' },
                    contacts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          phoneNumber: { type: 'string' },
                          metadata: { type: 'object' }
                        }
                      }
                    },
                    schedule: { $ref: '#/components/schemas/Schedule' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Campaign created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Campaign' }
                }
              }
            }
          }
        }
      },
      '/api/campaigns/{id}/start': {
        post: {
          summary: 'Start Campaign',
          description: 'Start an outbound campaign',
          tags: ['Campaigns'],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
          ],
          responses: {
            '200': {
              description: 'Campaign started'
            }
          }
        }
      },
      '/api/contacts': {
        get: {
          summary: 'List Contacts',
          description: 'Get all CRM contacts',
          tags: ['CRM'],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'search', in: 'query', schema: { type: 'string' } }
          ],
          responses: {
            '200': {
              description: 'List of contacts',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Contact' }
                  }
                }
              }
            }
          }
        },
        post: {
          summary: 'Create Contact',
          description: 'Add new contact to CRM',
          tags: ['CRM'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phoneNumber'],
                  properties: {
                    phoneNumber: { type: 'string' },
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    metadata: { type: 'object' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Contact created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Contact' }
                }
              }
            }
          }
        }
      },
      '/api/personas': {
        get: {
          summary: 'List Personas',
          description: 'Get all AI agent personas',
          tags: ['Personas'],
          responses: {
            '200': {
              description: 'List of personas',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Persona' }
                  }
                }
              }
            }
          }
        }
      },
      '/api/analytics/stats': {
        get: {
          summary: 'Get Analytics',
          description: 'Get analytics summary with date range',
          tags: ['Analytics'],
          parameters: [
            { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } }
          ],
          responses: {
            '200': {
              description: 'Analytics summary',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Analytics' }
                }
              }
            }
          }
        }
      },
      '/api/analytics/export/pdf': {
        get: {
          summary: 'Export Analytics PDF',
          description: 'Download analytics report as PDF',
          tags: ['Analytics'],
          parameters: [
            { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } },
            { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } }
          ],
          responses: {
            '200': {
              description: 'PDF report',
              content: {
                'application/pdf': {
                  schema: {
                    type: 'string',
                    format: 'binary'
                  }
                }
              }
            }
          }
        }
      },
      '/api/sms/send': {
        post: {
          summary: 'Send SMS',
          description: 'Send SMS via Twilio',
          tags: ['SMS'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to', 'body'],
                  properties: {
                    to: { type: 'string' },
                    body: { type: 'string' },
                    from: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'SMS sent',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      messageSid: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/cal/availability': {
        get: {
          summary: 'Check Availability',
          description: 'Get available time slots from Cal.com',
          tags: ['Calendar'],
          parameters: [
            { name: 'eventTypeId', in: 'query', required: true, schema: { type: 'string' } },
            { name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
          ],
          responses: {
            '200': {
              description: 'Available slots',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        time: { type: 'string', format: 'date-time' },
                        available: { type: 'boolean' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/tools/bookAppointment': {
        post: {
          summary: 'Book Appointment',
          description: 'Book appointment via Cal.com (called by Vapi function tool)',
          tags: ['Calendar'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['eventTypeId', 'start', 'responses'],
                  properties: {
                    eventTypeId: { type: 'string' },
                    start: { type: 'string', format: 'date-time' },
                    responses: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Booking created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      bookingId: { type: 'string' },
                      status: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      schemas: {
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['ok', 'error'] },
            message: { type: 'string' }
          }
        },
        Call: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phoneNumber: { type: 'string' },
            assistantId: { type: 'string' },
            status: { type: 'string', enum: ['in-progress', 'completed', 'failed'] },
            outcome: { type: 'string', enum: ['success', 'failed', 'no-answer'] },
            duration: { type: 'integer', description: 'Duration in seconds' },
            sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
            transcript: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            completedAt: { type: 'string', format: 'date-time' }
          }
        },
        Campaign: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            assistantId: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'running', 'paused', 'completed'] },
            totalContacts: { type: 'integer' },
            called: { type: 'integer' },
            connected: { type: 'integer' },
            booked: { type: 'integer' },
            schedule: { $ref: '#/components/schemas/Schedule' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Schedule: {
          type: 'object',
          properties: {
            startTime: { type: 'string', description: 'HH:MM format' },
            endTime: { type: 'string', description: 'HH:MM format' },
            timezone: { type: 'string' },
            daysOfWeek: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 }
            }
          }
        },
        Contact: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phoneNumber: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            metadata: { type: 'object' },
            lastCalled: { type: 'string', format: 'date-time' },
            totalCalls: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Persona: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            voice: { type: 'string', description: 'ElevenLabs voice ID' },
            firstMessage: { type: 'string' },
            systemPrompt: { type: 'string' },
            model: { type: 'string', enum: ['gpt-4o', 'claude-3-5-sonnet'] }
          }
        },
        Analytics: {
          type: 'object',
          properties: {
            totalCalls: { type: 'integer' },
            totalBookings: { type: 'integer' },
            conversionRate: { type: 'number' },
            avgDuration: { type: 'number' },
            activeCalls: { type: 'integer' },
            sentimentBreakdown: {
              type: 'object',
              properties: {
                positive: { type: 'integer' },
                neutral: { type: 'integer' },
                negative: { type: 'integer' }
              }
            }
          }
        }
      }
    },
    tags: [
      { name: 'System', description: 'System health and monitoring' },
      { name: 'Calls', description: 'Call management and history' },
      { name: 'Campaigns', description: 'Outbound call campaigns' },
      { name: 'CRM', description: 'Contact management' },
      { name: 'Personas', description: 'AI agent persona configuration' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'SMS', description: 'SMS messaging' },
      { name: 'Calendar', description: 'Calendar and booking management' }
    ]
  }

  return NextResponse.json(openApiSpec, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
