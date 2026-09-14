import { useEffect } from 'react'

interface DocumentMeta {
  title: string
  description: string
}

/**
 * Sets the browser tab title and meta description while mounted,
 * restoring the previous values on unmount.
 */
export function useDocumentMeta({ title, description }: DocumentMeta): void {
  useEffect(() => {
    const prevTitle = document.title
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDescription = meta?.content ?? ''
    document.title = title
    if (meta) meta.content = description
    return () => {
      document.title = prevTitle
      if (meta) meta.content = prevDescription
    }
  }, [title, description])
}
