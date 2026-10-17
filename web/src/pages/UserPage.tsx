import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { TaskRow } from '../components/ui'
import { useAuth } from '../auth'
import { api, ApiError } from '../lib/api'
import { initialsFromName } from '../lib/format'
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

const ROLE_LABEL: Record<string, string> = {
  GLOBAL_ADMIN: 'Глобальный админ',
  MEMBER: 'Участник',
}

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

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Коллега</div>
          <h1 className="page-title">{profile?.name ?? 'Профиль'}</h1>
          <p className="page-lead">
            Только задачи, видимые вам. Чужие пространства не показываем (404-инвариант).
          </p>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
        {profile ? (
          <div className="me-hero-chip" aria-hidden>
            <span className="avatar lg">{initialsFromName(profile.name)}</span>
            <div>
              <strong>{profile.name}</strong>
              <small>
                {ROLE_LABEL[profile.role] ?? profile.role}
                {profile.jobTitle ? ` · ${profile.jobTitle}` : ''}
              </small>
            </div>
          </div>
        ) : null}
      </header>
      <div className="content">
        {loading ? <p className="muted">Загрузка…</p> : null}
        {profile?.stats ? (
          <div className="stats">
            <div className="stat">
              <b>{profile.stats.open}</b>
              <span>открытых (видимых)</span>
            </div>
            <div className="stat">
              <b>{profile.stats.overdue}</b>
              <span>просрочено</span>
            </div>
            <div className="stat">
              <b>{profile.stats.shown}</b>
              <span>в списке</span>
            </div>
          </div>
        ) : null}
        {!loading && profile && profile.tasks.length === 0 ? (
          <p className="muted">Нет общих видимых задач.</p>
        ) : null}
        <div className="card-list">
          {profile?.tasks.map((task) => (
            <TaskRow key={task.id} task={task} onOpen={() => navigate(`/tasks/${task.id}`)} />
          ))}
        </div>
        <p className="muted me-meta">
          <Link to="/">← к My Work</Link>
        </p>
      </div>
    </>
  )
}
