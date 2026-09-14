import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditFeedDialog } from './edit-feed-dialog'
import { apiPatch } from '../../lib/fetcher'
import type { FeedWithCounts, Category } from '../../../shared/types'

vi.mock('../../lib/fetcher', () => ({
  apiPatch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const feed: FeedWithCounts = {
  id: 1,
  name: 'Test Feed',
  url: 'https://example.com',
  rss_url: 'https://example.com/feed.xml',
  rss_bridge_url: null,
  category_id: null,
  last_error: null,
  error_count: 0,
  disabled: 0,
  requires_js_challenge: 0,
  type: 'rss',
  etag: null,
  last_modified: null,
  last_content_hash: null,
  next_check_at: null,
  check_interval: null,
  created_at: '2024-01-01',
  category_name: null,
  article_count: 0,
  unread_count: 0,
  articles_per_week: 0,
  latest_published_at: null,
}

const categories: Category[] = [
  { id: 1, name: 'Tech', sort_order: 0, collapsed: 0, created_at: '2024-01-01' },
]

describe('EditFeedDialog', () => {
  const user = userEvent.setup({ pointerEventsCheck: 0 })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prefills name and url from feed', () => {
    render(<EditFeedDialog feed={feed} categories={categories} onClose={vi.fn()} onSaved={vi.fn()} />)

    const inputs = screen.getAllByRole('textbox')
    expect((inputs[0] as HTMLInputElement).value).toBe('Test Feed')
    expect((inputs[1] as HTMLInputElement).value).toBe('https://example.com')
  })

  it('submits edited name and url via PATCH', async () => {
    const onClose = vi.fn()
    const onSaved = vi.fn()
    render(<EditFeedDialog feed={feed} categories={categories} onClose={onClose} onSaved={onSaved} />)

    const inputs = screen.getAllByRole('textbox')
    await user.clear(inputs[0])
    await user.type(inputs[0], 'Renamed')
    await user.clear(inputs[1])
    await user.type(inputs[1], 'https://newsite.com')
    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith('/api/feeds/1', {
        name: 'Renamed',
        url: 'https://newsite.com',
        category_id: null,
      })
    })
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('shows error when PATCH fails', async () => {
    vi.mocked(apiPatch).mockRejectedValueOnce(new Error('Feed URL already exists'))
    render(<EditFeedDialog feed={feed} categories={categories} onClose={vi.fn()} onSaved={vi.fn()} />)

    await user.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText('Feed URL already exists')).toBeTruthy()
    })
  })
})
