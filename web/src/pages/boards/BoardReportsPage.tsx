import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart, Area, AreaChart } from 'recharts'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { api } from '../../lib/api'
import type { BurndownPayload, SprintReportPayload } from '../../lib/board-types'

export function BoardReportsPage() {
  const { boardId = '' } = useParams()
  const [burndown, setBurndown] = useState<BurndownPayload | null>(null)
  const [report, setReport] = useState<SprintReportPayload | null>(null)
  const [velocity, setVelocity] = useState<Array<{ name: string; commitment: number; completed: number }>>([])
  const [cfd, setCfd] = useState<Array<Record<string, string | number>>>([])
  const [cycle, setCycle] = useState<{ median: number | null; approximate: boolean } | null>(null)
  const [metric, setMetric] = useState<'points' | 'count'>('points')

  useEffect(() => {
    void api.boardBurndown(boardId, metric).then(setBurndown).catch(() => setBurndown(null))
    void api.boardSprintReport(boardId).then(setReport).catch(() => setReport(null))
    void api.boardVelocity(boardId).then((payload) => setVelocity(payload.sprints)).catch(() => setVelocity([]))
    void api.boardCfd(boardId).then((payload) => {
      const byDate = new Map<string, Record<string, string | number>>()
      for (const point of payload.points) {
        const row = byDate.get(point.date) ?? { date: point.date }
        row[point.column] = point.count
        byDate.set(point.date, row)
      }
      setCfd([...byDate.values()])
    })
    void api.boardCycle(boardId).then((payload) => setCycle({ median: payload.median, approximate: payload.approximate }))
  }, [boardId, metric])

  return (
    <div className="space-y-8">
      <PageHeader
        overline="Отчёты"
        title="Отчёты"
        toolbar={
          <Button variant="ghost" size="compact" asChild>
            <Link to={`/boards/${boardId}`}>К доске</Link>
          </Button>
        }
      />
      {(burndown?.approximate || report?.approximate || cycle?.approximate) ? (
        <p className="text-sm text-muted-foreground">История до появления досок приближённая: у старых задач один синтетический переход.</p>
      ) : null}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Диаграмма сгорания</h2>
          <Button type="button" size="compact" variant={metric === 'points' ? 'secondary' : 'ghost'} onClick={() => setMetric('points')}>Оценка</Button>
          <Button type="button" size="compact" variant={metric === 'count' ? 'secondary' : 'ghost'} onClick={() => setMetric('count')}>Количество</Button>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={burndown?.points ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line dataKey="remaining" name="Осталось" stroke="var(--foreground)" />
              <Line dataKey="guideline" name="Идеально" stroke="var(--muted-foreground)" />
              <Line dataKey="scope" name="Объём" stroke="var(--primary)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      {report ? (
        <section>
          <h2 className="text-lg font-medium">Отчёт о спринте {report.sprint.name}</h2>
          <p className="text-sm text-muted-foreground">{report.sprint.goal}</p>
          <p>Обязательство {report.commitment} · Готово {report.completed} · Не готово {report.incomplete} · Добавлено {report.added} · Убрано {report.removed}</p>
        </section>
      ) : null}
      <section className="h-64">
        <h2 className="text-lg font-medium">Скорость</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={velocity}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="commitment" name="Обязательство" fill="var(--muted-foreground)" />
            <Bar dataKey="completed" name="Завершено" fill="var(--foreground)" />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <section className="h-64">
        <h2 className="text-lg font-medium">Накопительная диаграмма потока</h2>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={cfd}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            {Object.keys(cfd[0] ?? {}).filter((key) => key !== 'date').map((key) => (
              <Area key={key} dataKey={key} stackId="1" fill="var(--muted-foreground)" stroke="var(--foreground)" />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </section>
      <section>
        <h2 className="text-lg font-medium">Контрольная диаграмма</h2>
        <p>Медиана времени цикла: {cycle?.median ?? '—'} дн.</p>
      </section>
    </div>
  )
}
