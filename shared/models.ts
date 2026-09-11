export interface ModelDef {
  value: string
  label: string
  pricing: [number, number] // [input $/M tokens, output $/M tokens]
}

export interface ModelGroup {
  group: string
  models: ModelDef[]
}

export const ANTHROPIC_MODELS: ModelGroup[] = [
  { group: 'Latest', models: [
    { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', pricing: [1, 5] },
    { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6', pricing: [3, 15] },
    { value: 'claude-opus-4-8', label: 'Opus 4.8', pricing: [5, 25] },
    { value: 'claude-opus-4-7', label: 'Opus 4.7', pricing: [5, 25] },
  ]},
  { group: 'Legacy', models: [
    { value: 'claude-opus-4-6', label: 'Opus 4.6', pricing: [5, 25] },
    { value: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', pricing: [3, 15] },
    { value: 'claude-opus-4-5-20251101', label: 'Opus 4.5', pricing: [5, 25] },
    { value: 'claude-sonnet-4-20250514', label: 'Sonnet 4', pricing: [3, 15] },
    { value: 'claude-opus-4-20250514', label: 'Opus 4', pricing: [15, 75] },
  ]},
]

export const GEMINI_MODELS: ModelGroup[] = [
  { group: 'Latest', models: [
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', pricing: [1.50, 9] },
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', pricing: [2, 12] },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite', pricing: [0.25, 1.50] },
  ]},
  { group: 'Standard', models: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', pricing: [0.15, 0.60] },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', pricing: [1.25, 10] },
  ]},
  { group: 'Legacy', models: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', pricing: [0.10, 0.40] },
  ]},
]

export const OPENAI_MODELS: ModelGroup[] = [
  { group: 'Latest', models: [
    { value: 'gpt-5.5', label: 'GPT-5.5', pricing: [5, 30] },
    { value: 'gpt-5.4', label: 'GPT-5.4', pricing: [2.50, 15] },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', pricing: [0.75, 4.50] },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', pricing: [0.20, 1.25] },
  ]},
  { group: 'Standard', models: [
    { value: 'gpt-5.3', label: 'GPT-5.3', pricing: [1.75, 14] },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini', pricing: [0.25, 2] },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano', pricing: [0.05, 0.40] },
    { value: 'gpt-4.1', label: 'GPT-4.1', pricing: [2, 8] },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', pricing: [0.40, 1.60] },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', pricing: [0.10, 0.40] },
  ]},
  { group: 'Legacy', models: [
    { value: 'gpt-5.2', label: 'GPT-5.2', pricing: [1.75, 14] },
    { value: 'gpt-4o', label: 'GPT-4o', pricing: [2.50, 10] },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', pricing: [0.15, 0.60] },
  ]},
]

export const DEEPSEEK_MODELS: ModelGroup[] = [
  { group: 'Standard', models: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat', pricing: [0.14, 0.28] },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', pricing: [0.55, 2.19] },
  ]},
]

// OpenCode gateways bill via gateway credits, not per-model API pricing —
// static lists are only a fallback for when /v1/models is unreachable.
export const OPENCODE_ZEN_MODELS: ModelGroup[] = [
  { group: 'Free', models: [
    { value: 'glm-5', label: 'GLM 5', pricing: [0, 0] },
    { value: 'glm-5.2', label: 'GLM 5.2', pricing: [0, 0] },
    { value: 'kimi-k2.5', label: 'Kimi K2.5', pricing: [0, 0] },
    { value: 'minimax-m2.5', label: 'MiniMax M2.5', pricing: [0, 0] },
    { value: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free', pricing: [0, 0] },
  ]},
  { group: 'Latest', models: [
    { value: 'gpt-5.5', label: 'GPT-5.5', pricing: [0, 0] },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', pricing: [0, 0] },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', pricing: [0, 0] },
    { value: 'gemini-3-flash', label: 'Gemini 3 Flash', pricing: [0, 0] },
    { value: 'grok-4.5', label: 'Grok 4.5', pricing: [0, 0] },
  ]},
]

