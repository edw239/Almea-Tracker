import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'

export function BrowsePage() {
  const { key = '' } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    void api.taskByKey(key).then((task) => navigate(`/tasks/${task.id}`, { replace: true })).catch(() => navigate('/', { replace: true }))
  }, [key, navigate])
  return <p className="p-6 text-sm text-muted-foreground">Открываем {key}…</p>
}
