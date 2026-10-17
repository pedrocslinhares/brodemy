import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  Pencil,
  Play,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react'
import { db, FIELD_DEFS, type FieldKey, type Session, type SessionExercise, type SetLog } from '../db'
import {
  addPhoto,
  addSessionExercise,
  addSet,
  deleteSession,
  deleteSessionExercise,
  finishSession,
  moveExercise,
  previousSets,
} from '../lib/repo'
import { summarize } from '../lib/stats'
import { ExerciseEditor, ExerciseNames } from '../components/ExerciseEditor'
import { MediaSection } from '../components/MediaSection'
import { useTimer } from '../components/Timer'
import {
  CommitInput,
  CommitTextarea,
  Empty,
  Field,
  FieldPicker,
  FileImage,
  ImageViewer,
  Modal,
  PageHeader,
  PhotoButtons,
  Stat,
  TypeBadge,
  TypePicker,
  useObjectUrl,
} from '../components/ui'
import {
  fmtNum,
  formatDate,
  formatDateShort,
  formatDuration,
  normalizeKey,
  numToInput,
  parseDuration,
  parseNumber,
  WEEKDAYS,
  parseISODate,
} from '../lib/utils'

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        /* sem suporte ou negado */
      }
    }
    req()
    const vis = () => document.visibilityState === 'visible' && !cancelled && req()
    document.addEventListener('visibilitychange', vis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', vis)
      lock?.release().catch(() => {})
    }
  }, [active])
}

function useNow(intervalMs: number, active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs, active])
  return now
}

export function formatSetShort(s: SetLog): string {
  const parts: string[] = []
  if (s.load != null) parts.push(`${fmtNum(s.load)}kg`)
  if (s.reps != null) parts.push(`${s.load != null ? '×' : ''}${s.reps}${s.load != null ? '' : ' reps'}`)
  if (s.timeSec != null) parts.push(formatDuration(s.timeSec))
  if (s.distance != null) parts.push(`${fmtNum(s.distance)}m`)
  return parts.join(s.load != null && s.reps != null && parts.length === 2 ? '' : ' ') || '—'
}