export const OPENCODE_GO_MODELS: ModelGroup[] = [
  { group: 'Standard', models: [
    { value: 'glm-5', label: 'GLM 5', pricing: [0, 0] },
    { value: 'kimi-k2.5', label: 'Kimi K2.5', pricing: [0, 0] },
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', pricing: [0, 0] },
  ]},
]

export const MODELS_BY_PROVIDER: Record<string, ModelGroup[]> = {
  anthropic: ANTHROPIC_MODELS,
  gemini: GEMINI_MODELS,
  openai: OPENAI_MODELS,
  deepseek: DEEPSEEK_MODELS,
  'opencode-zen': OPENCODE_ZEN_MODELS,
  'opencode-go': OPENCODE_GO_MODELS,
}

export const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  deepseek: 'deepseek-chat',
  mimo: '',
  custom: '',
  'opencode-zen': '',
  'opencode-go': '',
  'claude-code': 'claude-haiku-4-5-20251001',
  ollama: '',
  vllm: '',
  'google-translate': '',
  deepl: '',
}

export const TASK_DEFAULTS = {
  chat:      { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  summarize: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  translate: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
} as const

/** LLM providers that require an API key */
export const LLM_API_PROVIDERS = ['anthropic', 'gemini', 'openai', 'deepseek', 'mimo', 'opencode-zen', 'opencode-go'] as const

/** Translation service providers that require an API key */
export const TRANSLATE_SERVICE_PROVIDERS = ['google-translate', 'deepl'] as const

/** All LLM providers selectable for tasks (includes claude-code which uses auth, not API key) */
export const LLM_TASK_PROVIDERS = [...LLM_API_PROVIDERS, 'custom', 'claude-code', 'ollama', 'vllm'] as const

export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'provider.anthropic',
  gemini: 'provider.gemini',
  openai: 'provider.openai',
  deepseek: 'provider.deepseek',
  mimo: 'provider.mimo',
  'opencode-zen': 'provider.opencodeZen',
  'opencode-go': 'provider.opencodeGo',
  custom: 'provider.custom',
  'claude-code': 'provider.claudeCode',
  ollama: 'provider.ollama',
  vllm: 'provider.vllm',
  'google-translate': 'provider.googleTranslate',
  deepl: 'provider.deepl',
}

/** Cheapest model per provider, used for lightweight sub-agent tasks (e.g. title generation) */
export const SUB_AGENT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-5-nano',
  deepseek: 'deepseek-chat',
  mimo: '',
  custom: '',
  'opencode-zen': '',
  'opencode-go': '',
  'claude-code': 'claude-haiku-4-5-20251001',
  ollama: '',
  vllm: '',
}

/** Get flat array of model value strings for a given provider */
export function getModelValues(provider: string): string[] {
  const groups = MODELS_BY_PROVIDER[provider]
  if (!groups) return []
  return groups.flatMap(g => g.models.map(m => m.value))
}

/** Get all model value strings across all providers */
export function getAllModelValues(): string[] {
  return Object.keys(MODELS_BY_PROVIDER).flatMap(getModelValues)
}

/** Get short display label for a model (e.g. "Haiku 4.5") */
export function getModelLabel(model: string): string | undefined {
  for (const groups of Object.values(MODELS_BY_PROVIDER)) {
    for (const group of groups) {
      for (const m of group.models) {
        if (m.value === model) return m.label
      }
    }
  }
  return undefined
}

/** Look up pricing for a model by its value string */
export function getModelPricing(model: string): [number, number] | undefined {
  for (const groups of Object.values(MODELS_BY_PROVIDER)) {
    for (const group of groups) {
      for (const m of group.models) {
        if (m.value === model) return m.pricing
      }
    }
  }
  return undefined
}
