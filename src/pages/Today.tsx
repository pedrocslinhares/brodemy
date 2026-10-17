import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FolderPlus, Moon, Play, PlayCircle } from 'lucide-react'
import { db, type PlanDay, type Project } from '../db'
import { startSession } from '../lib/repo'
import { Empty, Stat, TypeBadge } from '../components/ui'
import { formatDate, todayISO, weekStart, WEEK_ORDER, WEEKDAYS } from '../lib/utils'

export default function Today() {
  const nav = useNavigate()
  const today = todayISO()
  const wd = new Date().getDay()

  const data = useLiveQuery(async () => {
    const projects = await db.projects.where('status').equals('active').sortBy('createdAt')
    const days = await db.planDays.toArray()
    const exercises = await db.planExercises.toArray()
    const sessions = await db.sessions.toArray()
    const counts: Record<string, number> = {}
    exercises.forEach((e) => (counts[e.dayId] = (counts[e.dayId] ?? 0) + 1))
    const open = sessions.filter((s) => !s.finishedAt).sort((a, b) => b.startedAt - a.startedAt)
    const ws = weekStart(today)
    const week = sessions.filter((s) => s.date >= ws && s.date <= today && s.finishedAt).length
    const month = sessions.filter((s) => s.date.slice(0, 7) === today.slice(0, 7) && s.finishedAt).length
    return { projects, days, counts, open, week, month, total: sessions.length }
  }, [today])

  const start = async (projectId: string, dayId?: string) => {
    const id = await startSession(projectId, dayId)
    nav(`/sessao/${id}`)
  }

  if (!data) return null
  const projectName = (id: string) => data.projects.find((p) => p.id === id)?.name ?? ''

  return (
    <div className="page">
      <header className="home-header">
        <div className="brand">
          <img src="./logo.svg" alt="" />
          <span>Brodemy</span>
        </div>
        <div className="muted">
          {WEEKDAYS[wd]}, {formatDate(today)}
        </div>
      </header>

      {data.total > 0 && (
        <div className="stats-row">
          <Stat label="Treinos na semana" value={data.week} />
          <Stat label="Treinos no mês" value={data.month} />
          <Stat label="Projetos ativos" value={data.projects.length} />
        </div>
      )}

      {data.open.map((s) => (
        <Link key={s.id} to={`/sessao/${s.id}`} className="card card-accent row gap">
          <PlayCircle size={34} />
          <div className="grow">
            <div className="small">Treino em andamento</div>
            <strong>{s.title}</strong>
            <div className="small muted-dark">
              {projectName(s.projectId)} · {formatDate(s.date)}
            </div>
          </div>
          <span className="btn btn-dark btn-sm">Continuar</span>
        </Link>
      ))}

      {data.projects.length === 0 ? (
        <Empty icon={<FolderPlus size={36} />} title="Comece criando um projeto">
          Um projeto reúne seu plano semanal, seus treinos e suas fotos de progresso.
          <div style={{ marginTop: 16 }}>
            <Link to="/projetos/novo" className="btn">
              Criar projeto
            </Link>
          </div>
        </Empty>
      ) : (
        data.projects.map((p) => (
          <ProjectToday
            key={p.id}
            project={p}
            days={data.days.filter((d) => d.projectId === p.id)}
            counts={data.counts}
            weekday={wd}
            onStart={start}
          />
        ))
      )}
    </div>
  )
}

function ProjectToday({ project, days, counts, weekday, onStart }: {
  project: Project
  days: PlanDay[]
  counts: Record<string, number>
  weekday: number
  onStart: (projectId: string, dayId?: string) => void
}) {
  const day = days.find((d) => d.weekday === weekday)
  const hasWorkout = day && (day.name || counts[day.id])
  const others = WEEK_ORDER.map((w) => days.find((d) => d.weekday === w)).filter(
    (d): d is PlanDay => !!d && !!(d.name || counts[d.id]) && d.weekday !== weekday,
  )

  return (
    <div className="card project-today" style={{ borderTopColor: project.color }}>
      <Link to={`/projetos/${project.id}`} className="row gap-sm small" style={{ color: project.color }}>
        <span className="dot" style={{ background: project.color }} />
        <strong>{project.name}</strong>
      </Link>

      {hasWorkout && day ? (
        <>
          <div className="today-title">
            <div className="muted small">Treino de hoje</div>
            <h2>{day.name || WEEKDAYS[day.weekday]}</h2>
            <div className="row gap-sm small muted">
              <TypeBadge type={day.type} />
              <span>{counts[day.id] ?? 0} exercícios</span>
            </div>
          </div>
          <div className="row gap-sm">
            <button className="btn grow" onClick={() => onStart(project.id, day.id)}>
              <Play size={18} fill="currentColor" /> Iniciar treino
            </button>
            <Link to={`/dia/${day.id}`} className="btn btn-ghost">
              Ver
            </Link>
          </div>
        </>
      ) : (
        <div className="today-title">
          <div className="row gap-sm">
            <Moon size={20} className="muted" />
            <h2>Dia de descanso</h2>
          </div>
          <div className="muted small">Nada planejado para {WEEKDAYS[weekday].toLowerCase()}.</div>
        </div>
      )}

      <div className="row gap-sm wrap">
        <select
          className="input input-sm grow"
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (v) onStart(project.id, v === 'free' ? undefined : v)
          }}
        >
          <option value="">Treinar outro dia…</option>
          {others.map((d) => (
            <option key={d.id} value={d.id}>
              {WEEKDAYS[d.weekday]} · {d.name || 'Treino'}
            </option>
          ))}
          <option value="free">Treino livre</option>
        </select>
      </div>
    </div>
  )
}
