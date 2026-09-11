import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import { TaskModelSection } from './task-model-section'
import type { Settings } from '../../../hooks/use-settings'
import type { TranslateFn } from '../../../lib/i18n'

// --- SWR keyed by URL so each endpoint can be stubbed independently ---
const swrStore: Record<string, unknown> = {}
vi.mock('swr', () => ({
  default: (url: string | null) => ({ data: url ? swrStore[url] : undefined }),
}))

vi.mock('../../../../lib/fetcher', () => ({
  fetcher: vi.fn(),
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('@/lib/i18n', () => ({
  isMessageKey: (key: string) => typeof key === 'string',
}))

const t = ((key: string) => key) as unknown as TranslateFn

const mockSetTranslateModel = vi.fn()

function makeSettings(overrides: Record<string, unknown> = {}): Settings {
  const noop = vi.fn()
  return {
    chatProvider: 'anthropic',
    chatModel: 'claude-haiku-4-5-20251001',
    summaryProvider: 'anthropic',
    summaryModel: 'claude-haiku-4-5-20251001',
    summaryAuto: 'off',
    summaryTargetLang: null,
    summaryMaxTokens: null,
    setSummaryMaxTokens: noop,
    translateProvider: 'opencode-go',
    translateModel: '',
    translateAuto: 'off',
    translateTitleAuto: 'off',
    translateTargetLang: null,
    translateSourceLang: null,
    translateMaxTokens: null,
    setTranslateMaxTokens: noop,
    setChatProvider: noop,
    setChatModel: noop,
    setSummaryProvider: noop,
    setSummaryModel: noop,
    setTranslateProvider: noop,
    setTranslateModel: mockSetTranslateModel,
    setSummaryAuto: noop,
    setSummaryTargetLang: noop,
    setTranslateAuto: noop,
    setTranslateTitleAuto: noop,
    setTranslateTargetLang: noop,
    customThemes: [],
    ...overrides,
  } as unknown as Settings
}

beforeEach(() => {
  mockSetTranslateModel.mockClear()
  for (const key of Object.keys(swrStore)) delete swrStore[key]
  // Dynamic models for the OpenCode Go gateway (includes models absent from the static fallback list)
  swrStore['/api/settings/opencode-go/models'] = { models: [{ name: 'deepseek-flash' }, { name: 'glm-5.3-flash' }] }
  swrStore['/api/settings/api-keys/opencode-go'] = { configured: true }
  swrStore['/api/settings/api-keys/anthropic'] = { configured: true }
  swrStore['/api/settings/custom-providers'] = { providers: [] }
  swrStore['/api/settings/preferences'] = {}
  swrStore['/api/chat/claude-code-status'] = { loggedIn: false }
  swrStore['/api/settings/google-translate/status'] = { ok: true }
  swrStore['/api/settings/deepl/status'] = { ok: true }
})

describe('TaskModelSection — dynamic model lists for OpenCode gateways', () => {
  it('auto-selects the first live /v1/models entry for opencode-go', async () => {
    render(<TaskModelSection settings={makeSettings()} t={t} hiddenProviders={[]} />)

    // The auto-select effect picked the first model from the live list
    await waitFor(() => {
      expect(mockSetTranslateModel).toHaveBeenCalledWith('deepseek-flash')
    })
  })

  it('falls back to the static list when the gateway /models fetch returns nothing', async () => {
    swrStore['/api/settings/opencode-go/models'] = { models: [] }

    render(<TaskModelSection settings={makeSettings()} t={t} hiddenProviders={[]} />)

    // Static fallback list is used for auto-select instead of staying empty
    await waitFor(() => {
      expect(mockSetTranslateModel).toHaveBeenCalledWith('glm-5')
    })
  })
})
