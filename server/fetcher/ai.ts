import { getSetting } from '../db.js'
import { getProvider } from '../providers/llm/index.js'
import { googleTranslate } from '../providers/translate/google-translate.js'
import { deeplTranslate } from '../providers/translate/deepl.js'
import { TASK_DEFAULTS } from '../../shared/models.js'
import { DEFAULT_LANGUAGE, languageName } from '../../shared/lang.js'

export type AiBillingMode = 'anthropic' | 'gemini' | 'openai' | 'claude-code' | 'ollama' | 'vllm' | 'google-translate' | 'deepl'

export interface AiTextResult {
  inputTokens: number
  outputTokens: number
  billingMode: AiBillingMode
  model: string
  monthlyChars?: number
}

export function detectLanguage(fullText: string): string {
  const sample = fullText.slice(0, 1000)
  const len = sample.length || 1
  const kana = (sample.match(/[\u3040-\u30FF]/g) || []).length  // hiragana + katakana
  const cjk  = (sample.match(/[\u4E00-\u9FFF]/g) || []).length  // shared CJK ideographs
  if (kana / len > 0.02) return 'ja'   // hiragana/katakana present \u2192 Japanese
  if (cjk  / len > 0.1)  return 'zh'   // CJK only, no kana \u2192 Chinese
  return 'en'
}


/**
 * Resolve the instruction area for an AI task prompt. A custom instruction
 * (stored whole in `promptKey`) replaces the built-in instruction; `{language}`
 * and `{source_language}` placeholders are substituted at build time so the
 * stored template stays language-agnostic. Blank/absent values fall back to
 * the built-in default (returned as null so callers can use their default).
 */
function customInstruction(
  promptKey: string,
  language: string,
  sourceLanguage?: string | null,
): string | null {
  const raw = getSetting(promptKey)
  if (!raw || !raw.trim()) return null
  return raw
    .trim()
    .replaceAll('{language}', language)
    .replaceAll('{source_language}', sourceLanguage ?? 'auto-detected')
}

function buildSummarizePrompt(fullText: string): string {
  const lang = getSetting('summary.target_lang') || getSetting('general.language') || DEFAULT_LANGUAGE
  const instruction = customInstruction('summary.prompt', languageName(lang)) ?? `Summarize the following article in ${languageName(lang)}. Follow the format strictly.

## Format
Line 1: A concise 1-2 sentence summary of the article's main point (what the article is about and the author's key argument or conclusion)
Line 2: Empty line
Line 3+: Key points as bullet points. Each item should follow the format "**Point title** — supplementary explanation" (only the title in bold)

## Rules
- Each bullet point must faithfully reflect the article's arguments, claims, or facts
- Maintain the order of the article's flow
- Minimize the number of points (3-4 is ideal). Only add more if the content is truly wide-ranging, but never exceed 7
- Output in Markdown (bullet points start with "- ")
- Do not include any text other than the summary (no headings, preambles, or notes)`
  return `${instruction}\n\n--- Article body ---\n${fullText}`
}

function buildTranslatePrompt(fullText: string, targetLangOverride?: string | null): string {
  const target = getTargetLang(targetLangOverride)
  const source = getSetting('translate.source_lang') || null
  const targetLang = languageName(target)
  const sourceLang = source && source !== target ? languageName(source) : null
  const instruction = customInstruction('translate.prompt', targetLang, sourceLang) ?? `Translate the following article${sourceLang ? ` from ${sourceLang}` : ''} into ${targetLang}.
Translate every word faithfully — do not summarize, compress, or omit anything.
The translation must be 1:1 with the original text in volume.
Preserve Markdown formatting. In particular, keep blockquote lines starting with ">".
Output ONLY the ${targetLang} translation. Do not include the original text or any commentary.`
  return `${instruction}\n\n--- Article body ---\n${fullText}`
}

interface AiTaskConfig {
  providerKey: string
  modelKey: string
  defaultModel: string
  maxTokensKey: string
  defaultMaxTokens: number
  buildPrompt: (text: string) => string
}

/**
 * Resolve the max output tokens for an AI task. A positive integer stored in
 * settings overrides the built-in default; anything else (unset, empty,
 * malformed) falls back. Lets users with local LLMs (vLLM, Ollama) whose
 * context window is smaller than the defaults lower the completion cap.
 */
function resolveMaxTokens(config: AiTaskConfig): number {
  const raw = getSetting(config.maxTokensKey)
  if (!raw) return config.defaultMaxTokens
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : config.defaultMaxTokens
}

async function runAiTask(
  config: AiTaskConfig,
  fullText: string,
  onText?: (delta: string) => void,
): Promise<{ text: string } & AiTextResult> {
  const providerName = getSetting(config.providerKey) || TASK_DEFAULTS.summarize.provider
  const model = getSetting(config.modelKey) || config.defaultModel
  const provider = getProvider(providerName)
  provider.requireKey()
  const prompt = config.buildPrompt(fullText)
  const maxTokens = resolveMaxTokens(config)
  const result = onText
    ? await provider.streamMessage(
        { model, maxTokens, messages: [{ role: 'user', content: prompt }] },
        onText,
      )
    : await provider.createMessage({
        model,
        maxTokens,
        messages: [{ role: 'user', content: prompt }],
      })
  return {
    text: result.text,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    billingMode: providerName as AiBillingMode,
    model,
  }
}

const SUMMARIZE_MAX_TOKENS = 2048
const TRANSLATE_MAX_TOKENS = 16384