export default function SessionPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [mediaOpen, setMediaOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id])
  const exercises = useLiveQuery(() => db.sessionExercises.where('sessionId').equals(id).sortBy('order'), [id])
  const sets = useLiveQuery(() => db.sets.where('sessionId').equals(id).sortBy('order'), [id])
  const project = useLiveQuery(() => (session ? db.projects.get(session.projectId) : undefined), [session?.projectId])
  const day = useLiveQuery(() => (session?.dayId ? db.planDays.get(session.dayId) : undefined), [session?.dayId])
  const photos = useLiveQuery(() => db.photos.where('sessionId').equals(id).toArray(), [id])

  const running = !!session && !session.finishedAt
  useWakeLock(running)
  const now = useNow(30000, running)

  if (session === undefined || !exercises || !sets) return null
  if (session === null)
    return (
      <div className="page">
        <PageHeader title="Treino" back />
        <Empty title="Treino não encontrado" />
      </div>
    )

  const sum = summarize(sets, exercises.length)
  const elapsed = Math.round(((session.finishedAt ?? now) - session.startedAt) / 60000)
  const sameDay = new Date(session.startedAt).toDateString() === parseISODate(session.date).toDateString()

  const remove = async () => {
    if (!confirm('Excluir este treino e todas as séries registradas?')) return
    await deleteSession(session.id)
    nav(-1)
  }

  return (
    <div className="page">
      <PageHeader
        title={session.title}
        subtitle={
          <span>
            {WEEKDAYS[parseISODate(session.date).getDay()]}, {formatDate(session.date)}
            {project && (
              <>
                {' · '}
                <Link to={`/projetos/${project.id}`} style={{ color: project.color }}>
                  {project.name}
                </Link>
              </>
            )}
          </span>
        }
        back
        right={
          <button className="icon-btn" onClick={() => setEditOpen(true)} aria-label="Editar treino">
            <Pencil size={20} />
          </button>
        }
      />
      <ExerciseNames />

      <div className="row gap-sm wrap session-meta">
        <TypeBadge type={session.type} />
        {session.finishedAt ? (
          <span className="badge accent">
            <CheckCircle2 size={12} /> Concluído
          </span>
        ) : (
          <span className="badge">Em andamento</span>
        )}
        {sameDay && (
          <span className="small muted row gap-xs">
            <Clock size={14} /> {elapsed} min
          </span>
        )}
        <span className="small muted">
          {sum.sets} séries{sum.volume > 0 ? ` · ${fmtNum(sum.volume, 0)} kg` : ''}
        </span>
      </div>

      {day && day.media.length > 0 && (
        <div className="card">
          <button className="collapse-head" onClick={() => setMediaOpen(!mediaOpen)}>
            <strong>Vídeos e referências ({day.media.length})</strong>
            {mediaOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {mediaOpen && (
            <div style={{ marginTop: 12 }}>
              <MediaSection items={day.media} />
            </div>
          )}
        </div>
      )}
      {day?.notes && <div className="note-box small">{day.notes}</div>}

      <div className="stack">
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            ex={ex}
            session={session}
            sets={sets.filter((s) => s.sessionExerciseId === ex.id)}
            index={i}
            list={exercises}
          />
        ))}
        {exercises.length === 0 && (
          <Empty title="Nenhum exercício neste treino">Adicione os exercícios conforme for executando.</Empty>
        )}
        <button className="btn btn-ghost" onClick={() => setAddOpen(true)}>
          <Plus size={18} /> Adicionar exercício
        </button>
      </div>

      {session.finishedAt ? (
        <div className="card stack" style={{ marginTop: 20 }}>
          <div className="stats-row">
            <Stat label="Exercícios" value={sum.exercises} />
            <Stat label="Séries" value={sum.sets} />
            <Stat label="Volume (kg)" value={fmtNum(sum.volume, 0)} />
          </div>
          {session.notes && <p className="pre small">{session.notes}</p>}
          <SessionPhotos session={session} photos={photos ?? []} />
        </div>
      ) : (
        <button className="btn btn-lg" style={{ marginTop: 20 }} onClick={() => setFinishOpen(true)}>
          <CheckCircle2 size={20} /> Finalizar treino
        </button>
      )}

      <button className="btn btn-ghost danger btn-sm" style={{ marginTop: 24 }} onClick={remove}>
        <Trash2 size={16} /> Excluir treino
      </button>

      <EditSessionModal open={editOpen} onClose={() => setEditOpen(false)} session={session} />
      <AddExerciseModal open={addOpen} onClose={() => setAddOpen(false)} session={session} />
      <FinishModal open={finishOpen} onClose={() => setFinishOpen(false)} session={session} />
    </div>
  )
}

/* ---------------- Exercício com suas séries ---------------- */

