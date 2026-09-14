import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentMeta } from './use-document-meta'

const DEFAULT_TITLE = 'Oksskolten'
const DEFAULT_DESCRIPTION = 'default description'

describe('useDocumentMeta', () => {
  beforeEach(() => {
    document.title = DEFAULT_TITLE
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = DEFAULT_DESCRIPTION
  })

  it('sets document title and meta description', () => {
    renderHook(() => useDocumentMeta({ title: 'My Article', description: 'my description' }))

    expect(document.title).toBe('My Article')
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content).toBe('my description')
  })

  it('restores defaults on unmount', () => {
    const { unmount } = renderHook(() => useDocumentMeta({ title: 'My Article', description: 'my description' }))

    unmount()

    expect(document.title).toBe(DEFAULT_TITLE)
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content).toBe(DEFAULT_DESCRIPTION)
  })

  it('updates when title changes', () => {
    const { rerender } = renderHook(({ title, description }) => useDocumentMeta({ title, description }), {
      initialProps: { title: 'First', description: 'first' },
    })

    rerender({ title: 'Second', description: 'second' })

    expect(document.title).toBe('Second')
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')!.content).toBe('second')
  })
})