const summarizeConfig: AiTaskConfig = {
  providerKey: 'summary.provider',
  modelKey: 'summary.model',
  defaultModel: TASK_DEFAULTS.summarize.model,
  maxTokensKey: 'summary.max_tokens',
  defaultMaxTokens: SUMMARIZE_MAX_TOKENS,
  buildPrompt: buildSummarizePrompt,
}

const translateConfig: AiTaskConfig = {
  providerKey: 'translate.provider',
  modelKey: 'translate.model',
  defaultModel: TASK_DEFAULTS.translate.model,
  maxTokensKey: 'translate.max_tokens',
  defaultMaxTokens: TRANSLATE_MAX_TOKENS,
  buildPrompt: buildTranslatePrompt,
}

export async function summarizeArticle(fullText: string): Promise<{ summary: string } & AiTextResult> {
  const r = await runAiTask(summarizeConfig, fullText)
  return { summary: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, billingMode: r.billingMode, model: r.model }
}

export async function streamSummarizeArticle(
  fullText: string,
  onText: (delta: string) => void,
): Promise<{ summary: string } & AiTextResult> {
  const r = await runAiTask(summarizeConfig, fullText, onText)
  return { summary: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, billingMode: r.billingMode, model: r.model }
}

export async function translateTitle(title: string, targetLangOverride?: string | null): Promise<string> {
  const provider = getSetting('translate.provider') || TASK_DEFAULTS.translate.provider
  const targetLang = getTargetLang(targetLangOverride)
  const sourceLang = getSetting('translate.source_lang') || null
  if (provider === 'google-translate') {
    const result = await googleTranslate(title, targetLang, sourceLang)
    return result.translatedText
  }
  if (provider === 'deepl') {
    const result = await deeplTranslate(title, targetLang, sourceLang)
    return result.translatedText
  }
  const targetLangName = languageName(targetLang)
  const sourceLangName = sourceLang && sourceLang !== targetLang ? languageName(sourceLang) : null
  const instruction = customInstruction(
    'translate.title_prompt',
    targetLangName,
    sourceLangName,
  ) ?? `Translate the following article title${sourceLangName ? ` from ${sourceLangName}` : ''} into ${targetLangName}. Keep proper nouns, brand names, product names, and technical terms in their original form. Output only the translated title, nothing else.`
  const prompt = `${instruction}\n\n${title}`
  const config: AiTaskConfig = { ...translateConfig, buildPrompt: () => prompt }
  const r = await runAiTask(config, title)
  return r.text.trim()
}

export async function translateArticle(fullText: string, targetLangOverride?: string | null): Promise<{ fullTextTranslated: string } & AiTextResult> {
  const provider = getSetting('translate.provider') || TASK_DEFAULTS.translate.provider
  if (provider === 'google-translate') {
    return runGoogleTranslate(fullText, targetLangOverride)
  }
  if (provider === 'deepl') {
    return runDeepl(fullText, targetLangOverride)
  }
  const config: AiTaskConfig = { ...translateConfig, buildPrompt: (text: string) => buildTranslatePrompt(text, targetLangOverride) }
  const r = await runAiTask(config, fullText)
  return { fullTextTranslated: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, billingMode: r.billingMode, model: r.model }
}

export async function streamTranslateArticle(
  fullText: string,
  onText: (delta: string) => void,
  targetLangOverride?: string | null,
): Promise<{ fullTextTranslated: string } & AiTextResult> {
  const provider = getSetting('translate.provider') || TASK_DEFAULTS.translate.provider
  if (provider === 'google-translate') {
    const result = await runGoogleTranslate(fullText, targetLangOverride)
    onText(result.fullTextTranslated)
    return result
  }
  if (provider === 'deepl') {
    const result = await runDeepl(fullText, targetLangOverride)
    onText(result.fullTextTranslated)
    return result
  }
  const config: AiTaskConfig = { ...translateConfig, buildPrompt: (text: string) => buildTranslatePrompt(text, targetLangOverride) }
  const r = await runAiTask(config, fullText, onText)
  return { fullTextTranslated: r.text, inputTokens: r.inputTokens, outputTokens: r.outputTokens, billingMode: r.billingMode, model: r.model }
}

function getTargetLang(override?: string | null): string {
  return override || getSetting('translate.target_lang') || getSetting('general.language') || DEFAULT_LANGUAGE
}

async function runGoogleTranslate(fullText: string, targetLangOverride?: string | null): Promise<{ fullTextTranslated: string } & AiTextResult> {
  const targetLang = getTargetLang(targetLangOverride)
  const sourceLang = getSetting('translate.source_lang') || null
  const result = await googleTranslate(fullText, targetLang, sourceLang)
  return {
    fullTextTranslated: result.translatedText,
    inputTokens: result.characters,
    outputTokens: result.translatedText.length,
    billingMode: 'google-translate',
    model: 'google-translate-v2',
    monthlyChars: result.monthlyChars,
  }
}

async function runDeepl(fullText: string, targetLangOverride?: string | null): Promise<{ fullTextTranslated: string } & AiTextResult> {
  const targetLang = getTargetLang(targetLangOverride)
  const sourceLang = getSetting('translate.source_lang') || null
  const result = await deeplTranslate(fullText, targetLang, sourceLang)
  return {
    fullTextTranslated: result.translatedText,
    inputTokens: result.characters,
    outputTokens: result.translatedText.length,
    billingMode: 'deepl',
    model: 'deepl-v2',
    monthlyChars: result.monthlyChars,
  }
}
