import '@testing-library/jest-dom'

// Mock pdf-parse to avoid import.meta issues in Jest
jest.mock('pdf-parse', () => {
  return {
    __esModule: true,
    default: async (buffer) => ({
      numpages: 1,
      text: buffer.toString('utf-8'),
      info: {},
    }),
  };
});

// Mock OpenAI embeddings API for tests
// This avoids needing real API keys and API costs
// The integration test still validates chunking, storage, and search logic
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: class MockOpenAI {
      constructor() {
        this.embeddings = {
          create: async ({ input }) => {
            // Generate deterministic fake embeddings based on text content
            // This makes tests reproducible
            const texts = Array.isArray(input) ? input : [input];
            return {
              data: texts.map((text, idx) => ({
                embedding: generateFakeEmbedding(text),
                index: idx,
              })),
              model: 'text-embedding-3-small',
              usage: { prompt_tokens: texts.join('').length, total_tokens: texts.join('').length },
            };
          },
        };
        this.chat = {
          completions: {
            create: async ({ messages, response_format }) => {
              // Mock chat completions for semantic VAD and other AI features
              const userMessage = messages.find(m => m.role === 'user')?.content || '';
              const utterance = userMessage.match(/"([^"]+)"/)?.[1] || '';

              // Simple rule-based classification for tests
              let type = 'filler';
              let confidence = 0.7;
              let reasoning = 'Test classification';

              const lower = utterance.toLowerCase().trim();

              // Real interrupts - check for patterns
              const interruptPatterns = ['wait', 'stop', 'hold on', 'excuse me', "don't", "can i", 'question', 'interrupt', 'not interested', 'no thanks'];
              if (interruptPatterns.some(pattern => lower.includes(pattern))) {
                type = 'real-interrupt';
                confidence = 0.95;
                reasoning = 'Direct interruption signal';
              }
              // Affirmations
              else if (['yeah', 'yes', 'mm-hmm', 'okay', 'right', 'got it', 'i see', 'sure', 'yep', 'yup', 'mhmm', 'ok', 'uhhuh'].some(aff => lower.includes(aff))) {
                type = 'affirmation';
                confidence = 0.95;
                reasoning = 'Back-channel affirmation';
              }
              // Fillers
              else if (['um', 'uh', 'like', 'you know'].some(fill => lower.includes(fill))) {
                type = 'filler';
                confidence = 0.9;
                reasoning = 'Hesitation marker';
              }
              // Side comments
              else if (['oh', 'wow', 'huh', 'interesting'].some(side => lower.includes(side))) {
                type = 'side-comment';
                confidence = 0.85;
                reasoning = 'Emotional reaction';
              }

              const result = { type, confidence, reasoning };

              return {
                choices: [{
                  message: {
                    content: response_format?.type === 'json_object' ? JSON.stringify(result) : result.reasoning,
                  },
                }],
                model: 'gpt-4o-mini',
                usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
              };
            },
          },
        };
      }
    },
  };
});

// Generate a deterministic 1536-dimension embedding based on text
// Similar texts will have similar embeddings (for testing search)
function generateFakeEmbedding(text) {
  const normalized = text.toLowerCase().trim();
  const hash = simpleHash(normalized);
  const embedding = new Array(1536).fill(0);

  // Create a deterministic pattern based on the text content
  for (let i = 0; i < 1536; i++) {
    const seed = hash + i;
    embedding[i] = (Math.sin(seed) + Math.cos(seed * 0.5)) / 2;
  }

  // Add similarity for texts containing similar keywords
  const keywords = ['pricing', 'plans', 'technical', 'stack', 'support', 'contact', 'features'];
  keywords.forEach((keyword, idx) => {
    if (normalized.includes(keyword)) {
      const offset = idx * 200;
      for (let i = 0; i < 50; i++) {
        embedding[offset + i] += 0.5;
      }
    }
  });

  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Mock environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ivhfuhxorppptyuofbgq.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aGZ1aHhvcnBwcHR5dW9mYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzg5OTcsImV4cCI6MjA4NzExNDk5N30.tYXhbRaTquQWmNnhtfyKkE64e7zGI8CRBAc5dRtQR3Y'
// For integration tests, we need service role key - using env var if available
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'
process.env.VAPI_API_KEY = 'test-vapi-key'
process.env.TWILIO_ACCOUNT_SID = 'test-account-sid'
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token'
process.env.TWILIO_PHONE_NUMBER = '+15555551234'
process.env.ADMIN_API_KEY = 'test-admin-key-for-testing'
process.env.OPENAI_API_KEY = 'test-openai-key'

// F1208: Polyfill Request and Response for Node environment tests
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(url, options = {}) {
      this.url = url
      this.method = options.method || 'GET'
      this._body = options.body
      this._headerMap = new Map()

      if (options.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          this._headerMap.set(key.toLowerCase(), value)
        })
      }

      this.headers = {
        get: (key) => this._headerMap.get(key.toLowerCase()),
        has: (key) => this._headerMap.has(key.toLowerCase()),
        set: (key, value) => this._headerMap.set(key.toLowerCase(), value),
      }
    }

    async json() {
      return JSON.parse(this._body)
    }

    async text() {
      return this._body
    }
  }
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, options = {}) {
      this.body = body
      this.status = options.status || 200
      this.statusText = options.statusText || 'OK'
      this.headers = options.headers || {}
    }

    async json() {
      return JSON.parse(this.body)
    }

    async text() {
      return this.body
    }
  }
}

// F1253, F1255, F1257, F1259: Fetch handling for tests
// For smoke tests, use real HTTP. For unit tests, use mock.
if (process.env.SKIP_FETCH_MOCK === 'true') {
  // Use node-fetch for real HTTP requests in smoke tests
  const nodeFetch = require('node-fetch')
  global.fetch = nodeFetch
  global.Response = nodeFetch.Response
  global.Request = nodeFetch.Request
  global.Headers = nodeFetch.Headers
} else if (typeof global.fetch === 'undefined') {
  // Mock fetch for unit tests
  global.fetch = async (url, options = {}) => {
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}
