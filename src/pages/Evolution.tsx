import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, LineChart as LineIcon, Trophy } from 'lucide-react'
import { db } from '../db'
import { exerciseList, exerciseSeries, loadDataset, setVolume, type ExercisePoint } from '../lib/stats'
import { setsCSV } from '../lib/csv'
import { BarChart, LineChart } from '../components/Charts'
import { Empty, PageHeader, Stat } from '../components/ui'
import { addDays, downloadBlob, fmtNum, formatDate, formatDateShort, formatDuration, todayISO, weekStart } from '../lib/utils'

type MetricKey = 'maxLoad' | 'e1rm' | 'volume' | 'maxReps' | 'totalReps' | 'maxTime' | 'maxDistance'

const METRICS: { key: MetricKey; label: string; unit: string; time?: boolean }[] = [
  { key: 'maxLoad', label: 'Carga máx.', unit: ' kg' },
  { key: 'e1rm', label: '1RM estimada', unit: ' kg' },
  { key: 'volume', label: 'Volume', unit: ' kg' },
  { key: 'maxReps', label: 'Reps máx.', unit: '' },
  { key: 'totalReps', label: 'Reps totais', unit: '' },
  { key: 'maxTime', label: 'Tempo máx.', unit: '', time: true },
  { key: 'maxDistance', label: 'Distância máx.', unit: ' m' },
]

export default function Evolution() {
  const [projectId, setProjectId] = useState('')
  const [exKey, setExKey] = useState('')
  const [metric, setMetric] = useState<MetricKey>('maxLoad')

  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])
  const ds = useLiveQuery(() => loadDataset(projectId || undefined), [projectId])

  const exList = useMemo(() => (ds ? exerciseList(ds) : []), [ds])
  const activeKey = exList.find((e) => e.key === exKey)?.key ?? exList[0]?.key ?? ''
  const series = useMemo(() => (ds && activeKey ? exerciseSeries(ds, activeKey) : []), [ds, activeKey])

  const available = METRICS.filter((m) => series.some((p) => (p[m.key] ?? 0) > 0))
  const activeMetric = available.find((m) => m.key === metric) ?? available[0]

  if (!ds || !projects) return null

  const today = todayISO()
  const ws = weekStart(today)
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(ws, (i - 11) * 7))
  const perWeek = weeks.map((w) => ({
    label: formatDateShort(w),
    value: ds.sessions.filter((s) => s.date >= w && s.date < addDays(w, 7)).length,
  }))
  const last30 = ds.sessions.filter((s) => s.date > addDays(today, -30)).length
  const totalVolume = ds.sets.reduce((a, s) => a + setVolume(s), 0)

  const values = activeMetric
    ? series.filter((p) => p[activeMetric.key] != null && (p[activeMetric.key] as number) > 0)
    : []
  const chartData = values.map((p) => ({ label: formatDateShort(p.date), value: p[activeMetric!.key] as number }))
  const fmt = (v?: number) => (v == null ? '—' : activeMetric?.time ? formatDuration(v) : fmtNum(v, 1) + (activeMetric?.unit ?? ''))
  const first = chartData[0]?.value
  const last = chartData[chartData.length - 1]?.value
  const best = chartData.length ? Math.max(...chartData.map((d) => d.value)) : undefined
  const change = first && last ? ((last - first) / first) * 100 : undefined

  const exportCsv = async () => {
    const p = projects.find((x) => x.id === projectId)
    downloadBlob(await setsCSV(projectId || undefined), `brodemy-series${p ? '-' + p.name : ''}-${today}.csv`)
  }

  return (
    <div className="page">
      <PageHeader
        title="Evolução"
        subtitle="Seus indicadores de progresso"
        right={
          <button className="icon-btn" onClick={exportCsv} aria-label="Exportar CSV">
            <Download size={20} />
          </button>
        }
      />

      <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        <option value="">Todos os projetos</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {ds.sessions.length === 0 ? (
        <Empty icon={<LineIcon size={32} />} title="Ainda sem dados">
          Registre treinos para ver sua evolução aqui.
        </Empty>
      ) : (
        <>
          <div className="stats-grid" style={{ marginTop: 12 }}>
            <Stat label="Treinos" value={ds.sessions.length} />
            <Stat label="Em 30 dias" value={last30} />
            <Stat label="Séries" value={ds.sets.length} />
            <Stat label="Volume (kg)" value={fmtNum(totalVolume, 0)} />
          </div>

          <div className="section-label">Frequência semanal</div>
          <div className="card">
            <BarChart data={perWeek} />
          </div>

          <div className="section-label">Por exercício</div>
          {exList.length === 0 ? (
            <div className="muted small">Registre séries para acompanhar cada exercício.</div>
          ) : (
            <div className="card stack">
              <select className="input" value={activeKey} onChange={(e) => setExKey(e.target.value)}>
                {exList.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.name} ({e.count}×)
                  </option>
                ))}
              </select>
              {available.length > 0 && (
                <div className="chips scroll-x">
                  {available.map((m) => (
                    <button
                      key={m.key}
                      className={'chip' + (activeMetric?.key === m.key ? ' active' : '')}
                      onClick={() => setMetric(m.key)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
              {activeMetric && (
                <LineChart data={chartData} unit={activeMetric.time ? 's' : activeMetric.unit.trim()} />
              )}
              <div className="stats-row">
                <Stat label="Primeiro" value={fmt(first)} />
                <Stat label="Último" value={fmt(last)} />
                <Stat
                  label="Variação"
                  value={
                    change == null ? '—' : (
                      <span className={change >= 0 ? 'up' : 'down'}>
                        {change >= 0 ? '+' : ''}
                        {fmtNum(change, 1)}%
                      </span>
                    )
                  }
                />
              </div>
              {best != null && (
                <div className="pr-line">
                  <Trophy size={16} /> Recorde: <strong>{fmt(best)}</strong>
                </div>
              )}
              <HistoryTable points={series} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function HistoryTable({ points }: { points: ExercisePoint[] }) {
  const [all, setAll] = useState(false)
  const rows = [...points].reverse()
  const shown = all ? rows : rows.slice(0, 6)
  return (
    <div className="mini-table">
      <div className="mini-row head">
        <span>Data</span>
        <span>Séries</span>
        <span>Carga máx.</span>
        <span>Reps máx.</span>
      </div>
      {shown.map((p) => (
        <Link key={p.sessionId} to={`/sessao/${p.sessionId}`} className="mini-row">
          <span>{formatDate(p.date)}</span>
          <span>{p.sets}</span>
          <span>{p.maxLoad != null ? fmtNum(p.maxLoad) + ' kg' : '—'}</span>
          <span>{p.maxReps ?? (p.maxTime != null ? formatDuration(p.maxTime) : '—')}</span>
        </Link>
      ))}
      {rows.length > 6 && (
        <button className="btn btn-ghost btn-sm" onClick={() => setAll(!all)}>
          {all ? 'Mostrar menos' : `Ver todos (${rows.length})`}
        </button>
      )}
    </div>
  )
}
