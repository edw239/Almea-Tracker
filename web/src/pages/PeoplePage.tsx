import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ContentCard } from '../components/ContentCard'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { Select } from '../components/Select'
import { Button } from '../components/ui/button'
import { FormNotice } from '../components/ui/form-notice'
import { Input } from '../components/ui/input'
import { StickyFormActions } from '../components/StickyFormActions'
import { ACCOUNT_ROLE_LABEL, type AccountRole } from '../lib/account-role'
import { api, ApiError, type DirectoryUser } from '../lib/api'
import { initialsFromName } from '../lib/format'

export function PeoplePage() {
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState<AccountRole>('MEMBER')
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
    <div className="space-y-6">
      <PageHeader
        overline="Компания"
        title="Люди"
        subtitle="Админ заводит сотрудника и передаёт одноразовый пароль лично. SMTP нет."
      />

      {loadError ? <LoadErrorNotice message={loadError} onRetry={() => void reload()} /> : null}

      {revealed ? (
        <ContentCard className="space-y-3 border-accent/20 bg-accent-soft">
          <p className="text-sm text-foreground" role="status">
            Одноразовый пароль для <strong>{revealed.email}</strong> — покажите его один раз, в трекере он
            больше не появится.
          </p>
          <code className="block rounded bg-inset px-3 py-2 font-mono text-sm">{revealed.password}</code>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void copyPassword()}>
              {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRevealed(null)}>
              Скрыть
            </Button>
          </div>
        </ContentCard>
      ) : null}

      <ContentCard className="relative space-y-4 p-6">
        <h2 className="text-lg font-medium text-foreground">Новый сотрудник</h2>
        <form className="space-y-4" onSubmit={(event) => void onCreate(event)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="people-email">
                Email
              </label>
              <Input
                id="people-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="people-name">
                Имя
              </label>
              <Input
                id="people-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="people-title">
                Должность
              </label>
              <Input
                id="people-title"
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="people-role">
                Роль
              </label>
              <Select
                id="people-role"
                value={role}
                options={[
                  { value: 'MEMBER', label: ACCOUNT_ROLE_LABEL.MEMBER },
                  { value: 'PROJECT_MANAGER', label: ACCOUNT_ROLE_LABEL.PROJECT_MANAGER },
                  { value: 'GLOBAL_ADMIN', label: ACCOUNT_ROLE_LABEL.GLOBAL_ADMIN },
                ]}
                onChange={(next) => setRole(next as AccountRole)}
              />
            </div>
          </div>
          {formError ? <FormNotice tone="error">{formError}</FormNotice> : null}
          <StickyFormActions className="-mx-6 sm:-mx-7">
            <Button type="submit" disabled={pending}>
              {pending ? 'Создаём…' : 'Создать'}
            </Button>
          </StickyFormActions>
        </form>
      </ContentCard>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-medium text-foreground">Сотрудники</h2>
          <span className="text-sm text-muted-foreground">{users.length}</span>
        </div>
        <div className="space-y-1 rounded bg-surface p-1">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center gap-3 rounded px-3 py-2.5 hover:bg-inset"
            >
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                aria-hidden
              >
                {initialsFromName(user.name)}
              </span>
              <div className="min-w-0 flex-1">
                <Link className="font-medium text-link hover:underline" to={`/users/${user.id}`}>
                  {user.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {user.email}
                  {user.jobTitle ? ` · ${user.jobTitle}` : ''}
                  {' · '}
                  {ACCOUNT_ROLE_LABEL[user.role] ?? user.role}
                  {user.isActive ? '' : ' · отключён'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="compact" onClick={() => void onReset(user)}>
                  Сбросить пароль
                </Button>
                <Button type="button" variant="ghost" size="compact" onClick={() => void onToggleActive(user)}>
                  {user.isActive ? 'Отключить' : 'Включить'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
