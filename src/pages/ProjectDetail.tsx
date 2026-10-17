import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, CheckCircle2, ChevronRight, Copy, Pencil, Play, RotateCcw, Share2, Trash2, Columns2 } from 'lucide-react'
import { db, type Photo, type PhotoKind } from '../db'
import { addPhoto, deletePhoto, deleteProject, setProjectPhoto, startSession } from '../lib/repo'
import { setVolume } from '../lib/stats'
import {
  Empty,
  Field,
  FileImage,
  ImageViewer,
  Modal,
  PageHeader,
  PhotoButtons,
  Stat,
  TypeBadge,
  useObjectUrl,
} from '../components/ui'
import { SessionList } from '../components/SessionList'
import { ExportProjectModal } from '../components/ProjectTransfer'
import { daysBetween, fmtNum, formatDate, todayISO, WEEK_ORDER, WEEKDAYS } from '../lib/utils'

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'plano', label: 'Plano' },
  { key: 'fotos', label: 'Fotos' },
  { key: 'treinos', label: 'Treinos' },
]

const KIND_LABEL: Record<PhotoKind, string> = { start: 'Dia 1', progress: 'Progresso', end: 'Final' }

export default function ProjectDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'resumo'
  const project = useLiveQuery(async () => (await db.projects.get(id)) ?? null, [id])

  if (project === undefined) return null
  if (project === null)
    return (
      <div className="page">
        <PageHeader title="Projeto" back="/projetos" />
        <Empty title="Projeto não encontrado" />
      </div>
    )

  return (
    <div className="page">
      <PageHeader
        title={project.name}
        subtitle={
          <span className="row gap-sm">
            <span className="dot" style={{ background: project.color }} />
            {project.status === 'active' ? 'Ativo' : 'Encerrado'} · desde {formatDate(project.startDate)}
          </span>
        }
        back="/projetos"
        right={
          <Link to={`/projetos/${id}/editar`} className="icon-btn" aria-label="Editar">
            <Pencil size={20} />
          </Link>
        }
      />
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={'tab' + (tab === t.key ? ' active' : '')}
            onClick={() => setParams({ tab: t.key }, { replace: true })}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'resumo' && <Overview projectId={id} />}
      {tab === 'plano' && <PlanTab projectId={id} />}
      {tab === 'fotos' && <PhotosTab projectId={id} />}
      {tab === 'treinos' && <SessionList projectId={id} />}
    </div>
  )
}

/* ---------------- Resumo ---------------- */

