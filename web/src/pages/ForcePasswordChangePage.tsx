import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { BrandMark } from '../components/BrandMark'
import { Button } from '../components/ui/button'
import { FormNotice } from '../components/ui/form-notice'
import { Input } from '../components/ui/input'
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
    <div className="flex min-h-screen items-center justify-center bg-base p-6">
      <form
        className="surface-card w-full max-w-md space-y-5 rounded p-8"
        onSubmit={(event) => void onSubmit(event)}
      >
        <BrandMark />
        <div>
          <h1 className="text-display-lg text-foreground">Смените пароль</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Вам выдан временный пароль. Дальше в трекер можно только со своим.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="tmp-cur">
            Временный пароль
          </label>
          <Input
            id="tmp-cur"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="tmp-new">
            Новый пароль
          </label>
          <Input
            id="tmp-new"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="tmp-confirm">
            Повтор
          </label>
          <Input
            id="tmp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={8}
            required
          />
        </div>
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Сохраняем…' : 'Продолжить'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => void auth.logout()}>
          Выйти
        </Button>
      </form>
    </div>
  )
}
