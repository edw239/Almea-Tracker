import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { Select } from '../components/Select'
import { CardSkeleton } from '../components/ui/Skeleton'
import { Tabs } from '../components/ui/tabs'
import { ACCOUNT_ROLE_LABEL } from '../lib/account-role'
import { api, ApiError, type MeActivity, type MeProfile, type MeSummary, type NotificationSettings } from '../lib/api'
import { formatDateTime, initialsFromName } from '../lib/format'

type MeTab = 'overview' | 'profile' | 'access' | 'notifications' | 'security'

const TAB_LABEL: Record<MeTab, string> = {
  overview: 'Сводка',
  profile: 'Профиль',
  access: 'Доступы',
  notifications: 'Уведомления',
  security: 'Безопасность',
}

const ROLE_LABEL: Record<string, string> = {
  ...ACCOUNT_ROLE_LABEL,
  OWNER: 'Владелец',
  VIEWER: 'Наблюдатель',
}

const CODE_LABEL: Record<string, string> = {
  TASK_ASSIGNED: 'Назначение',
  TASK_DUE_SOON: 'Срок скоро',
  TASK_OVERDUE: 'Просрочено',
  TASK_MENTION: 'Упоминание',
  TASK_COMMENT: 'Комментарий',
  TASK_REMINDER: 'Напоминание',
  TASK_STATUS_CHANGED: 'Смена статуса',
  TASK_REVIEW_REQUESTED: 'На проверке',
}

function parseTab(raw: string | null): MeTab {
  if (
    raw === 'access' ||
    raw === 'security' ||
    raw === 'notifications' ||
    raw === 'profile' ||
    raw === 'overview'
  ) {
    return raw
  }
  return 'overview'
}

