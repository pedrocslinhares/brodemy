import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Dumbbell } from 'lucide-react'
import { db } from '../db'
import { setVolume } from '../lib/stats'
import { fmtNum, formatDate, monthLabel, parseISODate, WEEKDAYS_SHORT } from '../lib/utils'
import { Empty, TypeBadge } from './ui'

export function SessionList({ projectId }: { projectId?: string }) {
  const data = useLiveQuery(async () => {
    const sessions = projectId
      ? await db.sessions.where('projectId').equals(projectId).toArray()
      : await db.sessions.toArray()
    const ids = sessions.map((s) => s.id)
    const [sets, exercises, projects] = await Promise.all([
      db.sets.where('sessionId').anyOf(ids).toArray(),
      db.sessionExercises.where('sessionId').anyOf(ids).toArray(),
      db.projects.toArray(),
    ])
    sessions.sort((a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt)
    return { sessions, sets, exercises, projects: new Map(projects.map((p) => [p.id, p])) }
  }, [projectId])

  if (!data) return null
  if (!data.sessions.length)
    return (
      <Empty icon={<Dumbbell size={32} />} title="Nenhum treino registrado ainda">
        Os treinos que você registrar aparecem aqui.
      </Empty>
    )

  let lastMonth = ''
  return (
    <div className="stack-sm">
      {data.sessions.map((s) => {
        const month = monthLabel(s.date)
        const header = month !== lastMonth
        lastMonth = month
        const sets = data.sets.filter((x) => x.sessionId === s.id)
        const exCount = data.exercises.filter((e) => e.sessionId === s.id).length
        const volume = sets.reduce((a, x) => a + setVolume(x), 0)
        const project = data.projects.get(s.projectId)
        return (
          <div key={s.id}>
            {header && <div className="section-label">{month}</div>}
            <Link to={`/sessao/${s.id}`} className="card session-row">
              <div className="date-pill">
                <span>{WEEKDAYS_SHORT[parseISODate(s.date).getDay()]}</span>
                <strong>{s.date.slice(8, 10)}</strong>
              </div>
              <div className="grow min0">
                <div className="row gap-sm">
                  <strong className="ellipsis">{s.title}</strong>
                  {!s.finishedAt && <span className="badge accent">Em andamento</span>}
                </div>
                <div className="muted small ellipsis">
                  {formatDate(s.date)}
                  {!projectId && project && (
                    <>
                      {' · '}
                      <span style={{ color: project.color }}>{project.name}</span>
                    </>
                  )}
                </div>
                <div className="row gap-sm small muted wrap">
                  <TypeBadge type={s.type} />
                  <span>{exCount} exerc.</span>
                  <span>{sets.length} séries</span>
                  {volume > 0 && <span>{fmtNum(volume, 0)} kg</span>}
                </div>
              </div>
              <ChevronRight size={18} className="muted" />
            </Link>
          </div>
        )
      })}
    </div>
  )
}
