import { db, typeInfo } from '../db'
import { formatDate, formatDuration, WEEKDAYS, parseISODate } from './utils'
import { loadDataset, setVolume } from './stats'

type Cell = string | number | undefined | null

function cell(v: Cell): string {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV com ";" e BOM para abrir corretamente no Excel / Planilhas em pt-BR */
export function toCSV(rows: Cell[][]): Blob {
  const text = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')
  return new Blob([text], { type: 'text/csv;charset=utf-8' })
}

async function projectNames() {
  const projects = await db.projects.toArray()
  return new Map(projects.map((p) => [p.id, p.name]))
}

/** Uma linha por série registrada */
export async function setsCSV(projectId?: string): Promise<Blob> {
  const ds = await loadDataset(projectId)
  const names = await projectNames()
  const sessions = new Map(ds.sessions.map((s) => [s.id, s]))
  const exercises = new Map(ds.exercises.map((e) => [e.id, e]))
  const rows: Cell[][] = [
    ['Data', 'Dia da semana', 'Projeto', 'Treino', 'Tipo', 'Exercício', 'Equipamento', 'Série',
      'Carga (kg)', 'Repetições', 'Tempo (s)', 'Tempo', 'Distância (m)', 'Descanso (s)', 'Volume (kg)', 'Observação'],
  ]
  const sorted = [...ds.sets].sort((a, b) => {
    const sa = sessions.get(a.sessionId)
    const sb = sessions.get(b.sessionId)
    const ea = exercises.get(a.sessionExerciseId)
    const eb = exercises.get(b.sessionExerciseId)
    return (
      (sa?.date ?? '').localeCompare(sb?.date ?? '') ||
      (sa?.startedAt ?? 0) - (sb?.startedAt ?? 0) ||
      (ea?.order ?? 0) - (eb?.order ?? 0) ||
      a.order - b.order
    )
  })
  const counter = new Map<string, number>()
  for (const set of sorted) {
    const s = sessions.get(set.sessionId)
    const ex = exercises.get(set.sessionExerciseId)
    if (!s || !ex) continue
    const n = (counter.get(ex.id) ?? 0) + 1
    counter.set(ex.id, n)
    rows.push([
      formatDate(s.date),
      WEEKDAYS[parseISODate(s.date).getDay()],
      names.get(s.projectId),
      s.title,
      typeInfo(s.type).label,
      ex.name,
      ex.equipment,
      n,
      set.load,
      set.reps,
      set.timeSec,
      set.timeSec != null ? formatDuration(set.timeSec) : '',
      set.distance,
      set.restSec,
      setVolume(set) || undefined,
      set.note,
    ])
  }
  return toCSV(rows)
}

/** Uma linha por treino realizado */
export async function sessionsCSV(projectId?: string): Promise<Blob> {
  const ds = await loadDataset(projectId)
  const names = await projectNames()
  const rows: Cell[][] = [
    ['Data', 'Projeto', 'Treino', 'Tipo', 'Exercícios', 'Séries', 'Volume (kg)', 'Duração (min)', 'Status', 'Observações'],
  ]
  for (const s of [...ds.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const sets = ds.sets.filter((x) => x.sessionId === s.id)
    const exCount = ds.exercises.filter((e) => e.sessionId === s.id).length
    rows.push([
      formatDate(s.date),
      names.get(s.projectId),
      s.title,
      typeInfo(s.type).label,
      exCount,
      sets.length,
      sets.reduce((a, x) => a + setVolume(x), 0),
      s.finishedAt ? Math.round((s.finishedAt - s.startedAt) / 60000) : undefined,
      s.finishedAt ? 'Concluído' : 'Em andamento',
      s.notes,
    ])
  }
  return toCSV(rows)
}

export async function projectsCSV(): Promise<Blob> {
  const projects = await db.projects.orderBy('createdAt').toArray()
  const sessions = await db.sessions.toArray()
  const rows: Cell[][] = [['Projeto', 'Status', 'Início', 'Fim', 'Objetivos', 'Treinos', 'Feedback']]
  for (const p of projects) {
    rows.push([
      p.name,
      p.status === 'active' ? 'Ativo' : 'Encerrado',
      formatDate(p.startDate),
      formatDate(p.endDate),
      p.objectives,
      sessions.filter((s) => s.projectId === p.id).length,
      p.feedback,
    ])
  }
  return toCSV(rows)
}
