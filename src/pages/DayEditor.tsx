import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Play, Plus, Trash2 } from 'lucide-react'
import { db, type PlanExercise } from '../db'
import { addPlanExercise, cleanupOrphanFiles, moveExercise, startSession } from '../lib/repo'
import { MediaSection } from '../components/MediaSection'
import { ExerciseEditor, ExerciseNames } from '../components/ExerciseEditor'
import { CommitInput, CommitTextarea, Empty, Field, FileImage, PageHeader, TypePicker } from '../components/ui'
import { formatDuration, WEEKDAYS } from '../lib/utils'

export default function DayEditor() {
  const { dayId = '' } = useParams()
  const nav = useNavigate()
  const [openId, setOpenId] = useState<string | null>(null)

  const day = useLiveQuery(async () => (await db.planDays.get(dayId)) ?? null, [dayId])
  const project = useLiveQuery(() => (day ? db.projects.get(day.projectId) : undefined), [day?.projectId])
  const exercises = useLiveQuery(() => db.planExercises.where('dayId').equals(dayId).sortBy('order'), [dayId])

  if (day === undefined || !exercises) return null
  if (day === null)
    return (
      <div className="page">
        <PageHeader title="Dia" back />
        <Empty title="Dia não encontrado" />
      </div>
    )

  const patch = (p: Partial<typeof day>) => db.planDays.update(day.id, p)
  const add = async () => setOpenId(await addPlanExercise(day.id, day.projectId))
  const start = async () => nav(`/sessao/${await startSession(day.projectId, day.id)}`)

  return (
    <div className="page">
      <PageHeader
        title={WEEKDAYS[day.weekday]}
        subtitle={project?.name}
        back={`/projetos/${day.projectId}?tab=plano`}
      />
      <ExerciseNames />

      <div className="card stack">
        <Field label="Nome do treino">
          <CommitInput
            className="input"
            value={day.name}
            placeholder="Ex.: Costas e Bíceps (vazio = descanso)"
            onCommit={(v) => patch({ name: v })}
          />
        </Field>
        <div className="field">
          <span className="field-label">Tipo de treino</span>
          <TypePicker value={day.type} onChange={(type) => patch({ type })} />
        </div>
        <Field label="Anotações do dia">
          <CommitTextarea
            className="input"
            rows={2}
            value={day.notes}
            placeholder="Aquecimento, foco do dia, observações…"
            onCommit={(v) => patch({ notes: v })}
          />
        </Field>
      </div>

      <div className="section-label">Vídeos e referências do treino</div>
      <div className="card">
        <MediaSection items={day.media} editable onChange={(media) => patch({ media })} />
      </div>

      <div className="section-label">Exercícios ({exercises.length})</div>
      <div className="stack-sm">
        {exercises.map((ex, i) => (
          <PlanExerciseCard
            key={ex.id}
            ex={ex}
            index={i}
            list={exercises}
            open={openId === ex.id}
            onToggle={() => setOpenId(openId === ex.id ? null : ex.id)}
          />
        ))}
        <button className="btn btn-ghost" onClick={add}>
          <Plus size={18} /> Adicionar exercício
        </button>
      </div>

      {(day.name || exercises.length > 0) && (
        <button className="btn btn-lg" style={{ marginTop: 20 }} onClick={start}>
          <Play size={20} fill="currentColor" /> Iniciar treino deste dia
        </button>
      )}
    </div>
  )
}

function PlanExerciseCard({ ex, index, list, open, onToggle }: {
  ex: PlanExercise
  index: number
  list: PlanExercise[]
  open: boolean
  onToggle: () => void
}) {
  const remove = async () => {
    if (!confirm(`Remover "${ex.name || 'exercício'}" do plano? (O histórico de treinos não é afetado.)`)) return
    await db.planExercises.delete(ex.id)
    await cleanupOrphanFiles()
  }
  return (
    <div className="card exercise-plan">
      <div className="row gap-sm">
        <button className="exercise-head grow" onClick={onToggle}>
          {ex.equipmentPhotoId && <FileImage fileId={ex.equipmentPhotoId} className="equip-thumb" />}
          <div className="grow min0 left">
            <strong className="ellipsis block">{ex.name || 'Novo exercício'}</strong>
            <div className="muted small ellipsis">
              {[
                ex.equipment,
                ex.target,
                ex.restSec ? `desc. ${formatDuration(ex.restSec)}` : '',
                ex.media?.length ? `▶ ${ex.media.length} vídeo/link` : '',
              ]
                .filter(Boolean)
                .join(' · ') || 'Toque para editar'}
            </div>
          </div>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {open && (
        <div className="exercise-body">
          <ExerciseEditor ex={ex} onPatch={(p) => db.planExercises.update(ex.id, p)} />
          <div className="row gap-sm" style={{ marginTop: 12 }}>
            <button className="icon-btn" disabled={index === 0} onClick={() => moveExercise('planExercises', list, index, -1)} aria-label="Subir">
              <ArrowUp size={18} />
            </button>
            <button
              className="icon-btn"
              disabled={index === list.length - 1}
              onClick={() => moveExercise('planExercises', list, index, 1)}
              aria-label="Descer"
            >
              <ArrowDown size={18} />
            </button>
            <div className="grow" />
            <button className="btn btn-ghost btn-sm danger" onClick={remove}>
              <Trash2 size={16} /> Remover
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
