import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { api, ApiError, type AuthUser } from './lib/api'

type AuthValue = {
  user: AuthUser | null
  ready: boolean
  bootError: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const me = await api.me()
        if (!cancelled) setUser(me)
      } catch (error) {
        if (cancelled) return
        setUser(null)
        if (error instanceof ApiError && error.status >= 500) {
          setBootError('API недоступен. Поднимите Nest (`api`, порт из WEB proxy / .env).')
        } else if (!(error instanceof ApiError && error.status === 401)) {
          setBootError('Не удалось проверить сессию. Проверьте, что API запущен (сейчас обычно :3002).')
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      bootError,
      login: async (email, password) => {
        const result = await api.login(email, password)
        setUser(result.user)
        setBootError(null)
      },
      logout: async () => {
        await api.logout()
        setUser(null)
      },
    }),
    [bootError, ready, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider missing')
  return ctx
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (!auth.ready) {
    return <div className="login-screen muted">Загрузка…</div>
  }
  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return children
}
