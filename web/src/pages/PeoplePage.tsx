import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Select } from '../components/Select'
import { api, ApiError, type DirectoryUser } from '../lib/api'
import { initialsFromName } from '../lib/format'

const ROLE_LABEL: Record<string, string> = {
  GLOBAL_ADMIN: 'Админ',
  MEMBER: 'Участник',
}

export function PeoplePage() {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState<'MEMBER' | 'GLOBAL_ADMIN'>('MEMBER')
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function reload() {
    const data = await api.users(true)
    setUsers(data)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await api.users(true)
        if (!cancelled) setUsers(data)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.message : 'Не удалось загрузить людей')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    setCopied(false)
    setPending(true)
    try {
      const created = await api.createUser({
        email: email.trim(),
        name: name.trim(),
        role,
        jobTitle: jobTitle.trim() || null,
      })
      setEmail('')
      setName('')
      setJobTitle('')
      setRole('MEMBER')
      setRevealed({ email: created.email, password: created.temporaryPassword })
      await reload()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Не удалось создать')
    } finally {
      setPending(false)
    }
  }

  async function onToggleActive(user: DirectoryUser) {
    setFormError(null)
    try {
      await api.updateUser(user.id, { isActive: !user.isActive })
      await reload()
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Не удалось изменить статус')
    }
  }

  async function onReset(user: DirectoryUser) {
    setFormError(null)
    setCopied(false)
    try {
      const reset = await api.resetUserPassword(user.id)
      setRevealed({ email: reset.email, password: reset.temporaryPassword })
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Не удалось сбросить пароль')
    }
  }

  async function copyPassword() {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div>
          <div className="kicker">Компания</div>
          <h1 className="page-title">Люди</h1>
          <p className="page-lead">
            Админ заводит сотрудника и передаёт одноразовый пароль лично. SMTP нет.
          </p>
        </div>
      </header>

      <div className="content">
        {loadError ? <p className="form-error">{loadError}</p> : null}

        {revealed ? (
          <div className="reveal-banner" role="status">
            <p>
              Одноразовый пароль для <strong>{revealed.email}</strong> — покажите его один раз, в трекере он
              больше не появится.
            </p>
            <code className="reveal-password">{revealed.password}</code>
            <div className="reveal-actions">
              <button className="pill" type="button" onClick={() => void copyPassword()}>
                {copied ? 'Скопировано' : 'Скопировать'}
              </button>
              <button className="text-btn" type="button" onClick={() => setRevealed(null)}>
                Скрыть
              </button>
            </div>
          </div>
        ) : null}

        <form className="me-panel me-panel-wide" onSubmit={(event) => void onCreate(event)}>
          <h2 className="group-h">Новый сотрудник</h2>
          <div className="field">
            <label htmlFor="people-email">Email</label>
            <input
              id="people-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="people-name">Имя</label>
            <input
              id="people-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="field">
            <label htmlFor="people-title">Должность</label>
            <input
              id="people-title"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="field">
            <label htmlFor="people-role">Роль</label>
            <Select
              id="people-role"
              value={role}
              options={[
                { value: 'MEMBER', label: 'Участник' },
                { value: 'GLOBAL_ADMIN', label: 'Админ' },
              ]}
              onChange={(next) => setRole(next as 'MEMBER' | 'GLOBAL_ADMIN')}
            />
          </div>
          {formError ? <p className="form-error">{formError}</p> : null}
          <button className="pill" type="submit" disabled={pending}>
            {pending ? 'Создаём…' : 'Создать'}
          </button>
        </form>

        <section className="group">
          <div className="group-h">
            <h2>Сотрудники</h2>
            <span>{users.length}</span>
          </div>
          <div className="card-list">
            {users.map((user) => (
              <div key={user.id} className="task-row people-row">
                <span className="avatar" aria-hidden>
                  {initialsFromName(user.name)}
                </span>
                <div className="people-meta">
                  <Link to={`/users/${user.id}`}>
                    <strong>{user.name}</strong>
                  </Link>
                  <span className="muted">
                    {user.email}
                    {user.jobTitle ? ` · ${user.jobTitle}` : ''}
                    {' · '}
                    {ROLE_LABEL[user.role] ?? user.role}
                    {user.isActive ? '' : ' · отключён'}
                  </span>
                </div>
                <div className="people-actions">
                  <button className="text-btn" type="button" onClick={() => void onReset(user)}>
                    Сбросить пароль
                  </button>
                  <button className="text-btn" type="button" onClick={() => void onToggleActive(user)}>
                    {user.isActive ? 'Отключить' : 'Включить'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
