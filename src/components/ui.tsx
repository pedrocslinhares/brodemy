import {
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Camera, ImageIcon, X } from 'lucide-react'
import { db, FIELD_DEFS, TRAINING_TYPES, typeInfo, type FieldKey, type TrainingType } from '../db'

/* ---------- Cabeçalho de página ---------- */

export function PageHeader({ title, subtitle, back, right }: {
  title: ReactNode
  subtitle?: ReactNode
  back?: string | true
  right?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <header className="page-header">
      {back && (
        <button
          className="icon-btn"
          aria-label="Voltar"
          onClick={() => (back === true ? nav(-1) : nav(back))}
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <div className="page-title">
        <h1>{title}</h1>
        {subtitle && <div className="muted small">{subtitle}</div>}
      </div>
      {right && <div className="row gap-sm">{right}</div>}
    </header>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <strong>{title}</strong>
      {children && <div className="muted">{children}</div>}
    </div>
  )
}

export function TypeBadge({ type }: { type?: TrainingType }) {
  const t = typeInfo(type)
  return (
    <span className="badge" style={{ color: t.color, borderColor: t.color + '55', background: t.color + '14' }}>
      {t.label}
    </span>
  )
}

export function TypePicker({ value, onChange }: { value: TrainingType; onChange: (t: TrainingType) => void }) {
  return (
    <div className="chips">
      {TRAINING_TYPES.map((t) => (
        <button
          type="button"
          key={t.value}
          className={'chip' + (value === t.value ? ' active' : '')}
          style={value === t.value ? { background: t.color, borderColor: t.color, color: '#0e0f12' } : undefined}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function FieldPicker({ value, onChange }: { value: FieldKey[]; onChange: (f: FieldKey[]) => void }) {
  const toggle = (k: FieldKey) => {
    const next = value.includes(k) ? value.filter((x) => x !== k) : [...value, k]
    // mantém a ordem padrão dos campos
    onChange(FIELD_DEFS.map((f) => f.key).filter((x) => next.includes(x)))
  }
  return (
    <div className="chips">
      {FIELD_DEFS.map((f) => (
        <button
          type="button"
          key={f.key}
          className={'chip' + (value.includes(f.key) ? ' active' : '')}
          onClick={() => toggle(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Modal (bottom sheet) ---------- */

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Inputs que salvam sozinhos (debounce + blur) ---------- */

function useCommit(value: string, onCommit: (v: string) => void) {
  const [local, setLocal] = useState(value)
  const focused = useRef(false)
  const timer = useRef<number>()
  const latest = useRef({ local, onCommit, value })
  latest.current = { local, onCommit, value }

  useEffect(() => {
    if (!focused.current) setLocal(value)
  }, [value])

  useEffect(
    () => () => {
      // salva pendências ao sair da tela
      if (timer.current) {
        clearTimeout(timer.current)
        const l = latest.current
        if (l.local !== l.value) l.onCommit(l.local)
      }
    },
    [],
  )

  const flush = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = undefined
    const l = latest.current
    if (l.local !== l.value) l.onCommit(l.local)
  }

  return {
    value: local,
    onFocus: () => {
      focused.current = true
    },
    onBlur: () => {
      focused.current = false
      flush()
    },
    onChange: (v: string) => {
      setLocal(v)
      if (timer.current) clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        latest.current.onCommit(v)
      }, 600)
    },
  }
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'onBlur' | 'onFocus'>

export function CommitInput({ value, onCommit, ...rest }: InputProps & {
  value: string
  onCommit: (v: string) => void
}) {
  const c = useCommit(value, onCommit)
  return (
    <input
      {...rest}
      value={c.value}
      onFocus={c.onFocus}
      onBlur={c.onBlur}
      onChange={(e) => c.onChange(e.target.value)}
    />
  )
}

type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'onBlur' | 'onFocus'>

export function CommitTextarea({ value, onCommit, ...rest }: TextareaProps & {
  value: string
  onCommit: (v: string) => void
}) {
  const c = useCommit(value, onCommit)
  return (
    <textarea
      {...rest}
      value={c.value}
      onFocus={c.onFocus}
      onBlur={c.onBlur}
      onChange={(e) => c.onChange(e.target.value)}
    />
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="muted small">{hint}</span>}
    </label>
  )
}

/* ---------- Fotos: usa o app de câmera nativo do celular ---------- */

export function PhotoButtons({ onFile, cameraLabel = 'Câmera', galleryLabel = 'Galeria', small }: {
  onFile: (f: File) => void
  cameraLabel?: string
  galleryLabel?: string
  small?: boolean
}) {
  const cam = useRef<HTMLInputElement>(null)
  const gal = useRef<HTMLInputElement>(null)
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) onFile(f)
  }
  const cls = 'btn' + (small ? ' btn-sm' : '')
  return (
    <div className="row gap-sm wrap">
      <button type="button" className={cls} onClick={() => cam.current?.click()}>
        <Camera size={18} /> {cameraLabel}
      </button>
      <button type="button" className={cls + ' btn-ghost'} onClick={() => gal.current?.click()}>
        <ImageIcon size={18} /> {galleryLabel}
      </button>
      {/* capture => abre diretamente o app de câmera do Android */}
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <input ref={gal} type="file" accept="image/*" hidden onChange={handle} />
    </div>
  )
}

export function useObjectUrl(blob?: Blob | null) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function useFileUrl(fileId?: string) {
  const file = useLiveQuery(() => (fileId ? db.files.get(fileId) : undefined), [fileId])
  return useObjectUrl(file?.blob)
}

export function FileImage({ fileId, alt = '', className, onClick }: {
  fileId?: string
  alt?: string
  className?: string
  onClick?: () => void
}) {
  const url = useFileUrl(fileId)
  if (!url) return <div className={'img-placeholder ' + (className ?? '')} />
  return <img src={url} alt={alt} className={className} onClick={onClick} loading="lazy" />
}

export function ImageViewer({ fileId, open, onClose, title, children }: {
  fileId?: string
  open: boolean
  onClose: () => void
  title?: ReactNode
  children?: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <FileImage fileId={fileId} className="viewer-img" />
      {children}
    </Modal>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