function Overview({ projectId }: { projectId: string }) {
  const nav = useNavigate()
  const [finishOpen, setFinishOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [viewer, setViewer] = useState<Photo | null>(null)

  const data = useLiveQuery(async () => {
    const project = await db.projects.get(projectId)
    const sessions = await db.sessions.where('projectId').equals(projectId).toArray()
    const sets = await db.sets.where('projectId').equals(projectId).toArray()
    const photos = (await db.photos.where('projectId').equals(projectId).toArray()).sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
    )
    return { project, sessions, sets, photos }
  }, [projectId])

  if (!data?.project) return null
  const { project, sessions, sets, photos } = data
  const finished = project.status === 'finished'
  const startPhoto = photos.find((p) => p.kind === 'start')
  const endPhoto = photos.find((p) => p.kind === 'end')
  const latest = [...photos].reverse().find((p) => p.kind !== 'start')
  const after = endPhoto ?? latest
  const days = daysBetween(project.startDate, project.endDate ?? todayISO()) + 1
  const volume = sets.reduce((a, s) => a + setVolume(s), 0)
  const weeks = Math.max(1, days / 7)

  const reopen = async () => {
    if (!confirm('Reabrir este projeto? Ele volta a ficar ativo.')) return
    await db.projects.update(projectId, { status: 'active', finishedAt: undefined })
  }
  const remove = async () => {
    if (!confirm(`Excluir o projeto "${project.name}" com TODOS os treinos e fotos? Essa ação não pode ser desfeita.`)) return
    if (!confirm('Tem certeza? Considere exportar um backup antes.')) return
    await deleteProject(projectId)
    nav('/projetos', { replace: true })
  }

  return (
    <div className="stack">
      <div className="compare">
        <div className="compare-col">
          <div className="compare-label">Dia 1 · {formatDate(startPhoto?.date ?? project.startDate)}</div>
          {startPhoto ? (
            <FileImage fileId={startPhoto.fileId} className="compare-img" onClick={() => setViewer(startPhoto)} />
          ) : (
            <div className="compare-img compare-empty">
              <Camera size={26} />
              <PhotoButtons small cameraLabel="Foto" galleryLabel="" onFile={(f) => setProjectPhoto(projectId, 'start', f, project.startDate)} />
            </div>
          )}
        </div>
        <div className="compare-col">
          <div className="compare-label">
            {after ? `${endPhoto ? 'Final' : 'Atual'} · ${formatDate(after.date)}` : finished ? 'Final' : 'Atual'}
          </div>
          {after ? (
            <FileImage fileId={after.fileId} className="compare-img" onClick={() => setViewer(after)} />
          ) : (
            <div className="compare-img compare-empty">
              <Camera size={26} />
              <span className="small muted">Tire fotos ao finalizar os treinos</span>
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="Dias" value={days} />
        <Stat label="Treinos" value={sessions.length} sub={`${fmtNum(sessions.length / weeks, 1)}/semana`} />
        <Stat label="Séries" value={sets.length} />
        <Stat label="Volume kg" value={fmtNum(volume, 0)} />
      </div>

      <div className="card">
        <div className="section-label no-margin">Objetivos</div>
        <p className="pre">{project.objectives || <span className="muted">Sem objetivos descritos.</span>}</p>
      </div>

      {finished && (
        <div className="card card-outline">
          <div className="section-label no-margin">
            Feedback · encerrado em {formatDate(project.endDate)}
          </div>
          <p className="pre">{project.feedback || <span className="muted">Sem feedback.</span>}</p>
        </div>
      )}

      <div className="stack-sm">
        {!finished ? (
          <button className="btn btn-lg" onClick={() => setFinishOpen(true)}>
            <CheckCircle2 size={20} /> Encerrar projeto
          </button>
        ) : (
          <button className="btn btn-ghost" onClick={reopen}>
            <RotateCcw size={18} /> Reabrir projeto
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => setExportOpen(true)}>
          <Share2 size={18} /> Exportar projeto
        </button>
        <Link to={`/projetos/novo?copy=${projectId}`} className="btn btn-ghost">
          <Copy size={18} /> Novo projeto com este plano
        </Link>
        <button className="btn btn-ghost danger" onClick={remove}>
          <Trash2 size={18} /> Excluir projeto
        </button>
      </div>

      <ExportProjectModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        projectId={projectId}
        projectName={project.name}
      />
      <FinishProjectModal open={finishOpen} onClose={() => setFinishOpen(false)} projectId={projectId} />
      <PhotoViewerModal photo={viewer} onClose={() => setViewer(null)} />
    </div>
  )
}

function FinishProjectModal({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const [endDate, setEndDate] = useState(todayISO())
  const [feedback, setFeedback] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const preview = useObjectUrl(photo)

  const save = async () => {
    setSaving(true)
    try {
      await db.projects.update(projectId, { status: 'finished', endDate, feedback, finishedAt: Date.now() })
      if (photo) await setProjectPhoto(projectId, 'end', photo, endDate)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Encerrar projeto">
      <div className="stack">
        <Field label="Data de encerramento">
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Foto final</span>
          {preview && <img src={preview} className="form-photo" alt="" />}
          <PhotoButtons onFile={setPhoto} cameraLabel={photo ? 'Tirar outra' : 'Tirar foto'} />
        </div>
        <Field label="Feedback do projeto">
          <textarea
            className="input"
            rows={6}
            value={feedback}
            placeholder="Como foi? Objetivos atingidos, o que funcionou, o que mudar no próximo…"
            onChange={(e) => setFeedback(e.target.value)}
          />
        </Field>
        <button className="btn btn-lg" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : 'Encerrar projeto'}
        </button>
        <div className="muted small">Todo o histórico fica guardado. Você pode reabrir depois.</div>
      </div>
    </Modal>
  )
}

function PhotoViewerModal({ photo, onClose }: { photo: Photo | null; onClose: () => void }) {
  return (
    <ImageViewer
      open={!!photo}
      onClose={onClose}
      fileId={photo?.fileId}
      title={photo ? `${KIND_LABEL[photo.kind]} · ${formatDate(photo.date)}` : ''}
    >
      {photo && (
        <div className="row gap-sm" style={{ marginTop: 12 }}>
          {photo.sessionId && (
            <Link to={`/sessao/${photo.sessionId}`} className="btn btn-ghost btn-sm" onClick={onClose}>
              Ver treino
            </Link>
          )}
          <button
            className="btn btn-ghost btn-sm danger"
            onClick={async () => {
              if (confirm('Excluir esta foto?')) {
                await deletePhoto(photo.id)
                onClose()
              }
            }}
          >
            <Trash2 size={16} /> Excluir
          </button>
        </div>
      )}
    </ImageViewer>
  )
}

/* ---------------- Plano semanal ---------------- */

function PlanTab({ projectId }: { projectId: string }) {
  const nav = useNavigate()
  const data = useLiveQuery(async () => {
    const days = await db.planDays.where('projectId').equals(projectId).toArray()
    const exs = await db.planExercises.where('projectId').equals(projectId).toArray()
    return { days, exs }
  }, [projectId])
  if (!data) return null
  const today = new Date().getDay()

  const start = async (dayId?: string) => {
    const id = await startSession(projectId, dayId)
    nav(`/sessao/${id}`)
  }

  return (
    <div className="stack-sm">
      {WEEK_ORDER.map((wd) => {
        const day = data.days.find((d) => d.weekday === wd)
        if (!day) return null
        const exs = data.exs.filter((e) => e.dayId === day.id).sort((a, b) => a.order - b.order)
        const rest = !day.name && !exs.length
        return (
          <div key={wd} className={'card day-row' + (wd === today ? ' today' : '')}>
            <Link to={`/dia/${day.id}`} className="day-link">
              <div className="day-name">{WEEKDAYS[wd].slice(0, 3)}</div>
              <div className="grow min0">
                <strong className={rest ? 'muted' : ''}>{rest ? 'Descanso' : day.name || 'Treino'}</strong>
                {!rest && (
                  <div className="row gap-sm small muted wrap">
                    <TypeBadge type={day.type} />
                    <span className="ellipsis">
                      {exs.length ? exs.map((e) => e.name || 'Exercício').join(', ') : 'Sem exercícios'}
                    </span>
                  </div>
                )}
              </div>
              <ChevronRight size={18} className="muted" />
            </Link>
            {!rest && (
              <button className="icon-btn accent" onClick={() => start(day.id)} aria-label="Iniciar treino">
                <Play size={18} fill="currentColor" />
              </button>
            )}
          </div>
        )
      })}
      <button className="btn btn-ghost" onClick={() => start(undefined)}>
        <Play size={18} /> Treino livre (fora do plano)
      </button>
      <div className="muted small center">Toque em um dia para definir nome, vídeos e exercícios.</div>
    </div>
  )
}

/* ---------------- Fotos de progresso ---------------- */

function PhotosTab({ projectId }: { projectId: string }) {
  const [viewer, setViewer] = useState<Photo | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<Photo[]>([])
  const [compareOpen, setCompareOpen] = useState(false)

  const photos = useLiveQuery(
    async () =>
      (await db.photos.where('projectId').equals(projectId).toArray()).sort(
        (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
      ),
    [projectId],
  )
  if (!photos) return null

  const tap = (p: Photo) => {
    if (!compareMode) return setViewer(p)
    setSelected((cur) => {
      if (cur.find((x) => x.id === p.id)) return cur.filter((x) => x.id !== p.id)
      const next = [...cur, p].slice(-2)
      if (next.length === 2) setTimeout(() => setCompareOpen(true), 150)
      return next
    })
  }
  const pair = [...selected].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="stack">
      <div className="card stack-sm">
        <strong>Registrar foto de progresso</strong>
        <PhotoButtons onFile={(f) => addPhoto(projectId, 'progress', f)} />
      </div>
      {photos.length >= 2 && (
        <button
          className={'btn btn-sm ' + (compareMode ? '' : 'btn-ghost')}
          onClick={() => {
            setCompareMode(!compareMode)
            setSelected([])
          }}
        >
          <Columns2 size={16} /> {compareMode ? 'Selecione 2 fotos… (cancelar)' : 'Comparar fotos'}
        </button>
      )}
      {photos.length === 0 ? (
        <Empty icon={<Camera size={32} />} title="Nenhuma foto ainda">
          Ao finalizar um treino você pode registrar uma foto, que aparece aqui.
        </Empty>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <button
              key={p.id}
              className={'photo-tile' + (selected.find((x) => x.id === p.id) ? ' selected' : '')}
              onClick={() => tap(p)}
            >
              <FileImage fileId={p.fileId} />
              <span className="photo-date">
                {formatDate(p.date)}
                {p.kind !== 'progress' && <b> · {KIND_LABEL[p.kind]}</b>}
              </span>
            </button>
          ))}
        </div>
      )}
      <PhotoViewerModal photo={viewer} onClose={() => setViewer(null)} />
      <Modal
        open={compareOpen && pair.length === 2}
        onClose={() => {
          setCompareOpen(false)
          setSelected([])
          setCompareMode(false)
        }}
        title="Comparação"
        wide
      >
        {pair.length === 2 && (
          <>
            <div className="compare">
              {pair.map((p) => (
                <div key={p.id} className="compare-col">
                  <div className="compare-label">{formatDate(p.date)}</div>
                  <FileImage fileId={p.fileId} className="compare-img tall" />
                </div>
              ))}
            </div>
            <div className="muted small center" style={{ marginTop: 8 }}>
              {daysBetween(pair[0].date, pair[1].date)} dias de diferença
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
