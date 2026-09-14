import { useState } from 'react'
import { apiPatch } from '../../lib/fetcher'
import { useI18n } from '../../lib/i18n'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import type { FeedWithCounts, Category } from '../../../shared/types'

interface EditFeedDialogProps {
  feed: FeedWithCounts
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export function EditFeedDialog({ feed, categories, onClose, onSaved }: EditFeedDialogProps) {
  const { t } = useI18n()
  const [name, setName] = useState(feed.name)
  const [url, setUrl] = useState(feed.url)
  const [categoryId, setCategoryId] = useState<string>(feed.category_id ? String(feed.category_id) : 'none')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return
    setError('')
    setLoading(true)
    try {
      await apiPatch(`/api/feeds/${feed.id}`, {
        name: name.trim(),
        url: url.trim(),
        category_id: categoryId === 'none' ? null : Number(categoryId),
      })
      toast.success(t('feeds.editSaved'))
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('modal.genericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogTitle>{t('feeds.edit')}</DialogTitle>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted">{t('feeds.editName')}</label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">{t('feeds.editUrl')}</label>
            <Input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">{t('feeds.editCategory')}</label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('category.uncategorized')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('modal.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('feeds.editSaving') : t('feeds.editSave')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
