import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'

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
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Домен</div>
          <h1 className="page-title">Бренды</h1>
          <p className="page-lead">
            Справочник сущностей. Задачи привязываются к бренду. Ключ 1С — для ручной связки, без автосинка.
          </p>
        </div>
      </header>
      <div className="content">
        <form className="me-panel" onSubmit={(event) => void onCreate(event)}>
          <div className="field">
            <label htmlFor="brand-name">Новый бренд</label>
            <input
              id="brand-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              required
            />
          </div>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="pill" type="submit" disabled={pending}>
            {pending ? 'Создаём…' : 'Создать'}
          </button>
        </form>

        <div className="field" style={{ maxWidth: 320, marginTop: 24 }}>
          <label htmlFor="brand-search">Поиск</label>
          <input
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

        <section className="group">
          <div className="group-h">
            <h2>Справочник</h2>
            <span>{brands.length}</span>
          </div>
          <div className="card-list">
            {brands.map((brand) => (
              <div key={brand.id} className="task-row" style={{ display: 'grid', gap: 8 }}>
                <Link to={`/brands/${brand.id}`}>
                  <strong>{brand.name}</strong>
                </Link>
                <span className="muted">{brand.isArchived ? 'архив' : 'brand'}</span>
                {editingKey === brand.id ? (
                  <div className="top-actions">
                    <input
                      value={keyDraft}
                      onChange={(event) => setKeyDraft(event.target.value)}
                      placeholder="Код 1С"
                      maxLength={100}
                      disabled={pending}
                    />
                    <button type="button" className="pill" disabled={pending} onClick={() => void saveExternalKey(brand.id)}>
                      Сохранить
                    </button>
                    <button type="button" className="ghost" disabled={pending} onClick={() => setEditingKey(null)}>
                      Отмена
                    </button>
                  </div>
                ) : (
                  <div className="top-actions">
                    <span className="muted">1С: {brand.externalKey ?? '—'}</span>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setEditingKey(brand.id)
                        setKeyDraft(brand.externalKey ?? '')
                      }}
                    >
                      Ключ 1С
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {brands.length === 0 ? <p className="empty">Пока нет брендов</p> : null}
        </section>
      </div>
    </>
  )
}
