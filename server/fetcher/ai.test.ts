import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetSetting, mockCreateMessage, mockStreamMessage, mockRequireKey } = vi.hoisted(() => ({
  mockGetSetting: vi.fn(),
  mockCreateMessage: vi.fn(),
  mockStreamMessage: vi.fn(),
  mockRequireKey: vi.fn(),
}))

vi.mock('../db.js', () => ({
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
}))

vi.mock('../providers/llm/index.js', () => ({
  getProvider: () => ({
    name: 'anthropic',
    requireKey: mockRequireKey,
    createMessage: mockCreateMessage,
    streamMessage: mockStreamMessage,
  }),
}))

import {
  detectLanguage,
  summarizeArticle,
  streamSummarizeArticle,
  translateArticle,
  streamTranslateArticle,
  translateTitle,
} from './ai.js'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSetting.mockReturnValue(null) // use defaults
})

// ---------------------------------------------------------------------------
// detectLanguage
// ---------------------------------------------------------------------------
describe('detectLanguage', () => {
  it('returns "ja" for Japanese text', () => {
    expect(detectLanguage('これは日本語のテキストです。テストのために書いています。')).toBe('ja')
  })

  it('returns "en" for English text', () => {
    expect(detectLanguage('This is an English text written for testing purposes.')).toBe('en')
  })

  it('returns "en" for empty string', () => {
    expect(detectLanguage('')).toBe('en')
  })

  it('uses only first 1000 chars for detection', () => {
    const ja = 'あ'.repeat(200)
    const en = 'a'.repeat(2000)
    // First 1000 chars: 200 ja + 800 en → 200/1000 = 20% > 10% → "ja"
    expect(detectLanguage(ja + en)).toBe('ja')
  })

  it('returns "ja" when kana ratio is just above 2%', () => {
    // 3 kana + 97 ASCII = 3% kana > 2% → "ja"
    const text = 'あ'.repeat(3) + 'a'.repeat(97)
    expect(detectLanguage(text)).toBe('ja')
  })

  it('returns "en" when kana ratio is at the 2% boundary', () => {
    // 2 kana + 98 ASCII = 2% kana → not > 2%; no CJK → "en"
    const text = 'あ'.repeat(2) + 'a'.repeat(98)
    expect(detectLanguage(text)).toBe('en')
  })

  it('returns "zh" for CJK-only text without kana', () => {
    // 20 kanji + 80 ASCII = 20% CJK, no kana → "zh"
    const text = '中'.repeat(20) + 'a'.repeat(80)
    expect(detectLanguage(text)).toBe('zh')
  })

  it('returns "en" when CJK-only ratio is at boundary (<=10%)', () => {
    // 10 kanji + 90 ASCII = 10% CJK → not > 10% → "en"
    const text = '中'.repeat(10) + 'a'.repeat(90)
    expect(detectLanguage(text)).toBe('en')
  })

  it('returns "zh" when CJK-only ratio is just above 10%', () => {
    // 11 kanji + 89 ASCII = 11% CJK → > 10% → "zh"
    const text = '中'.repeat(11) + 'a'.repeat(89)
    expect(detectLanguage(text)).toBe('zh')
  })

  it('detects kanji-heavy text as Japanese', () => {
    expect(detectLanguage('東京都渋谷区で開催されたイベントに参加しました')).toBe('ja')
  })

  it('detects katakana-heavy text as Japanese', () => {
    expect(detectLanguage('プログラミングのテストケースをチェックする')).toBe('ja')
  })
})

