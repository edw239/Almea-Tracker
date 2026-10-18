import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/Select'
import { ApiError, api } from '../../lib/api'
import type { BoardSummary } from '../../lib/board-types'
import { suggestSpaceKey } from '../../lib/space-key'
import { useStore } from '../../store'

export function BoardsPage() {
  const store = useStore()
  const navigate = useNavigate()
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'KANBAN' | 'SCRUM'>('KANBAN')
  const [spaceId, setSpaceId] = useState('')
  const [listId, setListId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    void api.boards().then(setBoards).catch(() => setBoards([]))
    void api.hostEntities({ type: 'brand' }).then((rows) => setBrands(rows.map((row) => ({ id: row.id, name: row.name }))))
  }, [])

  const lists = store.lists.filter((list) => list.spaceId === spaceId)

  async function create(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const sources = listId
        ? [{ listId }]
        : spaceId
          ? [{ spaceId }]
          : []
      if (sources.length === 0) {
        setError('Выберите пространство или список')
        return
      }
      const filter = brandId
        ? { op: 'AND', children: [{ field: 'host_entity_id', operator: 'is', value: brandId }] }
        : undefined
      const created = await api.createBoard({
        name: name.trim(),
        type,
        sources,
        filter,
        defaultListId: listId || lists[0]?.id,
      })
      navigate(`/boards/${created.id}`)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать доску')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Доски"
        title="Доски"
        subtitle="Канбан и спринты по пространствам и брендам."
        toolbar={
          <Button type="button" onClick={() => setOpen((value) => !value)}>
            Создать доску
          </Button>
        }
      />
      {open ? (
        <form className="surface-card space-y-3 rounded p-4" onSubmit={(event) => void create(event)}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Input placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} required />
          <Select
            aria-label="Тип доски"
            value={type}
            options={[
              { value: 'KANBAN', label: 'Канбан' },
              { value: 'SCRUM', label: 'Скрам' },
            ]}
            onChange={(value) => setType(value as 'KANBAN' | 'SCRUM')}
          />
          <Select
            aria-label="Пространство"
            value={spaceId}
            placeholder="Пространство"
            options={[{ value: '', label: 'Пространство' }, ...store.spaces.filter((space) => space.systemKey !== 'personal').map((space) => ({ value: space.id, label: `${space.name}${space.systemKey ? '' : ''}` }))]}
            onChange={setSpaceId}
          />
          <Select
            aria-label="Список"
            value={listId}
            placeholder="Весь пространство"
            options={[{ value: '', label: 'Все списки пространства' }, ...lists.map((list) => ({ value: list.id, label: list.name }))]}
            onChange={setListId}
          />
          <Select
            aria-label="Бренд"
            value={brandId}
            placeholder="Без фильтра бренда"
            options={[{ value: '', label: 'Все бренды' }, ...brands.map((brand) => ({ value: brand.id, label: brand.name }))]}
            onChange={setBrandId}
          />
          <p className="text-xs text-muted-foreground">Ключ пространства подскажется как {suggestSpaceKey(store.spaces.find((space) => space.id === spaceId)?.name ?? 'Проект')}</p>
          <Button type="submit">Создать</Button>
        </form>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <Link key={board.id} to={`/boards/${board.id}`} className="surface-card block rounded p-4 hover:bg-elevated">
            <h2 className="font-medium">{board.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{board.type === 'SCRUM' ? 'Скрам' : 'Канбан'}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
