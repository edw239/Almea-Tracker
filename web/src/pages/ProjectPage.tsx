import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContentCard } from '../components/ContentCard'
import { EmptyState } from '../components/EmptyState'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { FormNotice } from '../components/ui/form-notice'
import { Input } from '../components/ui/input'
import { Select } from '../components/Select'
import { api, ApiError, type ProjectDetail } from '../lib/api'
import { formatDay } from '../lib/format'
import { Target } from '../lib/icons'
import { PROJECT_STATUS_LABEL, PROJECT_SIGNAL_LABEL, signalVariant } from '../lib/project'
import { useStore } from '../store'

const WORK_STATUS: Array<'DRAFT' | 'ACTIVE' | 'ON_HOLD'> = ['DRAFT', 'ACTIVE', 'ON_HOLD']

export function ProjectPage() {
  const { projectId = '' } = useParams()
  const store = useStore()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [name, setName] = useState('')
  const [outcome, setOutcome] = useState('')
  const [startDate, setStartDate] = useState('')
  const [targetEndDate, setTargetEndDate] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ON_HOLD'>('DRAFT')
  const [leadUserId, setLeadUserId] = useState('')
  const [sponsorUserId, setSponsorUserId] = useState('')
  const [contributorIds, setContributorIds] = useState<string[]>([])
  const [closeNote, setCloseNote] = useState('')

  function apply(next: ProjectDetail) {
    setProject(next)
    setName(next.name)
    setOutcome(next.outcome ?? '')
    setStartDate(next.startDate ?? '')
    setTargetEndDate(next.targetEndDate ?? '')
    setStatus(next.status === 'CLOSED' ? 'ACTIVE' : next.status)
    setLeadUserId(next.lead?.id ?? '')
    setSponsorUserId(next.sponsor?.id ?? '')
    setContributorIds(next.contributors.map((person) => person.id))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await api.project(projectId)
        if (!cancelled) apply(data)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Проект недоступен')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!project) return
    setError(null)
    setPending(true)
    try {
      const next = await api.updateProject(project.id, {
        name: name.trim(),
        outcome: outcome.trim() || null,
        startDate: startDate || null,
        targetEndDate: targetEndDate || null,
        status,
        leadUserId: leadUserId || null,
        sponsorUserId: sponsorUserId || null,
        contributorIds: contributorIds.filter((id) => id !== leadUserId && id !== sponsorUserId),
      })
      apply(next)
      await store.reloadSpaces()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  async function closeProject(event: FormEvent) {
    event.preventDefault()
    if (!project) return
    setError(null)
    setPending(true)
    try {
      apply(await api.closeProject(project.id, closeNote.trim()))
      setCloseNote('')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось закрыть')
    } finally {
      setPending(false)
    }
  }

  async function reopen() {
    if (!project) return
    setError(null)
    setPending(true)
    try {
      apply(await api.reopenProject(project.id))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось открыть')
    } finally {
      setPending(false)
    }
  }

  if (!project && error) {
    return <LoadErrorNotice message={error} />
  }
  if (!project) {
    return <p className="text-sm text-muted-foreground">Загрузка…</p>
  }

  const closed = project.status === 'CLOSED'
  const statusOptions = (project.status === 'DRAFT' ? WORK_STATUS : WORK_STATUS.filter((item) => item !== 'DRAFT')).map(
    (item) => ({ value: item, label: PROJECT_STATUS_LABEL[item] }),
  )
  const people = store.users.map((user) => ({ value: user.id, label: user.name }))
  const contributors = store.users.filter((user) => user.id !== leadUserId && user.id !== sponsorUserId)

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Проект"
        title={project.name}
        subtitle={
          <>
            {PROJECT_STATUS_LABEL[project.status]}
            {project.targetEndDate ? ` · цель ${formatDay(project.targetEndDate)}` : ''}
            {project.list ? (
              <>
                {' · '}
                <Link className="text-link hover:underline" to={`/lists/${project.list.id}`}>
                  Список решений и вех
                </Link>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            {project.signal ? (
              <Badge variant={signalVariant(project.signal)}>{PROJECT_SIGNAL_LABEL[project.signal]}</Badge>
            ) : (
              <Badge variant="muted">Закрыт</Badge>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">К портфелю</Link>
            </Button>
          </>
        }
      />

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}

      {closed && project.openTaskCount > 0 ? (
        <FormNotice>
          Открытых задач: {project.openTaskCount}. Связь заморожена. Откройте проект, чтобы отвязать хвост, либо
          доведите задачи в их пространствах.
        </FormNotice>
      ) : null}

      {project.closeNote ? (
        <ContentCard className="space-y-1">
          <p className="text-sm font-medium text-foreground">Что сдано</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.closeNote}</p>
        </ContentCard>
      ) : null}

      {project.canManage && !closed ? (
        <ContentCard>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void save(event)}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-name">
                Название
              </label>
              <Input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-status">
                Статус
              </label>
              <Select
                id="edit-status"
                value={status}
                options={statusOptions}
                onChange={(value) => {
                  if (value === 'DRAFT' || value === 'ACTIVE' || value === 'ON_HOLD') setStatus(value)
                }}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium" htmlFor="edit-outcome">
                Результат
              </label>
              <textarea
                id="edit-outcome"
                className="input-field min-h-24 w-full px-3 py-2.5 text-sm"
                value={outcome}
                maxLength={2000}
                onChange={(event) => setOutcome(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-start">
                Старт
              </label>
              <Input id="edit-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-target">
                Целевая дата
              </label>
              <Input
                id="edit-target"
                type="date"
                value={targetEndDate}
                onChange={(event) => setTargetEndDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-lead">
                Руководитель
              </label>
              <Select
                id="edit-lead"
                value={leadUserId}
                placeholder="Не назначен"
                options={[{ value: '', label: 'Не назначен' }, ...people]}
                onChange={(value) => {
                  setLeadUserId(value)
                  setContributorIds((current) => current.filter((id) => id !== value))
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="edit-sponsor">
                Спонсор
              </label>
              <Select
                id="edit-sponsor"
                value={sponsorUserId}
                placeholder="Нет"
                options={[{ value: '', label: 'Нет' }, ...people]}
                onChange={(value) => {
                  setSponsorUserId(value)
                  setContributorIds((current) => current.filter((id) => id !== value))
                }}
              />
            </div>
            <fieldset className="space-y-2 md:col-span-2">
              <legend className="text-sm font-medium">Участники</legend>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
                {contributors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет других людей.</p>
                ) : (
                  contributors.map((user) => (
                    <label key={user.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={contributorIds.includes(user.id)}
                        onChange={(event) => {
                          setContributorIds((current) =>
                            event.target.checked ? [...current, user.id] : current.filter((id) => id !== user.id),
                          )
                        }}
                      />
                      {user.name}
                    </label>
                  ))
                )}
              </div>
            </fieldset>
            <div>
              <Button type="submit" disabled={pending}>
                {pending ? 'Сохраняем…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        </ContentCard>
      ) : (
        <ContentCard className="space-y-2 text-sm">
          <p>{project.outcome || 'Результат ещё не записан.'}</p>
          <p className="text-muted-foreground">
            {project.lead ? `Руководитель: ${project.lead.name}` : 'Руководитель не назначен'}
            {project.sponsor ? ` · спонсор: ${project.sponsor.name}` : ''}
          </p>
          {project.contributors.length > 0 ? (
            <p className="text-muted-foreground">Участники: {project.contributors.map((person) => person.name).join(', ')}</p>
          ) : null}
        </ContentCard>
      )}

      {project.canManage && !closed ? (
        <ContentCard>
          <form className="space-y-3" onSubmit={(event) => void closeProject(event)}>
            <label className="text-sm font-medium" htmlFor="close-note">
              Закрыть проект
            </label>
            <textarea
              id="close-note"
              className="input-field min-h-20 w-full px-3 py-2.5 text-sm"
              value={closeNote}
              maxLength={2000}
              placeholder="Что сдано"
              onChange={(event) => setCloseNote(event.target.value)}
              required
            />
            <Button type="submit" variant="secondary" disabled={pending}>
              Закрыть
            </Button>
          </form>
        </ContentCard>
      ) : null}

      {project.canManage && closed ? (
        <Button type="button" variant="secondary" disabled={pending} onClick={() => void reopen()}>
          Открыть снова
        </Button>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-medium text-foreground">Задачи</h2>
        {project.truncated ? <p className="text-sm text-muted-foreground">Показаны не все задачи.</p> : null}
        {project.tasks.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Задач проекта пока нет"
            description="Исполнительские задачи создаются в пространстве процесса и привязываются сюда. Список проекта — для решений и вех."
          />
        ) : (
          <div className="space-y-1 rounded bg-surface p-1">
            {project.tasks.map((task) => (
              <Link
                key={task.id}
                to={`/tasks/${task.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded px-3 py-2.5 hover:bg-inset"
              >
                <span className="font-medium text-foreground">{task.title}</span>
                <span className="text-sm text-muted-foreground">
                  {task.spaceName} · {task.listName}
                  {task.dueDate ? ` · ${formatDay(task.dueDate.slice(0, 10))}` : ''}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
