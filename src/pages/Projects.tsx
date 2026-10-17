import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, FolderOpen, Plus } from 'lucide-react'
import { db, type Photo, type Project } from '../db'
import { Empty, FileImage, PageHeader } from '../components/ui'
import { daysBetween, formatDate, todayISO } from '../lib/utils'

export default function Projects() {
  const data = useLiveQuery(async () => {
    const projects = await db.projects.orderBy('createdAt').reverse().toArray()
    const sessions = await db.sessions.toArray()
    const photos = await db.photos.toArray()
    return { projects, sessions, photos }
  }, [])

  if (!data) return null
  const active = data.projects.filter((p) => p.status === 'active')
  const finished = data.projects.filter((p) => p.status === 'finished')

  const card = (p: Project) => {
    const photos = data.photos.filter((x) => x.projectId === p.id)
    const cover: Photo | undefined =
      photos.find((x) => x.kind === 'start') ?? photos.sort((a, b) => a.date.localeCompare(b.date))[0]
    const count = data.sessions.filter((s) => s.projectId === p.id).length
    const days = daysBetween(p.startDate, p.endDate ?? todayISO()) + 1
    return (
      <Link key={p.id} to={`/projetos/${p.id}`} className="card project-card" style={{ borderLeftColor: p.color }}>
        {cover ? <FileImage fileId={cover.fileId} className="project-cover" /> : <div className="project-cover empty-cover" />}
        <div className="grow min0">
          <strong className="ellipsis block">{p.name}</strong>
          {p.objectives && <div className="muted small clamp-2">{p.objectives}</div>}
          <div className="small muted">
            {formatDate(p.startDate)}
            {p.endDate ? ` → ${formatDate(p.endDate)}` : ''} · {days} dias · {count} treinos
          </div>
        </div>
        <ChevronRight size={18} className="muted" />
      </Link>
    )
  }

  return (
    <div className="page">
      <PageHeader
        title="Projetos"
        subtitle="Seus ciclos de evolução"
        right={
          <Link to="/projetos/novo" className="btn btn-sm">
            <Plus size={16} /> Novo
          </Link>
        }
      />
      {data.projects.length === 0 && (
        <Empty icon={<FolderOpen size={36} />} title="Nenhum projeto ainda">
          Crie um projeto com seus objetivos e a foto do dia 1.
          <div style={{ marginTop: 16 }}>
            <Link to="/projetos/novo" className="btn">
              Criar primeiro projeto
            </Link>
          </div>
        </Empty>
      )}
      {active.length > 0 && <div className="section-label">Ativos</div>}
      <div className="stack-sm">{active.map(card)}</div>
      {finished.length > 0 && <div className="section-label">Encerrados</div>}
      <div className="stack-sm">{finished.map(card)}</div>
    </div>
  )
}