function ExerciseCard({ ex, session, sets, index, list }: {
  ex: SessionExercise
  session: Session
  sets: SetLog[]
  index: number
  list: SessionExercise[]
}) {
  const timer = useTimer()
  const [editOpen, setEditOpen] = useState(false)
  const [fieldsOpen, setFieldsOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const prev = useLiveQuery(() => previousSets(ex.nameKey, session.id, session.date), [ex.nameKey, session.id, session.date])

  const cols = ex.fields.filter((f) => f !== 'note')
  const hasNote = ex.fields.includes('note')
  const grid = { gridTemplateColumns: `22px repeat(${cols.length}, minmax(0, 1fr)) 36px 28px` }

  const patchSet = (s: SetLog, p: Partial<SetLog>) => db.sets.update(s.id, p)
  const removeSet = (s: SetLog) => db.sets.delete(s.id)
  const rest = (s: SetLog, n: number) =>
    timer.start(s.restSec ?? ex.restSec ?? timer.defaultRest, `${ex.name || 'Exercício'} · série ${n}`)

  const patchEx = (p: Partial<SessionExercise>) =>
    db.sessionExercises.update(ex.id, p.name != null ? { ...p, nameKey: normalizeKey(p.name) } : p)

  const remove = async () => {
    if (!confirm(`Remover "${ex.name || 'exercício'}" e suas séries deste treino?`)) return
    await deleteSessionExercise(ex.id)
  }

  return (
    <div className="card exercise-card">
      <div className="row gap-sm exercise-title">
        {ex.equipmentPhotoId && (
          <FileImage fileId={ex.equipmentPhotoId} className="equip-thumb" onClick={() => setPhotoOpen(true)} />
        )}
        <div className="grow min0">
          <strong className="block ellipsis">{ex.name || 'Exercício sem nome'}</strong>
          <div className="small muted ellipsis">
            {[ex.equipment, ex.target && `meta ${ex.target}`].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setFieldsOpen(!fieldsOpen)} aria-label="Campos">
          <Settings2 size={18} />
        </button>
        <button className="icon-btn" onClick={() => setEditOpen(true)} aria-label="Editar exercício">
          <Pencil size={18} />
        </button>
      </div>

      {ex.notes && <div className="small muted pre">{ex.notes}</div>}

      {prev && (
        <div className="prev-line small">
          <History size={13} /> Último ({formatDateShort(prev.date)}): {prev.sets.map(formatSetShort).join(' · ')}
        </div>
      )}

      {fieldsOpen && (
        <div className="fields-box">
          <div className="small muted">Campos registrados neste exercício:</div>
          <FieldPicker value={ex.fields} onChange={(fields) => patchEx({ fields })} />
        </div>
      )}

      {sets.length > 0 && (
        <div className="sets">
          <div className="set-row set-head" style={grid}>
            <span>#</span>
            {cols.map((c) => (
              <span key={c}>{FIELD_DEFS.find((f) => f.key === c)?.short}</span>
            ))}
            <span />
            <span />
          </div>
          {sets.map((s, i) => (
            <div key={s.id} className="set-block">
              <div className="set-row" style={grid}>
                <span className="set-num">{i + 1}</span>
                {cols.map((c) => (
                  <SetInput key={c} field={c} set={s} onPatch={(p) => patchSet(s, p)} />
                ))}
                <button className="rest-btn" onClick={() => rest(s, i + 1)} aria-label="Iniciar descanso">
                  <Play size={15} fill="currentColor" />
                </button>
                <button className="icon-btn tiny" onClick={() => removeSet(s)} aria-label="Remover série">
                  <X size={15} />
                </button>
              </div>
              {hasNote && (
                <CommitInput
                  className="input input-sm set-note"
                  placeholder="Observação da série"
                  value={s.note ?? ''}
                  onCommit={(v) => patchSet(s, { note: v || undefined })}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-ghost btn-sm add-set" onClick={() => addSet(ex)}>
        <Plus size={16} /> Série {sets.length + 1}
      </button>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Editar exercício">
        <ExerciseEditor ex={ex} onPatch={patchEx} />
        <div className="row gap-sm" style={{ marginTop: 16 }}>
          <button className="icon-btn" disabled={index === 0} onClick={() => moveExercise('sessionExercises', list, index, -1)} aria-label="Subir">
            <ArrowUp size={18} />
          </button>
          <button
            className="icon-btn"
            disabled={index === list.length - 1}
            onClick={() => moveExercise('sessionExercises', list, index, 1)}
            aria-label="Descer"
          >
            <ArrowDown size={18} />
          </button>
          <div className="grow" />
          <button className="btn btn-ghost btn-sm danger" onClick={remove}>
            <Trash2 size={16} /> Remover
          </button>
          <button className="btn btn-sm" onClick={() => setEditOpen(false)}>
            Pronto
          </button>
        </div>
      </Modal>
      <ImageViewer
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        fileId={ex.equipmentPhotoId}
        title={ex.equipment || 'Equipamento'}
      />
    </div>
  )
}

function SetInput({ field, set, onPatch }: { field: FieldKey; set: SetLog; onPatch: (p: Partial<SetLog>) => void }) {
  const common = { className: 'input set-input', inputMode: 'decimal' as const }
  switch (field) {
    case 'load':
      return <CommitInput {...common} placeholder="kg" value={numToInput(set.load)} onCommit={(v) => onPatch({ load: parseNumber(v) })} />
    case 'reps':
      return <CommitInput {...common} inputMode="numeric" placeholder="reps" value={numToInput(set.reps)} onCommit={(v) => onPatch({ reps: parseNumber(v) })} />
    case 'time':
      return <CommitInput {...common} inputMode="numeric" placeholder="seg" value={formatDuration(set.timeSec)} onCommit={(v) => onPatch({ timeSec: parseDuration(v) })} />
    case 'distance':
      return <CommitInput {...common} placeholder="m" value={numToInput(set.distance)} onCommit={(v) => onPatch({ distance: parseNumber(v) })} />
    case 'rest':
      return <CommitInput {...common} inputMode="numeric" placeholder="seg" value={formatDuration(set.restSec)} onCommit={(v) => onPatch({ restSec: parseDuration(v) })} />
    default:
      return null
  }
}

/* ---------------- Fotos do treino ---------------- */

function SessionPhotos({ session, photos }: { session: Session; photos: { id: string; fileId: string }[] }) {
  const [view, setView] = useState<string>()
  return (
    <div className="stack-sm">
      <strong className="small">Fotos de progresso</strong>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p) => (
            <button key={p.id} className="photo-tile" onClick={() => setView(p.fileId)}>
              <FileImage fileId={p.fileId} />
            </button>
          ))}
        </div>
      )}
      <PhotoButtons
        small
        cameraLabel="Tirar foto"
        onFile={(f) => addPhoto(session.projectId, 'progress', f, { date: session.date, sessionId: session.id })}
      />
      <ImageViewer open={!!view} onClose={() => setView(undefined)} fileId={view} title="Foto de progresso" />
    </div>
  )
}

/* ---------------- Modais ---------------- */

function EditSessionModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  const patch = (p: Partial<Session>) => db.sessions.update(session.id, p)
  return (
    <Modal open={open} onClose={onClose} title="Editar treino">
      <div className="stack">
        <Field label="Nome do treino">
          <CommitInput className="input" value={session.title} onCommit={(v) => patch({ title: v })} />
        </Field>
        <Field label="Data">
          <input className="input" type="date" value={session.date} onChange={(e) => e.target.value && patch({ date: e.target.value })} />
        </Field>
        <div className="field">
          <span className="field-label">Tipo</span>
          <TypePicker value={session.type} onChange={(type) => patch({ type })} />
        </div>
        <Field label="Observações">
          <CommitTextarea className="input" rows={3} value={session.notes} onCommit={(v) => patch({ notes: v })} />
        </Field>
        {session.finishedAt && (
          <button className="btn btn-ghost btn-sm" onClick={() => patch({ finishedAt: undefined })}>
            Marcar como em andamento
          </button>
        )}
        <button className="btn" onClick={onClose}>
          Pronto
        </button>
      </div>
    </Modal>
  )
}

function AddExerciseModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  const [name, setName] = useState('')
  const [equipment, setEquipment] = useState('')
  const add = async () => {
    if (!name.trim()) return
    // reaproveita configuração de um exercício igual já usado
    const key = normalizeKey(name)
    const last = (await db.sessionExercises.where('nameKey').equals(key).toArray()).pop()
    await addSessionExercise(session, {
      name: name.trim(),
      equipment: equipment.trim() || last?.equipment || '',
      ...(last ? { fields: last.fields, restSec: last.restSec, equipmentPhotoId: last.equipmentPhotoId } : {}),
    })
    setName('')
    setEquipment('')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Adicionar exercício">
      <div className="stack">
        <Field label="Exercício">
          <input
            className="input"
            list="exercise-names"
            value={name}
            autoFocus
            placeholder="Ex.: Barra fixa"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Equipamento (opcional)">
          <input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} />
        </Field>
        <button className="btn" onClick={add} disabled={!name.trim()}>
          Adicionar
        </button>
      </div>
    </Modal>
  )
}

