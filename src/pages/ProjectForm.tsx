import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, PROJECT_COLORS } from '../db'
import { createProject, setProjectPhoto } from '../lib/repo'
import { Field, PageHeader, PhotoButtons, useObjectUrl } from '../components/ui'
import { todayISO } from '../lib/utils'

export default function ProjectForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const editing = !!id

  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])
  const existing = useLiveQuery(() => (id ? db.projects.get(id) : undefined), [id])

  const [name, setName] = useState('')
  const [objectives, setObjectives] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState('')
  const [feedback, setFeedback] = useState('')
  const [copyFrom, setCopyFrom] = useState(params.get('copy') ?? '')
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const preview = useObjectUrl(photo)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setObjectives(existing.objectives)
      setColor(existing.color)
      setStartDate(existing.startDate)
      setEndDate(existing.endDate ?? '')
      setFeedback(existing.feedback ?? '')
    }
  }, [existing])

  useEffect(() => {
    // cor diferente para cada novo projeto
    if (!editing && projects) setColor(PROJECT_COLORS[projects.length % PROJECT_COLORS.length])
  }, [editing, projects?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!name.trim()) return alert('Dê um nome ao projeto.')
    setSaving(true)
    try {
      if (editing && id) {
        await db.projects.update(id, {
          name: name.trim(),
          objectives,
          color,
          startDate,
          ...(existing?.status === 'finished' ? { endDate: endDate || todayISO(), feedback } : {}),
        })
        nav(`/projetos/${id}`, { replace: true })
      } else {
        const newId = await createProject({
          name: name.trim(),
          objectives,
          color,
          startDate,
          copyFromProjectId: copyFrom || undefined,
        })
        if (photo) await setProjectPhoto(newId, 'start', photo, startDate)
        nav(`/projetos/${newId}`, { replace: true })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader title={editing ? 'Editar projeto' : 'Novo projeto'} back />
      <div className="card stack">
        <Field label="Nome do projeto">
          <input
            className="input"
            value={name}
            placeholder="Ex.: Hipertrofia verão, Primeira muscle-up…"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Objetivos">
          <textarea
            className="input"
            rows={4}
            value={objectives}
            placeholder="O que você quer alcançar? Metas de peso, carga, habilidades…"
            onChange={(e) => setObjectives(e.target.value)}
          />
        </Field>
        <Field label="Data de início">
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Cor</span>
          <div className="row gap-sm">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={'color-dot' + (c === color ? ' active' : '')}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        {!editing && (
          <>
            <div className="field">
              <span className="field-label">Foto do dia 1 (opcional)</span>
              {preview && <img src={preview} className="form-photo" alt="" />}
              <PhotoButtons onFile={setPhoto} cameraLabel={photo ? 'Tirar outra' : 'Tirar foto'} />
            </div>
            {projects && projects.length > 0 && (
              <Field label="Plano semanal" hint="Copiar o plano de outro projeto ou começar do zero.">
                <select className="input" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                  <option value="">Começar do zero</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      Copiar de: {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}

        {editing && existing?.status === 'finished' && (
          <>
            <Field label="Data de encerramento">
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field label="Feedback do projeto">
              <textarea className="input" rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </Field>
          </>
        )}

        <button className="btn btn-lg" onClick={save} disabled={saving}>
          {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar projeto'}
        </button>
      </div>
    </div>
  )
}
