import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ContentCard } from '../components/ContentCard'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/ui/button'
import { FormNotice } from '../components/ui/form-notice'
import { Input } from '../components/ui/input'
import { api, ApiError } from '../lib/api'
import { Building2 } from '../lib/icons'

type BrandRow = {
  id: string
  entityType: string
  name: string
  externalKey: string | null
  isArchived: boolean
}

export function BrandsPage() {
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')

  async function reload(search = query) {
    const data = await api.hostEntities({ type: 'brand', query: search || undefined, includeArchived: true })
    setBrands(data)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await api.hostEntities({ type: 'brand', includeArchived: true })
        if (!cancelled) setBrands(data)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить бренды')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await api.createHostEntity({ entityType: 'brand', name: name.trim() })
      setName('')
      await reload()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать')
    } finally {
      setPending(false)
    }
  }

  async function saveExternalKey(brandId: string) {
    setError(null)
    setPending(true)
    try {
      await api.patchHostEntity(brandId, { externalKey: keyDraft.trim() || null })
      setEditingKey(null)
      await reload()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить ключ 1С')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Домен"
        title="Бренды"
        subtitle="Справочник сущностей. Задачи привязываются к бренду. Ключ 1С — для ручной связки, без автосинка."
      />

      <ContentCard className="space-y-4">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void onCreate(event)}>
          <div className="min-w-[12rem] flex-1 space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="brand-name">
              Новый бренд
            </label>
            <Input
              id="brand-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? 'Создаём…' : 'Создать'}
          </Button>
        </form>
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
      </ContentCard>

      <div className="max-w-xs space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="brand-search">
          Поиск
        </label>
        <Input
          id="brand-search"
          value={query}
          onChange={(event) => {
            const next = event.target.value
            setQuery(next)
            void reload(next)
          }}
          placeholder="xlash…"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium text-foreground">Справочник</h2>
          <span className="text-sm text-muted-foreground">{brands.length}</span>
        </div>
        {brands.length === 0 ? (
          <EmptyState icon={Building2} title="Пока нет брендов" description="Создайте первый бренд выше." />
        ) : (
          <div className="space-y-2">
            {brands.map((brand) => (
              <ContentCard key={brand.id} className="space-y-2 p-4">
                <Link className="font-medium text-link hover:underline" to={`/brands/${brand.id}`}>
                  {brand.name}
                </Link>
                <span className="block text-sm text-muted-foreground">{brand.isArchived ? 'архив' : 'brand'}</span>
                {editingKey === brand.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={keyDraft}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      placeholder="Код 1С"
                      maxLength={100}
                      disabled={pending}
                      className="max-w-xs"
                    />
                    <Button type="button" size="sm" disabled={pending} onClick={() => void saveExternalKey(brand.id)}>
                      Сохранить
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setEditingKey(null)}>
                      Отмена
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">1С: {brand.externalKey ?? '—'}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      onClick={() => {
                        setEditingKey(brand.id)
                        setKeyDraft(brand.externalKey ?? '')
                      }}
                    >
                      Ключ 1С
                    </Button>
                  </div>
                )}
              </ContentCard>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
