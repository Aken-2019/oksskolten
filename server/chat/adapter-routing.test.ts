import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestDb } from '../__tests__/helpers/testDb.js'

// ---------------------------------------------------------------------------
// Mocks — the gateway client and the anthropic fallback are both observable,
// so a routing mistake (falling through to anthropic) is detectable.
// ---------------------------------------------------------------------------

const mockOpenCodeCreate = vi.fn()
const mockAnthropicStream = vi.fn()

vi.mock('../providers/llm/opencode-gateway.js', () => ({
  getOpenCodeClient: () => ({
    chat: { completions: { create: (...args: unknown[]) => mockOpenCodeCreate(...args) } },
  }),
  getOpenCodeApiKey: () => 'test-key',
  getOpenCodeRequestHeaders: (_gateway: string, sessionId?: string) => ({
    'User-Agent': 'oksskolten/1.0',
    'x-opencode-session': sessionId ?? 'instance-fallback',
  }),
  makeOpCodeProvider: () => ({
    name: 'opencode-go',
    requireKey: () => {},
    createMessage: vi.fn(),
    streamMessage: vi.fn(),
  }),
  OPENCODE_ZEN_DEFAULT_BASE_URL: 'https://opencode.ai/zen/v1',
  OPENCODE_GO_DEFAULT_BASE_URL: 'https://opencode.ai/zen/go/v1',
}))

vi.mock('../providers/llm/anthropic.js', () => ({
  anthropicProvider: { name: 'anthropic', requireKey: () => {}, createMessage: vi.fn(), streamMessage: vi.fn() },
  anthropic: { messages: { stream: (...args: unknown[]) => mockAnthropicStream(...args) } },
  getAnthropicClient: vi.fn(),
}))

import { runChatTurn, type ChatSSEEvent } from './adapter.js'

function textStream(text: string) {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield { choices: [{ delta: { content: text } }] }
      yield { choices: [], usage: { prompt_tokens: 3, completion_tokens: 2 } }
    },
  }
}

beforeEach(() => {
  setupTestDb()
  mockOpenCodeCreate.mockReset()
  mockAnthropicStream.mockReset()
})

describe('runChatTurn — OpenCode gateway routing', () => {
  it.each(['opencode-go', 'opencode-zen'] as const)('routes %s to the gateway client, not anthropic', async (provider) => {
    mockOpenCodeCreate.mockResolvedValue(textStream('hello from gateway'))
    const events: ChatSSEEvent[] = []

    const result = await runChatTurn(provider, {
      messages: [{ role: 'user', content: 'hi' }],
      system: 'You are helpful.',
      model: 'glm-5',
      sessionId: 'conv-1',
      onEvent: (e) => events.push(e),
    })

    expect(mockOpenCodeCreate).toHaveBeenCalledTimes(1)
    expect(mockOpenCodeCreate.mock.calls[0][0]).toMatchObject({ model: 'glm-5' })
    const reqOpts = mockOpenCodeCreate.mock.calls[0][1] as { headers: Record<string, string> }
    expect(reqOpts.headers['x-opencode-session']).toBe('conv-1')
    expect(reqOpts.headers['User-Agent']).toBe('oksskolten/1.0')
    expect(mockAnthropicStream).not.toHaveBeenCalled()
    expect(events.some(e => e.type === 'text_delta')).toBe(true)
    expect(result.usage.input_tokens).toBe(3)
  })
})
