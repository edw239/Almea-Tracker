import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError, api } from '../../lib/api'
import type { SprintRow } from '../../lib/board-types'
import { PRIORITY_LABEL } from '../../lib/format'
import { loadSpaceEpics, loadSpaceSprints, type EpicOption } from '../../lib/space-catalog'
import { useStore } from '../../store'
import type { TaskPriority } from '../../types'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Select } from '../Select'

export function CreateIssueDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const store = useStore()
  const [spaceId, setSpaceId] = useState(store.spaces[0]?.id ?? '')
  const lists = store.lists.filter((list) => list.spaceId === spaceId)
  const [listId, setListId] = useState(lists[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM')
  const [storyPoints, setStoryPoints] = useState('')
  const [epicId, setEpicId] = useState('')
  const [label, setLabel] = useState('')
  const [brandId, setBrandId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [types, setTypes] = useState<Array<{ id: string; name: string }>>([])
  const [typeId, setTypeId] = useState('')
  const [epics, setEpics] = useState<EpicOption[]>([])
  const [sprints, setSprints] = useState<SprintRow[]>([])
  const [sprintId, setSprintId] = useState('')
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current && store.spaces.length > 0) {
      const preferred = store.spaces.find((space) => !space.isSystem) ?? store.spaces[0]
      setSpaceId(preferred.id)
    }
    wasOpen.current = open
  }, [open, store.spaces])

  useEffect(() => {
    if (!spaceId) return
    void api.listTaskTypes(spaceId).then((rows) => setTypes(rows.map((row) => ({ id: row.id, name: row.name }))))
    void loadSpaceEpics(spaceId, store.lists).then(setEpics).catch(() => setEpics([]))
    void loadSpaceSprints(spaceId, store.lists).then(setSprints).catch(() => setSprints([]))
  }, [spaceId, store.lists])

  useEffect(() => {
    void api.hostEntities({ type: 'brand' }).then((rows) => setBrands(rows.map((row) => ({ id: row.id, name: row.name }))))
  }, [])

  useEffect(() => {
    const next = store.lists.find((list) => list.spaceId === spaceId)
    setListId(next?.id ?? '')
  }, [spaceId, store.lists])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!listId || !title.trim()) return
    setError(null)
    try {
      let labelIds: string[] | undefined
      if (label.trim()) {
        const created = await api.createLabel(label.trim())
        labelIds = [created.id]
      }
      const task = await store.addTask(listId, {
        title: title.trim(),
        assigneeIds: assigneeId ? [assigneeId] : undefined,
        dueDate: dueDate || null,
        hostEntityId: brandId || null,
      })
      if (typeId || epicId || storyPoints || labelIds || sprintId) {
        await store.patchTask(task.id, {
          taskTypeId: typeId || null,
          epicId: epicId || null,
          storyPoints: storyPoints ? Number(storyPoints) : null,
          labelIds,
          sprintId: sprintId || null,
          description: description || undefined,
          priority,
        })
      } else if (description || priority !== 'MEDIUM') {
        await store.patchTask(task.id, { description, priority })
      }
      setTitle('')
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать задачу')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Создать задачу</DialogTitle>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Select
            aria-label="Пространство"
            value={spaceId}
            options={store.spaces.map((space) => ({ value: space.id, label: space.name }))}
            onChange={setSpaceId}
          />
          <Select
            aria-label="Список"
            value={listId}
            options={lists.map((list) => ({ value: list.id, label: list.name }))}
            onChange={setListId}
          />
          <Select
            aria-label="Тип"
            value={typeId}
            placeholder="Тип"
            options={[{ value: '', label: 'Тип' }, ...types.map((type) => ({ value: type.id, label: type.name }))]}
            onChange={setTypeId}
          />
          <Input aria-label="Тема" placeholder="Тема" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <textarea
            aria-label="Описание"
            className="w-full rounded bg-inset p-2 text-sm"
            placeholder="Описание"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Select
            aria-label="Исполнитель"
            value={assigneeId}
            placeholder="Исполнитель"
            options={[{ value: '', label: 'Без исполнителя' }, ...store.users.map((user) => ({ value: user.id, label: user.name }))]}
            onChange={setAssigneeId}
          />
          <Input aria-label="Срок" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <Select
            aria-label="Приоритет"
            value={priority}
            options={(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((key) => ({
              value: key,
              label: PRIORITY_LABEL[key],
            }))}
            onChange={(value) => setPriority(value as TaskPriority)}
          />
          <Input aria-label="Метки" placeholder="Метка" value={label} onChange={(event) => setLabel(event.target.value)} />
          <Select
            aria-label="Эпик"
            value={epicId}
            placeholder="Эпик"
            options={[{ value: '', label: 'Без эпика' }, ...epics.map((epic) => ({ value: epic.id, label: epic.title }))]}
            onChange={setEpicId}
          />
          <Input
            aria-label="Оценка"
            placeholder="Оценка"
            inputMode="decimal"
            value={storyPoints}
            onChange={(event) => setStoryPoints(event.target.value)}
          />
          {sprints.length > 0 ? (
            <Select
              aria-label="Спринт"
              value={sprintId}
              placeholder="Спринт"
              options={[{ value: '', label: 'Без спринта' }, ...sprints.map((sprint) => ({ value: sprint.id, label: sprint.name }))]}
              onChange={setSprintId}
            />
          ) : null}
          <Select
            aria-label="Бренд"
            value={brandId}
            placeholder="Бренд"
            options={[{ value: '', label: 'Без бренда' }, ...brands.map((brand) => ({ value: brand.id, label: brand.name }))]}
            onChange={setBrandId}
          />
          <Button type="submit">Создать</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