// ---------------------------------------------------------------------------
// summarizeArticle
// ---------------------------------------------------------------------------
describe('summarizeArticle', () => {
  it('returns summary with token usage', async () => {
    mockCreateMessage.mockResolvedValue({
      text: '要約テキスト',
      inputTokens: 100,
      outputTokens: 50,
    })

    const result = await summarizeArticle('Article body text')

    expect(result.summary).toBe('要約テキスト')
    expect(result.inputTokens).toBe(100)
    expect(result.outputTokens).toBe(50)
    expect(result.billingMode).toBe('anthropic')
    expect(result.model).toBeDefined()
  })

  it('calls requireKey before making request', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await summarizeArticle('text')
    expect(mockRequireKey).toHaveBeenCalled()
  })

  it('uses createMessage (non-streaming)', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await summarizeArticle('text')
    expect(mockCreateMessage).toHaveBeenCalled()
    expect(mockStreamMessage).not.toHaveBeenCalled()
  })

  it('passes article text in prompt', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await summarizeArticle('My article content here')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.messages[0].content).toContain('My article content here')
  })

  it('sets maxTokens to 2048 for summarize', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await summarizeArticle('text')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.maxTokens).toBe(2048)
  })

  it('uses summary.max_tokens override from settings', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'summary.max_tokens') return '512'
      return null
    })
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await summarizeArticle('text')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.maxTokens).toBe(512)
  })

  it('falls back to default when summary.max_tokens is not a positive integer', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'summary.max_tokens') return 'not-a-number'
      return null
    })
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await summarizeArticle('text')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.maxTokens).toBe(2048)
  })

  it('uses custom model from settings', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'summary.model') return 'claude-sonnet-4-6'
      return null
    })
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    const result = await summarizeArticle('text')
    expect(result.model).toBe('claude-sonnet-4-6')
  })

  it('propagates provider errors', async () => {
    mockCreateMessage.mockRejectedValue(new Error('API rate limit'))
    await expect(summarizeArticle('text')).rejects.toThrow('API rate limit')
  })

  it('propagates requireKey errors', async () => {
    mockRequireKey.mockImplementation(() => {
      throw new Error('ANTHROPIC_KEY_NOT_SET')
    })
    await expect(summarizeArticle('text')).rejects.toThrow('ANTHROPIC_KEY_NOT_SET')
    mockRequireKey.mockReset()
  })
})

// ---------------------------------------------------------------------------
// streamSummarizeArticle
// ---------------------------------------------------------------------------
describe('streamSummarizeArticle', () => {
  it('uses streamMessage and passes onText callback', async () => {
    mockStreamMessage.mockResolvedValue({ text: 'streamed summary', inputTokens: 10, outputTokens: 5 })

    const deltas: string[] = []
    const result = await streamSummarizeArticle('text', (d) => deltas.push(d))

    expect(result.summary).toBe('streamed summary')
    expect(mockStreamMessage).toHaveBeenCalled()
    expect(mockCreateMessage).not.toHaveBeenCalled()

    // Verify onText was passed through
    const onText = mockStreamMessage.mock.calls[0][1]
    onText('chunk')
    expect(deltas).toEqual(['chunk'])
  })
})

// ---------------------------------------------------------------------------
// translateArticle
// ---------------------------------------------------------------------------
describe('translateArticle', () => {
  it('returns fullTextTranslated with token usage', async () => {
    mockCreateMessage.mockResolvedValue({
      text: '翻訳されたテキスト',
      inputTokens: 200,
      outputTokens: 180,
    })

    const result = await translateArticle('English article text')

    expect(result.fullTextTranslated).toBe('翻訳されたテキスト')
    expect(result.inputTokens).toBe(200)
    expect(result.outputTokens).toBe(180)
    expect(result.billingMode).toBe('anthropic')
  })

  it('passes article text in translate prompt', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await translateArticle('Content to translate')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.messages[0].content).toContain('Content to translate')
    expect(params.messages[0].content).toContain('Translate the following article into English')
  })

  it('passes configured source language in translate prompt', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.target_lang') return 'en'
      if (key === 'translate.source_lang') return 'ja'
      if (key === 'general.language') return 'en'
      return null
    })

    await translateArticle('Content to translate')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.messages[0].content).toContain('Translate the following article from Japanese into English')
  })

  it('sets maxTokens to 16384 for translate', async () => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await translateArticle('text')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.maxTokens).toBe(16384)
  })

  it('uses translate.max_tokens override from settings', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.max_tokens') return '4096'
      return null
    })
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    await translateArticle('text')

    const params = mockCreateMessage.mock.calls[0][0]
    expect(params.maxTokens).toBe(4096)
  })

  it('uses translate-specific settings keys', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.model') return 'gpt-4.1'
      return null
    })
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    const result = await translateArticle('text')
    expect(result.model).toBe('gpt-4.1')
  })
})

