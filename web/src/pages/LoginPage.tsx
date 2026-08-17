import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('admin@almea.ru')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

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
    <div className="login-screen">
      <form className="login-card" onSubmit={(event) => void onSubmit(event)}>
        <div className="brand">
          <span className="brand-name">almea</span>
          <span className="brand-meta">tracker</span>
        </div>
        <h1 className="page-title">Вход</h1>
        <p className="page-lead">Сессия в httpOnly cookie. Пароль в браузере не хранится.</p>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="pill" type="submit" disabled={pending}>
          {pending ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
