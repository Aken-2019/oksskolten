import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useStreamingAI } from './use-streaming-ai'
import { useI18n } from '../lib/i18n'
import type { useMetrics } from './use-metrics'
import type { Article } from '../../shared/types'

export type ViewMode = 'original' | 'translated' | 'immersive'

export function useTranslate(
  article: Pick<Article, 'id' | 'full_text_translated'> | undefined,
  metrics: ReturnType<typeof useMetrics>,
) {
  const { locale } = useI18n()
  const [viewMode, setViewMode] = useState<ViewMode>('original')
  const [fullTextTranslated, setFullTextTranslated] = useState<string | null>(null)

  // The client's UI locale is the authoritative translation target: the server
  // has no other reliable signal for it when general.language was never saved.
  const endpoint = useMemo(
    () => (id: number, force?: boolean) =>
      `/api/articles/${id}/translate?stream=1${force ? '&force=1' : ''}&target_lang=${locale}`,
    [locale],
  )

  const initializedIdRef = useRef<number | null>(null)
  useEffect(() => {
    if (article) {
      setFullTextTranslated(article.full_text_translated)
      if (initializedIdRef.current !== article.id) {
        initializedIdRef.current = article.id
        setViewMode(article.full_text_translated ? 'immersive' : 'original')
      }
    }
  }, [article])

  const options = useMemo(() => ({
    endpoint,
    onComplete: (text: string) => {
      setFullTextTranslated(text)
      setViewMode('immersive')
    },
  }), [endpoint])

  const { processing: translating, streamingText: translatingText, streamingHtml: translatingHtml, error, run } =
    useStreamingAI(article?.id, metrics, options)

  const handleTranslate = useCallback((force = false) => run(force), [run])

  return { viewMode, setViewMode, translating, translatingText, fullTextTranslated, handleTranslate, translatingHtml, error }
}