// ---------------------------------------------------------------------------
// streamTranslateArticle
// ---------------------------------------------------------------------------
describe('streamTranslateArticle', () => {
  it('uses streamMessage and returns fullTextTranslated', async () => {
    mockStreamMessage.mockResolvedValue({ text: 'ストリーム翻訳', inputTokens: 15, outputTokens: 12 })

    const deltas: string[] = []
    const result = await streamTranslateArticle('text', (d) => deltas.push(d))

    expect(result.fullTextTranslated).toBe('ストリーム翻訳')
    expect(mockStreamMessage).toHaveBeenCalled()
    expect(mockCreateMessage).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Custom prompt settings (summary.prompt / translate.prompt / translate.title_prompt)
// ---------------------------------------------------------------------------
describe('custom prompt settings', () => {
  beforeEach(() => {
    mockCreateMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
    mockStreamMessage.mockResolvedValue({ text: 'ok', inputTokens: 0, outputTokens: 0 })
  })

  it('summarizeArticle uses summary.prompt as the instruction area with the body still appended', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'summary.prompt') return 'Custom summary rules for {language}.'
      if (key === 'summary.target_lang') return 'ja'
      return null
    })

    await summarizeArticle('Article body text')

    const content = mockCreateMessage.mock.calls[0][0].messages[0].content as string
    expect(content).toBe('Custom summary rules for Japanese.\n\n--- Article body ---\nArticle body text')
  })

  it('summarizeArticle falls back to the default prompt for blank summary.prompt', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'summary.prompt') return '   \n  '
      return null
    })

    await summarizeArticle('text')

    const content = mockCreateMessage.mock.calls[0][0].messages[0].content as string
    expect(content).toContain('## Format')
    expect(content).toContain('--- Article body ---')
  })

  it('translateArticle replaces {language} and {source_language} in translate.prompt', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.prompt') return 'Go {source_language} → {language}.'
      if (key === 'translate.target_lang') return 'ja'
      if (key === 'translate.source_lang') return 'en'
      return null
    })

    await translateArticle('Body here')

    const content = mockCreateMessage.mock.calls[0][0].messages[0].content as string
    expect(content).toBe('Go English → Japanese.\n\n--- Article body ---\nBody here')
  })

  it('translateArticle uses auto-detected for {source_language} when no source lang is set', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.prompt') return 'Target only: {language} (source: {source_language})'
      if (key === 'translate.target_lang') return 'ja'
      return null
    })

    await translateArticle('Body')

    const content = mockCreateMessage.mock.calls[0][0].messages[0].content as string
    expect(content).toBe('Target only: Japanese (source: auto-detected)\n\n--- Article body ---\nBody')
  })

  it('translateArticle keeps unknown placeholders untouched', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.prompt') return 'Unknown {bogus} stays.'
      return null
    })

    await translateArticle('Body')

    const content = mockCreateMessage.mock.calls[0][0].messages[0].content as string
    expect(content).toContain('Unknown {bogus} stays.')
    expect(content).not.toContain('{bogus}.')
  })

  it('translateTitle uses translate.title_prompt instruction with the title appended', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'translate.title_prompt') return 'Translate a title into {language}, keep brand names.'
      if (key === 'translate.target_lang') return 'ja'
      return null
    })

    await translateTitle('Hello World')

    const content = mockCreateMessage.mock.calls[0][0].messages[0].content as string
    expect(content).toBe('Translate a title into Japanese, keep brand names.\n\nHello World')
  })
})
