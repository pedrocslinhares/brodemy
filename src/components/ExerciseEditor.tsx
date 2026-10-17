import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ExerciseBase } from '../db'
import { addImageFile } from '../lib/repo'
import { formatDuration, parseDuration } from '../lib/utils'
import { CommitInput, CommitTextarea, Field, FieldPicker, FileImage, ImageViewer, PhotoButtons } from './ui'
import { MediaSection } from './MediaSection'

/** Sugestões de nomes já usados (datalist id="exercise-names") */
export function ExerciseNames() {
  const names = useLiveQuery(async () => {
    const all = [...(await db.planExercises.toArray()), ...(await db.sessionExercises.toArray())]
    return [...new Set(all.map((e) => e.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [])
  return (
    <datalist id="exercise-names">
      {names?.map((n) => <option key={n} value={n} />)}
    </datalist>
  )
}

/** Editor compartilhado entre o exercício do plano e o exercício do treino */
export function ExerciseEditor({ ex, onPatch }: {
  ex: ExerciseBase
  onPatch: (patch: Partial<ExerciseBase>) => void
}) {
  const [view, setView] = useState(false)
  return (
    <div className="stack">
      <Field label="Exercício">
        <CommitInput
          className="input"
          value={ex.name}
          placeholder="Ex.: Rosca direta"
          list="exercise-names"
          onCommit={(v) => onPatch({ name: v })}
        />
      </Field>
      <Field label="Equipamento">
        <CommitInput
          className="input"
          value={ex.equipment}
          placeholder="Ex.: Halteres, barra fixa, polia…"
          onCommit={(v) => onPatch({ equipment: v })}
        />
      </Field>
      <div className="field">
        <span className="field-label">Foto do equipamento</span>
        <div className="row gap wrap">
          {ex.equipmentPhotoId && (
            <div className="equip-thumb-wrap">
              <FileImage fileId={ex.equipmentPhotoId} className="equip-thumb lg" onClick={() => setView(true)} />
              <button
                className="icon-btn danger"
                onClick={() => confirm('Remover foto do equipamento?') && onPatch({ equipmentPhotoId: undefined })}
                aria-label="Remover foto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
          <PhotoButtons
            small
            cameraLabel={ex.equipmentPhotoId ? 'Trocar' : 'Câmera'}
            onFile={async (f) => onPatch({ equipmentPhotoId: await addImageFile(f) })}
          />
        </div>
      </div>
      <div className="field">
        <span className="field-label">Vídeos e links de execução</span>
        <div className="media-box">
          <MediaSection items={ex.media ?? []} editable onChange={(media) => onPatch({ media })} />
        </div>
      </div>
      <div className="grid-2">
        <Field label="Meta" hint="Ex.: 4 x 10-12">
          <CommitInput className="input" value={ex.target} onCommit={(v) => onPatch({ target: v })} />
        </Field>
        <Field label="Descanso padrão" hint="Ex.: 90 ou 1:30">
          <CommitInput
            className="input"
            inputMode="numeric"
            value={formatDuration(ex.restSec)}
            onCommit={(v) => onPatch({ restSec: parseDuration(v) })}
          />
        </Field>
      </div>
      <div className="field">
        <span className="field-label">Campos para registrar em cada série</span>
        <FieldPicker value={ex.fields} onChange={(fields) => onPatch({ fields })} />
      </div>
      <Field label="Observações">
        <CommitTextarea
          className="input"
          rows={2}
          value={ex.notes}
          placeholder="Dicas de execução, pegada, ajuste do banco…"
          onCommit={(v) => onPatch({ notes: v })}
        />
      </Field>
      <ImageViewer fileId={ex.equipmentPhotoId} open={view} onClose={() => setView(false)} title={ex.equipment || 'Equipamento'} />
    </div>
  )
}
