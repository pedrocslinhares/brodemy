import { db, type Session, type SessionExercise, type SetLog } from '../db'

export const setVolume = (s: SetLog) => (s.load != null && s.reps != null ? s.load * s.reps : 0)

/** 1RM estimada (fórmula de Epley) */
export const estimate1RM = (s: SetLog) =>
  s.load != null && s.reps != null && s.reps > 0 ? s.load * (1 + s.reps / 30) : undefined

export interface SessionSummary {
  exercises: number
  sets: number
  volume: number
}

export function summarize(sets: SetLog[], exercises: number): SessionSummary {
  return { exercises, sets: sets.length, volume: sets.reduce((a, s) => a + setVolume(s), 0) }
}

export interface Dataset {
  sessions: Session[]
  exercises: SessionExercise[]
  sets: SetLog[]
}

export async function loadDataset(projectId?: string): Promise<Dataset> {
  if (projectId) {
    const [sessions, exercises, sets] = await Promise.all([
      db.sessions.where('projectId').equals(projectId).toArray(),
      db.sessionExercises.where('projectId').equals(projectId).toArray(),
      db.sets.where('projectId').equals(projectId).toArray(),
    ])
    return { sessions, exercises, sets }
  }
  const [sessions, exercises, sets] = await Promise.all([
    db.sessions.toArray(),
    db.sessionExercises.toArray(),
    db.sets.toArray(),
  ])
  return { sessions, exercises, sets }
}

export interface ExercisePoint {
  date: string
  startedAt: number
  sessionId: string
  maxLoad?: number
  volume: number
  maxReps?: number
  totalReps: number
  maxTime?: number
  maxDistance?: number
  e1rm?: number
  sets: number
}

export interface ExerciseInfo {
  key: string
  name: string
  count: number
}

export function exerciseList(ds: Dataset): ExerciseInfo[] {
  const withSets = new Set(ds.sets.map((s) => s.sessionExerciseId))
  const map = new Map<string, ExerciseInfo>()
  for (const ex of ds.exercises) {
    if (!ex.nameKey || !withSets.has(ex.id)) continue
    const cur = map.get(ex.nameKey)
    if (cur) cur.count++
    else map.set(ex.nameKey, { key: ex.nameKey, name: ex.name.trim(), count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

const maxOf = (vals: (number | undefined)[]) => {
  const v = vals.filter((x): x is number => x != null)
  return v.length ? Math.max(...v) : undefined
}

export function exerciseSeries(ds: Dataset, key: string): ExercisePoint[] {
  const sessions = new Map(ds.sessions.map((s) => [s.id, s]))
  const points: ExercisePoint[] = []
  for (const ex of ds.exercises) {
    if (ex.nameKey !== key) continue
    const session = sessions.get(ex.sessionId)
    const sets = ds.sets.filter((s) => s.sessionExerciseId === ex.id)
    if (!session || !sets.length) continue
    points.push({
      date: session.date,
      startedAt: session.startedAt,
      sessionId: session.id,
      maxLoad: maxOf(sets.map((s) => s.load)),
      volume: sets.reduce((a, s) => a + setVolume(s), 0),
      maxReps: maxOf(sets.map((s) => s.reps)),
      totalReps: sets.reduce((a, s) => a + (s.reps ?? 0), 0),
      maxTime: maxOf(sets.map((s) => s.timeSec)),
      maxDistance: maxOf(sets.map((s) => s.distance)),
      e1rm: maxOf(sets.map(estimate1RM)),
      sets: sets.length,
    })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date) || a.startedAt - b.startedAt)
}