function FinishModal({ open, onClose, session }: { open: boolean; onClose: () => void; session: Session }) {
  const [notes, setNotes] = useState(session.notes)
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const preview = useObjectUrl(photo)

  useEffect(() => {
    if (open) setNotes(session.notes)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true)
    try {
      await finishSession(session.id, notes, photo ?? undefined)
      setPhoto(null)
      onClose()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Finalizar treino">
      <div className="stack">
        <Field label="Como foi o treino? (opcional)">
          <textarea
            className="input"
            rows={3}
            value={notes}
            placeholder="Disposição, dores, recordes…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <div className="field">
          <span className="field-label">Foto de progresso (opcional)</span>
          {preview ? (
            <div className="stack-sm">
              <img src={preview} className="form-photo" alt="" />
              <button className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>
                <X size={16} /> Remover foto
              </button>
            </div>
          ) : (
            <div className="photo-cta">
              <Camera size={22} />
              <span className="small muted">Registre como está hoje. Ela entra no histórico do projeto.</span>
            </div>
          )}
          <PhotoButtons onFile={setPhoto} cameraLabel={photo ? 'Tirar outra' : 'Tirar foto'} />
        </div>
        <button className="btn btn-lg" onClick={save} disabled={saving}>
          <CheckCircle2 size={20} /> {saving ? 'Salvando…' : 'Concluir treino'}
        </button>
      </div>
    </Modal>
  )
}
