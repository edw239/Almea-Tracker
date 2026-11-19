import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { ContentCard } from '../components/ContentCard'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { FormNotice } from '../components/ui/form-notice'
import { Input } from '../components/ui/input'
import { Select } from '../components/Select'
import { canManageProjects } from '../lib/account-role'
import { api, ApiError, type ProjectSummary } from '../lib/api'
import { formatDay } from '../lib/format'
import { Target } from '../lib/icons'
import { PROJECT_STATUS_LABEL, PROJECT_SIGNAL_LABEL, signalVariant } from '../lib/project'
import { useStore } from '../store'

export function ProjectsPage() {
  const auth = useAuth()
  const store = useStore()
  const canManage = canManageProjects(auth.user?.role)
  const [items, setItems] = useState<ProjectSummary[]>([])
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [name, setName] = useState('')
  const [outcome, setOutcome] = useState('')
  const [targetEndDate, setTargetEndDate] = useState('')
  const [leadUserId, setLeadUserId] = useState('')

  async function reload() {
    const data = await api.projects({ includeClosed: true })
    setItems(data.items)
    setTruncated(data.truncated)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await api.projects({ includeClosed: true })
        if (cancelled) return
        setItems(data.items)
        setTruncated(data.truncated)
      } catch (caught) {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить проекты')
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
      await api.createProject({
        name: name.trim(),
        outcome: outcome.trim() || null,
        targetEndDate: targetEndDate || null,
        leadUserId: leadUserId || null,
        status: 'DRAFT',
      })
      setName('')
      setOutcome('')
      setTargetEndDate('')
      setLeadUserId('')
      await reload()
      await store.reloadSpaces()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать проект')
    } finally {
      setPending(false)
    }
  }

  const open = items.filter((item) => item.status !== 'CLOSED')
  const closed = items.filter((item) => item.status === 'CLOSED')

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Портфель"
        title="Проекты"
        subtitle="Временное обязательство: результат, срок, руководитель. Исполнение остаётся в пространствах процессов."
      />

      {canManage ? (
        <ContentCard className="space-y-4">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void onCreate(event)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-name">
                Название
              </label>
              <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-lead">
                Руководитель
              </label>
              <Select
                id="project-lead"
                value={leadUserId}
                placeholder="Позже"
                options={[
                  { value: '', label: 'Позже' },
                  ...store.users.map((user) => ({ value: user.id, label: user.name })),
                ]}
                onChange={setLeadUserId}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-outcome">
                Результат
              </label>
              <Input
                id="project-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
                maxLength={2000}
                placeholder="Что будет считаться готовым"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-target">
                Целевая дата
              </label>
              <Input
                id="project-target"
                type="date"
                value={targetEndDate}
                onChange={(event) => setTargetEndDate(event.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={pending}>
                {pending ? 'Создаём…' : 'Черновик'}
              </Button>
            </div>
          </form>
          <p className="text-sm text-muted-foreground">
            В работу проект переходит на карточке, когда заполнены результат, дата и руководитель.
          </p>
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        </ContentCard>
      ) : null}

      {!canManage && error ? <FormNotice tone="error">{error}</FormNotice> : null}
      {truncated ? <p className="text-sm text-muted-foreground">Показаны не все проекты.</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-foreground">В портфеле</h2>
        {open.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Нет открытых проектов"
            description="Черновик — это имя. В работу проект входит с результатом, датой и руководителем."
          />
        ) : (
          <div className="space-y-2">
            {open.map((project) => (
              <ProjectLine key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 ? (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">Закрытые · {closed.length}</summary>
          <div className="space-y-2 pt-2">
            {closed.map((project) => (
              <ProjectLine key={project.id} project={project} />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}

function ProjectLine({ project }: { project: ProjectSummary }) {
  return (
    <ContentCard className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0 space-y-1">
        <Link className="font-medium text-link hover:underline" to={`/projects/${project.id}`}>
          {project.name}
        </Link>
        <p className="text-sm text-muted-foreground">
          {PROJECT_STATUS_LABEL[project.status]}
          {project.lead ? ` · ${project.lead.name}` : ''}
          {project.targetEndDate ? ` · ${formatDay(project.targetEndDate)}` : ''}
          {` · открытых ${project.openTaskCount}`}
        </p>
      </div>
      {project.signal ? (
        <Badge variant={signalVariant(project.signal)}>{PROJECT_SIGNAL_LABEL[project.signal]}</Badge>
      ) : (
        <Badge variant="muted">Закрыт</Badge>
      )}
    </ContentCard>
  )
}
