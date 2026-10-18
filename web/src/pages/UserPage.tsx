import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { StatCard, StatTiles } from '../components/StatCard'
import { TaskRow } from '../components/ui'
import { Button } from '../components/ui/button'
import { CardSkeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useAuth } from '../auth'
import { ACCOUNT_ROLE_LABEL } from '../lib/account-role'
import { api, ApiError } from '../lib/api'
import { initialsFromName } from '../lib/format'
import { Flame, ListTodo, User } from '../lib/icons'
import { mapApiTask } from '../lib/mappers'
import type { Task } from '../types'

type ColleagueProfile = {
  id: string
  name: string
  role: string
  jobTitle: string | null
  stats: { open: number; overdue: number; shown: number } | null
  tasks: Task[]
}

const ROLE_LABEL: Record<string, string> = { ...ACCOUNT_ROLE_LABEL }

export function UserPage() {
  const { userId } = useParams<{ userId: string }>()
  const auth = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ColleagueProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await api.user(userId)
        if (cancelled) return
        setProfile({
          id: data.id,
          name: data.name,
          role: data.role,
          jobTitle: data.jobTitle,
          stats: data.stats,
          tasks: data.tasks.map(mapApiTask),
        })
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить профиль')
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (userId && auth.user?.id === userId) {
    return <Navigate to="/me" replace />
  }

  const metaChip = profile ? (
    <div className="flex items-center gap-3 rounded-full bg-surface px-3 py-2">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initialsFromName(profile.name)}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">{profile.name}</p>
        <p className="text-muted-foreground">
          {ROLE_LABEL[profile.role] ?? profile.role}
          {profile.jobTitle ? ` · ${profile.jobTitle}` : ''}
        </p>
      </div>
    </div>
  ) : null

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Коллега"
        title={profile?.name ?? 'Профиль'}
        subtitle="Только задачи, видимые вам. Чужие пространства не показываем (404-инвариант)."
        meta={metaChip}
      />

      {error ? <LoadErrorNotice message={error} /> : null}

      {loading ? <CardSkeleton /> : null}

      {profile?.stats ? (
        <StatTiles>
          <StatCard title="открытых" value={String(profile.stats.open)} icon={ListTodo} />
          <StatCard title="просрочено" value={String(profile.stats.overdue)} icon={Flame} />
          <StatCard title="в списке" value={String(profile.stats.shown)} icon={User} />
        </StatTiles>
      ) : null}

      {!loading && profile && profile.tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Нет общих видимых задач"
          description="С этим коллегой пока нет пересечений по задачам."
        />
      ) : null}

      {profile?.tasks.length ? (
        <div className="space-y-1 rounded bg-surface p-1">
          {profile.tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <Button variant="link" size="sm" className="h-auto p-0" asChild>
          <Link to="/">← к My Work</Link>
        </Button>
      </p>
    </div>
  )
}