export function MePage() {
  const auth = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get('tab'))
  const [profile, setProfile] = useState<MeProfile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const data = await api.profile()
        if (!cancelled) setProfile(data)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.message : 'Не удалось загрузить профиль')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setTab = (next: MeTab) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'overview') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const profileMeta = profile ? (
    <div className="flex items-center gap-3 rounded-full bg-surface px-3 py-2">
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {initialsFromName(profile.name)}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">{profile.name}</p>
        <p className="text-muted-foreground">{profile.email}</p>
      </div>
    </div>
  ) : null

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Личный кабинет"
        title="Мой профиль"
        subtitle="Сводка нагрузки, профиль, доступы, уведомления и пароль."
        meta={profileMeta}
        toolbar={
          <Tabs
            items={(Object.keys(TAB_LABEL) as MeTab[]).map((key) => ({ id: key, label: TAB_LABEL[key] }))}
            value={tab}
            onChange={(id) => setTab(id as MeTab)}
          />
        }
      />

      <div className="space-y-4">
        {loading ? <CardSkeleton /> : null}
        {loadError ? <LoadErrorNotice message={loadError} /> : null}

        {!loading && tab === 'overview' ? <OverviewTab /> : null}

        {!loading && profile && tab === 'profile' ? (
          <ProfileTab
            profile={profile}
            onSaved={(next) => {
              setProfile((current) =>
                current
                  ? {
                      ...current,
                      ...next,
                      memberships: current.memberships,
                    }
                  : current,
              )
              auth.patchUser({ name: next.name })
            }}
          />
        ) : null}

        {!loading && profile && tab === 'access' ? <AccessTab profile={profile} /> : null}

        {!loading && tab === 'notifications' ? <NotificationsTab /> : null}

        {!loading && profile && tab === 'security' ? (
          <SecurityTab
            profile={profile}
            onChanged={() => {
              setProfile((current) =>
                current
                  ? { ...current, passwordChangedAt: new Date().toISOString() }
                  : current,
              )
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

function OverviewTab() {
  const [summary, setSummary] = useState<MeSummary | null>(null)
  const [activity, setActivity] = useState<MeActivity | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [sum, act] = await Promise.all([api.meSummary(), api.meActivity({ days: 7, limit: 20 })])
        if (cancelled) return
        setSummary(sum)
        setActivity(act)
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить сводку')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <p className="form-error">{error}</p>
  if (!summary || !activity) return <p className="muted">Загрузка…</p>

  return (
    <div className="me-overview">
      <p className="muted me-meta">
        Таймзона {summary.timezone} · на {formatDateTime(summary.asOf)}
      </p>
      <div className="stats">
        <div className="stat">
          <b>{summary.overdue}</b>
          <span>просрочено</span>
        </div>
        <div className="stat">
          <b>{summary.today}</b>
          <span>сегодня</span>
        </div>
        <div className="stat">
          <b>{summary.week}</b>
          <span>на неделе</span>
        </div>
        <div className="stat">
          <b>{summary.inProgress}</b>
          <span>в работе</span>
        </div>
        <div className="stat">
          <b>{summary.mineOpen}</b>
          <span>открытых</span>
        </div>
        <div className="stat">
          <b>{summary.untriaged ?? 0}</b>
          <span>неразобранных</span>
        </div>
        <div className="stat">
          <b>{summary.unread}</b>
          <span>непрочитанных</span>
        </div>
      </div>

      <section className="group">
        <div className="group-h">
          <h2>За 7 дней</h2>
        </div>
        <div className="stats">
          <div className="stat">
            <b>{activity.closed}</b>
            <span>закрыто</span>
          </div>
          <div className="stat">
            <b>{activity.comments}</b>
            <span>комментариев</span>
          </div>
          <div className="stat">
            <b>{activity.updates}</b>
            <span>обновлений</span>
          </div>
        </div>
      </section>

      <section className="group">
        <div className="group-h">
          <h2>Недавние действия</h2>
          <span>{activity.items.length}</span>
        </div>
        {activity.items.length === 0 ? (
          <p className="muted">Пока нет активности.</p>
        ) : (
          <div className="card-list">
            {activity.items.map((item) => (
              <Link key={item.id} to={`/tasks/${item.taskId}`} className="task-row me-access-row">
                <strong>{item.taskTitle}</strong>
                <span className="muted">
                  {item.action} · {formatDateTime(item.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ProfileTab({
  profile,
  onSaved,
}: {
  profile: MeProfile
  onSaved: (next: Omit<MeProfile, 'memberships'>) => void
}) {
  const [name, setName] = useState(profile.name)
  const [timezone, setTimezone] = useState(profile.timezone)
  const [locale, setLocale] = useState<'ru' | 'en'>(profile.locale === 'en' ? 'en' : 'ru')
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    setName(profile.name)
    setTimezone(profile.timezone)
    setLocale(profile.locale === 'en' ? 'en' : 'ru')
    setJobTitle(profile.jobTitle ?? '')
  }, [profile])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setOk(false)
    try {
      const updated = await api.updateProfile({
        name: name.trim(),
        timezone: timezone.trim(),
        locale,
        jobTitle: jobTitle.trim() === '' ? null : jobTitle.trim(),
      })
      onSaved(updated)
      setOk(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="me-panel" onSubmit={(event) => void onSubmit(event)}>
      <div className="field">
        <label htmlFor="me-name">Имя</label>
        <input
          id="me-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="me-job">Должность</label>
        <input
          id="me-job"
          value={jobTitle}
          onChange={(event) => setJobTitle(event.target.value)}
          maxLength={120}
          placeholder="Необязательно"
        />
      </div>
      <div className="field">
        <label htmlFor="me-tz">Таймзона (IANA)</label>
        <input
          id="me-tz"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          list="me-tz-list"
          required
        />
        <datalist id="me-tz-list">
          <option value="Asia/Dubai" />
          <option value="Europe/Moscow" />
          <option value="Europe/Samara" />
          <option value="Asia/Almaty" />
          <option value="UTC" />
        </datalist>
      </div>
      <div className="field">
        <label htmlFor="me-locale">Язык</label>
        <Select
          id="me-locale"
          value={locale}
          options={[
            { value: 'ru', label: 'Русский' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(next) => setLocale(next === 'en' ? 'en' : 'ru')}
        />
      </div>
      <div className="field">
        <label>Email</label>
        <input value={profile.email} disabled readOnly />
      </div>
      <div className="field">
        <label>Роль</label>
        <input value={ROLE_LABEL[profile.role] ?? profile.role} disabled readOnly />
      </div>
      <p className="muted me-meta">В системе с {formatDateTime(profile.createdAt)}</p>
      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">Сохранено</p> : null}
      <button className="pill" type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  )
}

function minutesToTime(minutes: number | null): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMinutes(value: string): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return null
  return h * 60 + m
}

function NotificationsTab() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [quietFrom, setQuietFrom] = useState('')
  const [quietTo, setQuietTo] = useState('')
  const [snooze, setSnooze] = useState('4')
  const [codes, setCodes] = useState<Array<{ code: string; inApp: boolean }>>([])
  const [pending, setPending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await api.notificationSettings()
        if (cancelled) return
        setSettings(data)
        setCodes(data.codes)
        setQuietFrom(minutesToTime(data.quietHoursFrom))
        setQuietTo(minutesToTime(data.quietHoursTo))
        setSnooze(String(data.snoozeHoursDefault))
      } catch (caught) {
        if (!cancelled) {
          setLoadError(caught instanceof ApiError ? caught.message : 'Не удалось загрузить настройки')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setOk(false)
    const from = timeToMinutes(quietFrom)
    const to = timeToMinutes(quietTo)
    if ((quietFrom && from == null) || (quietTo && to == null)) {
      setError('Тихие часы: формат ЧЧ:ММ')
      return
    }
    if ((from == null) !== (to == null)) {
      setError('Укажите оба конца тихих часов или очистите оба')
      return
    }
    const snoozeHours = Number(snooze)
    if (!Number.isInteger(snoozeHours) || snoozeHours < 1 || snoozeHours > 168) {
      setError('Snooze: целое число 1…168')
      return
    }
    setPending(true)
    try {
      const saved = await api.putNotificationSettings({
        codes,
        quietHoursFrom: from,
        quietHoursTo: to,
        snoozeHoursDefault: snoozeHours,
      })
      setSettings(saved)
      setCodes(saved.codes)
      setOk(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  if (loadError) return <p className="form-error">{loadError}</p>
  if (!settings) return <p className="muted">Загрузка…</p>

  return (
    <form className="me-panel me-panel-wide" onSubmit={(event) => void onSubmit(event)}>
      <p className="page-lead">
        Выключенный тип не попадает в Inbox. В тихие часы уведомление откладывается до конца окна
        (таймзона из профиля).
      </p>
      <div className="me-toggle-list">
        {codes.map((item) => (
          <label key={item.code} className="me-toggle-row">
            <span>{CODE_LABEL[item.code] ?? item.code}</span>
            <input
              type="checkbox"
              checked={item.inApp}
              onChange={(event) => {
                const checked = event.target.checked
                setCodes((current) =>
                  current.map((row) => (row.code === item.code ? { ...row, inApp: checked } : row)),
                )
              }}
            />
          </label>
        ))}
      </div>
      <div className="field">
        <label htmlFor="me-quiet-from">Тихие часы с</label>
        <input
          id="me-quiet-from"
          type="time"
          value={quietFrom}
          onChange={(event) => setQuietFrom(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="me-quiet-to">Тихие часы до</label>
        <input
          id="me-quiet-to"
          type="time"
          value={quietTo}
          onChange={(event) => setQuietTo(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="me-snooze">Snooze по умолчанию (часы)</label>
        <input
          id="me-snooze"
          type="number"
          min={1}
          max={168}
          value={snooze}
          onChange={(event) => setSnooze(event.target.value)}
          required
        />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">Сохранено</p> : null}
      <button className="pill" type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить'}
      </button>
    </form>
  )
}

function AccessTab({ profile }: { profile: MeProfile }) {
  if (profile.memberships.length === 0) {
    return (
      <div className="me-panel">
        <p className="muted">Нет membership в пространствах. Системные пространства могут быть доступны иначе.</p>
      </div>
    )
  }
  return (
    <section className="group">
      <div className="group-h">
        <h2>Пространства</h2>
        <span>{profile.memberships.length}</span>
      </div>
      <div className="card-list">
        {profile.memberships.map((row) => (
          <Link key={row.spaceId} to={`/spaces/${row.spaceId}`} className="task-row me-access-row">
            <strong>{row.spaceName}</strong>
            <span className="muted">
              {ROLE_LABEL[row.role] ?? row.role}
              {row.isSystem ? ' · системное' : ''}
              {row.systemKey ? ` · ${row.systemKey}` : ''}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

function SecurityTab({
  profile,
  onChanged,
}: {
  profile: MeProfile
  onChanged: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setOk(false)
    if (newPassword !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    if (newPassword.length < 8) {
      setError('Новый пароль: минимум 8 символов')
      return
    }
    setPending(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setOk(true)
      onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сменить пароль')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="me-panel" onSubmit={(event) => void onSubmit(event)}>
      <p className="page-lead">
        После смены пароля текущая сессия обновляется, а старые cookie перестают работать.
        {profile.passwordChangedAt
          ? ` Последняя смена: ${formatDateTime(profile.passwordChangedAt)}.`
          : ' Пароль ещё не меняли после создания аккаунта.'}
      </p>
      <div className="field">
        <label htmlFor="me-cur">Текущий пароль</label>
        <input
          id="me-cur"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="me-new">Новый пароль</label>
        <input
          id="me-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="me-confirm">Повтор нового пароля</label>
        <input
          id="me-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          minLength={8}
          required
        />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">Пароль обновлён</p> : null}
      <button className="pill" type="submit" disabled={pending}>
        {pending ? 'Меняем…' : 'Сменить пароль'}
      </button>
    </form>
  )
}
