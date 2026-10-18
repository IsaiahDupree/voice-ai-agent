import type { LLMProvider, LLMCompletionInput, LLMCompletionResult, ProviderHealth } from './types'

export class AnthropicLLM implements LLMProvider {
  readonly slug = 'anthropic'
  private defaultModel: string

  constructor(defaultModel = 'claude-opus-4-7') {
    this.defaultModel = defaultModel
  }

  async complete(input: LLMCompletionInput): Promise<LLMCompletionResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

    const model = input.model ?? this.defaultModel
    const system = input.messages.find(m => m.role === 'system')?.content
    const messages = input.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }))

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1024,
        temperature: input.temperature,
        system,
        messages,
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
    const json: any = await res.json()
    const text = (json.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    return {
      text,
      model: json.model ?? model,
      usage: json.usage
        ? { input: json.usage.input_tokens, output: json.usage.output_tokens }
        : undefined,
    }
  }

  async healthCheck(): Promise<ProviderHealth> {
    return process.env.ANTHROPIC_API_KEY
      ? { healthy: true }
      : { healthy: false, message: 'ANTHROPIC_API_KEY missing' }
  }
}
