import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api, ApiError } from '../lib/api'

export function ForcePasswordChangePage() {
  const auth = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!auth.user) {
    return <Navigate to="/login" replace />
  }
  if (!auth.user.mustChangePassword) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
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
      await auth.refreshUser()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сменить пароль')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={(event) => void onSubmit(event)}>
        <div className="brand">
          <span className="brand-name">almea</span>
          <span className="brand-meta">tracker</span>
        </div>
        <h1 className="page-title">Смените пароль</h1>
        <p className="page-lead">
          Вам выдан временный пароль. Дальше в трекер можно только со своим.
        </p>
        <div className="field">
          <label htmlFor="tmp-cur">Временный пароль</label>
          <input
            id="tmp-cur"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="tmp-new">Новый пароль</label>
          <input
            id="tmp-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="tmp-confirm">Повтор</label>
          <input
            id="tmp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={8}
            required
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="pill" type="submit" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Продолжить'}
        </button>
        <button className="text-btn" type="button" onClick={() => void auth.logout()}>
          Выйти
        </button>
      </form>
    </div>
  )
}
