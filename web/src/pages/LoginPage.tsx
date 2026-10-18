import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { BrandMark } from '../components/BrandMark'
import { Button } from '../components/ui/button'
import { FormNotice } from '../components/ui/form-notice'
import { Input } from '../components/ui/input'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('admin@almea.ru')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (auth.user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }
  if (auth.user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await auth.login(email.trim(), password)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось войти')
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
          <h1 className="text-display-lg text-foreground">Вход</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Сессия в httpOnly cookie. Пароль в браузере не хранится.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="password">
            Пароль
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>
        {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Входим…' : 'Войти'}
        </Button>
      </form>
    </div>
  )
}
