import OpenAI from 'openai'
import { randomUUID } from 'node:crypto'
import { getSetting, upsertSetting } from '../../db.js'
import type { LLMProvider, LLMMessageParams, LLMStreamResult } from './provider.js'

export const USER_AGENT = 'oksskolten/1.0'

export const OPENCODE_ZEN_DEFAULT_BASE_URL = 'https://opencode.ai/zen/v1'
export const OPENCODE_GO_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1'

export type OpenCodeGateway = 'opencode-zen' | 'opencode-go'

interface GatewayConfig {
  name: string
  apiKeySetting: string
  baseUrlSetting: string
  defaultBaseUrl: string
  sessionSetting: string
}

const GATEWAYS: Record<OpenCodeGateway, GatewayConfig> = {
  'opencode-zen': {
    name: 'opencode-zen',
    apiKeySetting: 'api_key.opencode_zen',
    baseUrlSetting: 'opencode_zen.base_url',
    defaultBaseUrl: OPENCODE_ZEN_DEFAULT_BASE_URL,
    sessionSetting: 'opencode_zen.session_id',
  },
  'opencode-go': {
    name: 'opencode-go',
    apiKeySetting: 'api_key.opencode_go',
    baseUrlSetting: 'opencode_go.base_url',
    defaultBaseUrl: OPENCODE_GO_DEFAULT_BASE_URL,
    sessionSetting: 'opencode_go.session_id',
  },
}

/**
 * Resolve the session id sent as `x-opencode-session`. The gateway asks for a
 * stable id per conversation so it can optimize routing and prompt caching:
 * callers pass a conversation/article scoped id when they have one, otherwise a
 * generated id is persisted per gateway so it stays stable across restarts.
 */
export function getOpenCodeSessionId(gateway: OpenCodeGateway, explicit?: string | null): string {
  if (explicit) return explicit
  const key = GATEWAYS[gateway].sessionSetting
  const stored = getSetting(key)
  if (stored) return stored
  const generated = randomUUID()
  upsertSetting(key, generated)
  return generated
}

/** Per-request headers carrying the client-identification OpenCode expects. */
export function getOpenCodeRequestHeaders(gateway: OpenCodeGateway, sessionId?: string): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    'x-opencode-session': getOpenCodeSessionId(gateway, sessionId),
  }
}

function requestOptions(gateway: OpenCodeGateway, sessionId?: string): { headers: Record<string, string> } {
  return { headers: getOpenCodeRequestHeaders(gateway, sessionId) }
}

/** Exposed for the /api/settings/:gateway/models|status endpoints. */
export function getOpenCodeApiKey(gateway: OpenCodeGateway): string {
  return getSetting(GATEWAYS[gateway].apiKeySetting) || ''
}

/** Normalize a user-provided URL so it always ends in /v1 (OpenAI-compatible root). */
export function getOpenCodeBaseUrl(gateway: OpenCodeGateway): string {
  const raw = getSetting(GATEWAYS[gateway].baseUrlSetting) || GATEWAYS[gateway].defaultBaseUrl
  return raw.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1'
}

interface CachedClient {
  apiKey: string
  baseUrl: string
  client: OpenAI | null
}

const cached: Record<OpenCodeGateway, CachedClient> = {
  'opencode-zen': { apiKey: '', baseUrl: '', client: null },
  'opencode-go': { apiKey: '', baseUrl: '', client: null },
}

export function getOpenCodeClient(gateway: OpenCodeGateway): OpenAI {
  const apiKey = getOpenCodeApiKey(gateway)
  const baseUrl = getOpenCodeBaseUrl(gateway)
  const entry = cached[gateway]
  if (entry.client && apiKey === entry.apiKey && baseUrl === entry.baseUrl) return entry.client
  entry.apiKey = apiKey
  entry.baseUrl = baseUrl
  entry.client = new OpenAI({ baseURL: baseUrl, apiKey })
  return entry.client
}

export function makeOpCodeProvider(gateway: OpenCodeGateway): LLMProvider {
  const config = GATEWAYS[gateway]

  function toMessages(params: LLMMessageParams): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (params.systemInstruction) {
      messages.push({ role: 'system', content: params.systemInstruction })
    }
    for (const m of params.messages) {
      messages.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })
    }
    return messages
  }

  return {
    name: config.name,

    requireKey() {
      if (!getSetting(config.apiKeySetting)) {
        throw new Error(`${config.name.toUpperCase()}_KEY_NOT_SET`)
      }
    },

    async createMessage(params: LLMMessageParams): Promise<LLMStreamResult> {
      const client = getOpenCodeClient(gateway)
      const response = await client.chat.completions.create({
        model: params.model,
        max_completion_tokens: params.maxTokens,
        messages: toMessages(params),
      }, requestOptions(gateway, params.sessionId))
      const text = response.choices[0]?.message?.content ?? ''
      return {
        text,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      }
    },

    async streamMessage(params: LLMMessageParams, onText: (delta: string) => void): Promise<LLMStreamResult> {
      const client = getOpenCodeClient(gateway)
      const stream = await client.chat.completions.create({
        model: params.model,
        max_completion_tokens: params.maxTokens,
        messages: toMessages(params),
        stream: true,
        stream_options: { include_usage: true },
      }, requestOptions(gateway, params.sessionId))

      let fullText = ''
      let inputTokens = 0
      let outputTokens = 0

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          fullText += delta
          onText(delta)
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? inputTokens
          outputTokens = chunk.usage.completion_tokens ?? outputTokens
        }
      }

      return { text: fullText, inputTokens, outputTokens }
    },
  }
}
