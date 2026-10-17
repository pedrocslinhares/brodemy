import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { SessionList } from '../components/SessionList'
import { PageHeader } from '../components/ui'

export default function History() {
  const [projectId, setProjectId] = useState<string>()
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])

  return (
    <div className="page">
      <PageHeader title="Histórico" subtitle="Todos os treinos registrados" />
      {projects && projects.length > 1 && (
        <div className="chips scroll-x">
          <button className={'chip' + (!projectId ? ' active' : '')} onClick={() => setProjectId(undefined)}>
            Todos
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className={'chip' + (projectId === p.id ? ' active' : '')}
              onClick={() => setProjectId(p.id)}
            >
              <span className="dot" style={{ background: p.color }} /> {p.name}
            </button>
          ))}
        </div>
      )}
      <SessionList projectId={projectId} />
    </div>
  )
}
