import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LLMMessageParams } from './provider.js'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const settings = new Map<string, string | null>()
const mockGetSetting = vi.fn((key: string) => settings.get(key) ?? null)
const mockChatCreate = vi.fn()
const mockOpenAICtor = vi.fn()

vi.mock('../../db.js', () => ({
  getSetting: (key: string) => mockGetSetting(key),
  upsertSetting: (key: string, value: string) => { settings.set(key, value) },
}))

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: (...args: unknown[]) => mockChatCreate(...args) } }
    constructor(_opts: unknown) { mockOpenAICtor(_opts) }
  },
}))

import { makeOpCodeProvider, getOpenCodeBaseUrl, getOpenCodeClient } from './opencode-gateway.js'

const baseParams: LLMMessageParams = {
  model: 'glm-5',
  maxTokens: 100,
  messages: [{ role: 'user', content: 'hello' }],
  systemInstruction: 'sys',
}

describe('open opencode gateway providers', () => {
  beforeEach(() => {
    settings.clear()
    mockGetSetting.mockClear()
    mockChatCreate.mockClear()
    mockOpenAICtor.mockClear()
  })

  it('exposes one provider per gateway with a distinct name and error code', () => {
    const zen = makeOpCodeProvider('opencode-zen')
    const go = makeOpCodeProvider('opencode-go')
    expect(zen.name).toBe('opencode-zen')
    expect(go.name).toEqual('opencode-go')
    expect(() => zen.requireKey()).toThrow('OPENCODE-ZEN_KEY_NOT_SET')
    expect(() => go.requireKey()).toThrow('OPENCODE-GO_KEY_NOT_SET')
  })

  it('requireKey passes once api_key is saved', () => {
    settings.set('api_key.opencode_zen', 'oc-key-123')
    makeOpCodeProvider('opencode-zen').requireKey()
    expect(mockGetSetting).toHaveBeenCalledWith('api_key.opencode_zen')
  })

  it('normalizes the default base URLs to end in /v1', () => {
    expect(getOpenCodeBaseUrl('opencode-zen')).toBe('https://opencode.ai/zen/v1')
    expect(getOpenCodeBaseUrl('opencode-go')).toBe('https://opencode.ai/zen/go/v1')
  })

  it('honors and normalizes a custom base_url', () => {
    settings.set('opencode_zen.base_url', 'https://proxy.example.com/zen/v1/')
    settings.set('opencode_go.base_url', 'https://proxy.example.com/zen/go')
    expect(getOpenCodeBaseUrl('opencode-zen')).toBe('https://proxy.example.com/zen/v1')
    expect(getOpenCodeBaseUrl('opencode-go')).toBe('https://proxy.example.com/zen/go/v1')
  })

  it('reuses the cached client while config is unchanged', () => {
    settings.set('api_key.opencode_zen', 'k1')
    const a = getOpenCodeClient('opencode-zen')
    const b = getOpenCodeClient('opencode-zen')
    expect(Object.is(a, b)).toBe(true)
    settings.set('api_key.opencode_zen', 'k2')
    const c = getOpenCodeClient('opencode-zen')
    expect(Object.is(a, c)).toBe(false)
  })

  it('passes apiKey, baseURL and OpenAI chat params through', async () => {
    settings.set('api_key.opencode_zen', 'sk-oc-1')
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: 'pong' } }],
      usage: { prompt_tokens: 7, completion_tokens: 3 },
    })

    const result = await makeOpCodeProvider('opencode-zen').createMessage(baseParams)

    expect(result).toEqual({ text: 'pong', inputTokens: 7, outputTokens: 3 })
    expect(mockOpenAICtor).toHaveBeenCalledWith({ baseURL: 'https://opencode.ai/zen/v1', apiKey: 'sk-oc-1' })
    const [req] = mockChatCreate.mock.calls[0] as [{ model: string, max_completion_tokens: number, messages: Array<{ role: string, content: string }> }]
    expect(req.model).toBe('glm-5')
    expect(req.max_completion_tokens).toBe(100)
    expect(req.messages[0]).toEqual({ role: 'system', content: 'sys' })
    expect(req.messages[1]).toEqual({ role: 'user', content: 'hello' })
  })

  it('streams deltas and reads usage from stream chunks', async () => {
    settings.set('api_key.opencode_go', 'sk-go-1')
    const deltas = ['he', 'llo']
    mockChatCreate.mockResolvedValue((async function* () {
      yield { choices: [{ delta: { content: deltas[0] } }] }
      yield { choices: [{ delta: { content: deltas[1] } }] }
      yield { choices: [], usage: { prompt_tokens: 2, completion_tokens: 1 } }
    })())

    const seen: string[] = []
    const result = await makeOpCodeProvider('opencode-go').streamMessage(baseParams, d => seen.push(d))

    expect(seen).toEqual(['he', 'llo'])
    expect(result).toEqual({ text: 'hello', inputTokens: 2, outputTokens: 1 })
    expect(mockOpenAICtor).toHaveBeenCalledWith({ baseURL: 'https://opencode.ai/zen/go/v1', apiKey: 'sk-go-1' })
  })
})

describe('OpenCode gateway request headers', () => {
  beforeEach(() => {
    settings.clear()
    mockGetSetting.mockClear()
    mockChatCreate.mockClear()
    mockOpenAICtor.mockClear()
  })

  it('sends a custom user agent and a stable session id on createMessage', async () => {
    settings.set('api_key.opencode_go', 'sk-go-1')
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }], usage: {} })

    await makeOpCodeProvider('opencode-go').createMessage({ ...baseParams, sessionId: 'conversation-42' })

    const options = mockChatCreate.mock.calls[0][1] as { headers: Record<string, string> }
    expect(options.headers['x-opencode-session']).toBe('conversation-42')
    expect(options.headers['User-Agent']).toMatch(/^oksskolten\//)
  })

  it('sends the session header on streamMessage too', async () => {
    settings.set('api_key.opencode_go', 'sk-go-1')
    mockChatCreate.mockResolvedValue((async function* () {
      yield { choices: [{ delta: { content: 'hi' } }] }
    })())

    await makeOpCodeProvider('opencode-go').streamMessage({ ...baseParams, sessionId: 'article-7' }, () => {})

    const options = mockChatCreate.mock.calls[0][1] as { headers: Record<string, string> }
    expect(options.headers['x-opencode-session']).toBe('article-7')
  })

  it('falls back to a persisted per-gateway session id when none is given', async () => {
    settings.set('api_key.opencode_zen', 'sk-zen-1')
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }], usage: {} })

    await makeOpCodeProvider('opencode-zen').createMessage(baseParams)

    const first = (mockChatCreate.mock.calls[0][1] as { headers: Record<string, string> }).headers['x-opencode-session']
    expect(first).toBeTruthy()
    expect(settings.get('opencode_zen.session_id')).toBe(first)

    // Stable across calls / client rebuilds
    mockChatCreate.mockClear()
    await makeOpCodeProvider('opencode-zen').createMessage(baseParams)
    const second = (mockChatCreate.mock.calls[0][1] as { headers: Record<string, string> }).headers['x-opencode-session']
    expect(second).toBe(first)
  })
})
