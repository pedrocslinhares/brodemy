import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, FileDown, FileUp, Share2 } from 'lucide-react'
import {
  exportInfo,
  exportProject,
  importProject,
  readProjectFile,
  type ExportScope,
  type ProjectFile,
} from '../lib/projectTransfer'
import { downloadBlob, formatBytes, formatDate, shareFile, slug, todayISO } from '../lib/utils'
import { Field, Modal } from './ui'

function Option({ checked, onChange, title, children, type = 'radio', disabled }: {
  checked: boolean
  onChange: () => void
  title: string
  children?: React.ReactNode
  type?: 'radio' | 'checkbox'
  disabled?: boolean
}) {
  return (
    <label className={'option' + (checked ? ' active' : '') + (disabled ? ' disabled' : '')}>
      <input type={type} checked={checked} onChange={onChange} disabled={disabled} />
      <div className="grow min0">
        <strong>{title}</strong>
        {children && <div className="small muted">{children}</div>}
      </div>
    </label>
  )
}

/* ---------------- Exportar ---------------- */

export function ExportProjectModal({ open, onClose, projectId, projectName }: {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
}) {
  const [scope, setScope] = useState<ExportScope>('plan')
  const [includeVideos, setIncludeVideos] = useState(true)
  const [busy, setBusy] = useState(false)
  const info = useLiveQuery(() => (open ? exportInfo(projectId) : undefined), [open, projectId])

  const size =
    (info?.equipSize ?? 0) + (includeVideos ? info?.videosSize ?? 0 : 0) + (scope === 'full' ? info?.photosSize ?? 0 : 0)
  const filename = `brodemy-${slug(projectName)}-${scope === 'full' ? 'completo' : 'plano'}-${todayISO()}.json`

  const run = async (share: boolean) => {
    setBusy(true)
    try {
      const blob = await exportProject(projectId, { scope, includeVideos })
      if (share) await shareFile(blob, filename)
      else downloadBlob(blob, filename)
      onClose()
    } catch (e) {
      alert('Erro ao exportar: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Exportar projeto">
      <div className="stack">
        <div className="stack-sm">
          <Option checked={scope === 'plan'} onChange={() => setScope('plan')} title="Somente o plano">
            Dias da semana, exercícios, fotos dos equipamentos, vídeos e links. Ideal para compartilhar.
          </Option>
          <Option checked={scope === 'full'} onChange={() => setScope('full')} title="Projeto completo">
            Plano + {info?.sessions ?? 0} treinos, {info?.sets ?? 0} séries, {info?.photos ?? 0} fotos de progresso,
            objetivos e feedback. Ideal para migrar de celular.
          </Option>
        </div>
        {!!info?.videos && (
          <Option type="checkbox" checked={includeVideos} onChange={() => setIncludeVideos(!includeVideos)} title="Incluir vídeos da galeria">
            {info.videos} vídeo(s) · {formatBytes(info.videosSize)}. Links do YouTube sempre vão junto.
          </Option>
        )}
        <div className="muted small">Tamanho aproximado do arquivo: {formatBytes(Math.round(size * 1.37) + 20000)}</div>
        <div className="row gap-sm">
          <button className="btn grow" onClick={() => run(true)} disabled={busy}>
            <Share2 size={18} /> {busy ? 'Gerando…' : 'Compartilhar'}
          </button>
          <button className="btn btn-ghost" onClick={() => run(false)} disabled={busy}>
            <Download size={18} /> Baixar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- Importar ---------------- */

export function ImportProjectButton({ className = 'btn btn-sm btn-ghost', label = 'Importar' }: {
  className?: string
  label?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [data, setData] = useState<ProjectFile | null>(null)

  const onFile = async (f: File) => {
    try {
      setData(await readProjectFile(f))
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <button className={className} onClick={() => ref.current?.click()}>
        <FileUp size={16} /> {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
      <ImportProjectModal data={data} onClose={() => setData(null)} />
    </>
  )
}

function ImportProjectModal({ data, onClose }: { data: ProjectFile | null; onClose: () => void }) {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [history, setHistory] = useState(true)
  const [photos, setPhotos] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data) return
    setName(data.project.name)
    setHistory(data.sessions.length > 0)
    setPhotos(data.photos.length > 0)
  }, [data])

  if (!data) return null
  const exCount = data.planExercises.length
  const days = data.planDays.filter((d) => d.name || data.planExercises.some((e) => e.dayId === d.id)).length
  const media =
    data.planDays.reduce((a, d) => a + d.media.length, 0) +
    data.planExercises.reduce((a, e) => a + (e.media?.length ?? 0), 0)
  const hasHistory = data.sessions.length > 0
  const hasPhotos = data.photos.length > 0
  const keepDates = (history && hasHistory) || (photos && hasPhotos)

  const run = async () => {
    setBusy(true)
    try {
      const id = await importProject(data, { name, includeHistory: history, includePhotos: photos })
      onClose()
      nav(`/projetos/${id}`)
    } catch (e) {
      alert('Erro ao importar: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Importar projeto">
      <div className="stack">
        <div className="card card-outline small">
          <div className="row gap-sm">
            <FileDown size={18} />
            <strong className="grow">{data.project.name}</strong>
            <span className="badge accent">{data.scope === 'full' ? 'Completo' : 'Somente plano'}</span>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Exportado em {formatDate(data.exportedAt.slice(0, 10))}
          </div>
        </div>

        <Field label="Nome do projeto neste celular">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="field">
          <span className="field-label">O que importar</span>
          <div className="stack-sm">
            <Option type="checkbox" checked disabled onChange={() => {}} title="Plano semanal">
              {days} dia(s) com treino · {exCount} exercício(s) · {media} vídeo(s)/link(s)
            </Option>
            <Option
              type="checkbox"
              checked={history && hasHistory}
              disabled={!hasHistory}
              onChange={() => setHistory(!history)}
              title="Treinos e séries registrados"
            >
              {hasHistory ? `${data.sessions.length} treinos · ${data.sets.length} séries` : 'Não incluído no arquivo'}
            </Option>
            <Option
              type="checkbox"
              checked={photos && hasPhotos}
              disabled={!hasPhotos}
              onChange={() => setPhotos(!photos)}
              title="Fotos de progresso"
            >
              {hasPhotos ? `${data.photos.length} foto(s) · dia 1, progresso e final` : 'Não incluído no arquivo'}
            </Option>
          </div>
        </div>

        <div className="muted small">
          {keepDates
            ? `Mantém datas, objetivos, status e feedback originais (início em ${formatDate(data.project.startDate)}).`
            : 'Cria um projeto novo, ativo, começando hoje, com os objetivos originais.'}{' '}
          Seus projetos atuais não são alterados.
        </div>

        <button className="btn btn-lg" onClick={run} disabled={busy}>
          <FileUp size={20} /> {busy ? 'Importando…' : 'Importar projeto'}
        </button>
      </div>
    </Modal>
  )
}
