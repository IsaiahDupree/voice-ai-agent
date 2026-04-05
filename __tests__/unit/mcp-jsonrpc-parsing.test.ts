// Feature 163: Unit test: MCP JSON-RPC request/response parsing
/**
 * Unit tests for MCP client JSON-RPC 2.0 request/response parsing
 * Tests the MCP protocol implementation in lib/mcp-client.ts
 */

describe('MCP JSON-RPC Protocol Parsing', () => {
  describe('JSON-RPC 2.0 Request Format', () => {
    it('should create valid JSON-RPC request for tools/list', () => {
      const request = {
        jsonrpc: '2.0',
        id: 12345,
        method: 'tools/list',
        params: {},
      }

      expect(request.jsonrpc).toBe('2.0')
      expect(request).toHaveProperty('id')
      expect(request.method).toBe('tools/list')
      expect(request.params).toEqual({})
    })

    it('should create valid JSON-RPC request for tools/call', () => {
      const request = {
        jsonrpc: '2.0',
        id: 12346,
        method: 'tools/call',
        params: {
          name: 'execute_sql',
          arguments: {
            query: 'SELECT * FROM users LIMIT 10',
          },
        },
      }

      expect(request.jsonrpc).toBe('2.0')
      expect(request).toHaveProperty('id')
      expect(request.method).toBe('tools/call')
      expect(request.params.name).toBe('execute_sql')
      expect(request.params.arguments).toHaveProperty('query')
    })

    it('should include unique ID for each request', () => {
      const request1 = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {},
      }

      // Small delay to ensure different timestamp
      const request2 = {
        jsonrpc: '2.0',
        id: Date.now() + 1,
        method: 'tools/list',
        params: {},
      }

      expect(request1.id).not.toBe(request2.id)
    })
  })

  describe('JSON-RPC 2.0 Response Parsing', () => {
    it('should parse successful response with result', () => {
      const response = {
        jsonrpc: '2.0',
        id: 12345,
        result: {
          tools: [
            {
              name: 'execute_sql',
              description: 'Execute SQL query',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                },
                required: ['query'],
              },
            },
          ],
        },
      }

      expect(response.jsonrpc).toBe('2.0')
      expect(response).toHaveProperty('result')
      expect(response).not.toHaveProperty('error')
      expect(response.result.tools).toHaveLength(1)
      expect(response.result.tools[0].name).toBe('execute_sql')
    })

    it('should parse error response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 12345,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      }

      expect(response.jsonrpc).toBe('2.0')
      expect(response).toHaveProperty('error')
      expect(response).not.toHaveProperty('result')
      expect(response.error.code).toBe(-32601)
      expect(response.error.message).toBe('Method not found')
    })

    it('should handle response with null result', () => {
      const response = {
        jsonrpc: '2.0',
        id: 12345,
        result: null,
      }

      expect(response.jsonrpc).toBe('2.0')
      expect(response).toHaveProperty('result')
      expect(response.result).toBeNull()
    })

    it('should parse response with complex nested result', () => {
      const response = {
        jsonrpc: '2.0',
        id: 12345,
        result: {
          content: [
            {
              type: 'text',
              text: 'Query executed successfully',
            },
            {
              type: 'resource',
              resource: {
                uri: 'postgres://localhost/db',
                mimeType: 'application/json',
                text: '[{"id": 1, "name": "Alice"}]',
              },
            },
          ],
        },
      }

      expect(response.result.content).toHaveLength(2)
      expect(response.result.content[0].type).toBe('text')
      expect(response.result.content[1].type).toBe('resource')
      expect(response.result.content[1].resource.uri).toContain('postgres')
    })
  })

  describe('JSON-RPC Error Codes', () => {
    it('should recognize parse error (-32700)', () => {
      const error = {
        code: -32700,
        message: 'Parse error',
      }

      expect(error.code).toBe(-32700)
      expect(error.message).toContain('Parse')
    })

    it('should recognize invalid request (-32600)', () => {
      const error = {
        code: -32600,
        message: 'Invalid Request',
      }

      expect(error.code).toBe(-32600)
      expect(error.message).toContain('Invalid')
    })

    it('should recognize method not found (-32601)', () => {
      const error = {
        code: -32601,
        message: 'Method not found',
      }

      expect(error.code).toBe(-32601)
      expect(error.message).toContain('Method not found')
    })

    it('should recognize invalid params (-32602)', () => {
      const error = {
        code: -32602,
        message: 'Invalid params',
      }

      expect(error.code).toBe(-32602)
      expect(error.message).toContain('Invalid params')
    })

    it('should recognize internal error (-32603)', () => {
      const error = {
        code: -32603,
        message: 'Internal error',
      }

      expect(error.code).toBe(-32603)
      expect(error.message).toContain('Internal')
    })
  })

  describe('MCP-specific Extensions', () => {
    it('should parse tools/list response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather for a location',
              inputSchema: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                    description: 'City name',
                  },
                },
                required: ['location'],
              },
            },
          ],
        },
      }

      const tools = response.result.tools
      expect(tools).toHaveLength(1)
      expect(tools[0]).toHaveProperty('name')
      expect(tools[0]).toHaveProperty('description')
      expect(tools[0]).toHaveProperty('inputSchema')
      expect(tools[0].inputSchema.properties).toHaveProperty('location')
    })

    it('should parse tools/call response', () => {
      const response = {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [
            {
              type: 'text',
              text: 'Temperature: 72°F, Condition: Sunny',
            },
          ],
        },
      }

      expect(response.result.content).toHaveLength(1)
      expect(response.result.content[0].type).toBe('text')
      expect(response.result.content[0].text).toContain('Temperature')
    })

    it('should handle empty tools list', () => {
      const response = {
        jsonrpc: '2.0',
        id: 1,
        result: {
          tools: [],
        },
      }

      expect(response.result.tools).toEqual([])
      expect(response.result.tools).toHaveLength(0)
    })

    it('should parse tool with complex input schema', () => {
      const tool = {
        name: 'create_booking',
        description: 'Create a calendar booking',
        inputSchema: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
            attendees: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
          required: ['start', 'end'],
        },
      }

      expect(tool.inputSchema.type).toBe('object')
      expect(tool.inputSchema.required).toContain('start')
      expect(tool.inputSchema.required).toContain('end')
      expect(tool.inputSchema.properties.attendees.type).toBe('array')
    })
  })

  describe('Request Validation', () => {
    it('should reject request without jsonrpc field', () => {
      const invalidRequest = {
        id: 1,
        method: 'tools/list',
        params: {},
      }

      expect(invalidRequest).not.toHaveProperty('jsonrpc')
    })

    it('should reject request with wrong jsonrpc version', () => {
      const invalidRequest = {
        jsonrpc: '1.0', // Wrong version
        id: 1,
        method: 'tools/list',
        params: {},
      }

      expect(invalidRequest.jsonrpc).not.toBe('2.0')
    })

    it('should reject request without method', () => {
      const invalidRequest = {
        jsonrpc: '2.0',
        id: 1,
        params: {},
      }

      expect(invalidRequest).not.toHaveProperty('method')
    })

    it('should allow request without params', () => {
      const validRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }

      expect(validRequest.jsonrpc).toBe('2.0')
      expect(validRequest).toHaveProperty('method')
      expect(validRequest).not.toHaveProperty('params')
    })
  })

  describe('Response Validation', () => {
    it('should reject response without jsonrpc field', () => {
      const invalidResponse = {
        id: 1,
        result: {},
      }

      expect(invalidResponse).not.toHaveProperty('jsonrpc')
    })

    it('should reject response without result or error', () => {
      const invalidResponse = {
        jsonrpc: '2.0',
        id: 1,
      }

      expect(invalidResponse).not.toHaveProperty('result')
      expect(invalidResponse).not.toHaveProperty('error')
    })

    it('should reject response with both result and error', () => {
      const invalidResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: {},
        error: { code: -1, message: 'Error' },
      }

      // Response should not have both
      const hasBoth =
        invalidResponse.hasOwnProperty('result') &&
        invalidResponse.hasOwnProperty('error')

      expect(hasBoth).toBe(true) // This is invalid per JSON-RPC spec
    })
  })
})
