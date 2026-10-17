import Dexie, { type Table } from 'dexie'

/* ---------- Tipos de treino ---------- */
export type TrainingType = 'academia' | 'street' | 'calistenia' | 'outro'

export const TRAINING_TYPES: { value: TrainingType; label: string; color: string }[] = [
  { value: 'academia', label: 'Academia', color: '#7cc4ff' },
  { value: 'street', label: 'Street', color: '#ffb35c' },
  { value: 'calistenia', label: 'Calistenia', color: '#c6f432' },
  { value: 'outro', label: 'Outro', color: '#b99cff' },
]

export function typeInfo(t?: TrainingType) {
  return TRAINING_TYPES.find((x) => x.value === t) ?? TRAINING_TYPES[3]
}

/* ---------- Campos registráveis por série (todos opcionais) ---------- */
export type FieldKey = 'load' | 'reps' | 'time' | 'distance' | 'rest' | 'note'

export const FIELD_DEFS: { key: FieldKey; label: string; short: string }[] = [
  { key: 'load', label: 'Carga (kg)', short: 'Kg' },
  { key: 'reps', label: 'Repetições', short: 'Reps' },
  { key: 'time', label: 'Tempo', short: 'Tempo' },
  { key: 'distance', label: 'Distância (m)', short: 'Dist. m' },
  { key: 'rest', label: 'Descanso', short: 'Desc.' },
  { key: 'note', label: 'Observação', short: 'Obs.' },
]

export const DEFAULT_FIELDS: Record<TrainingType, FieldKey[]> = {
  academia: ['load', 'reps', 'rest'],
  street: ['reps', 'load', 'rest'],
  calistenia: ['reps', 'time', 'rest'],
  outro: ['reps', 'time', 'rest'],
}

/* ---------- Mídia (vídeos e links) ---------- */
export type MediaKind = 'youtube' | 'video-url' | 'video-file' | 'link'
export interface MediaItem {
  id: string
  kind: MediaKind
  title: string
  url?: string
  fileId?: string
}

/* ---------- Entidades ---------- */
export interface Project {
  id: string
  name: string
  objectives: string
  color: string
  status: 'active' | 'finished'
  startDate: string // YYYY-MM-DD
  endDate?: string
  feedback?: string
  createdAt: number
  finishedAt?: number
}

export interface PlanDay {
  id: string
  projectId: string
  weekday: number // 0 = domingo ... 6 = sábado
  name: string
  type: TrainingType
  notes: string
  media: MediaItem[]
}

/** Campos comuns entre exercício do plano e exercício executado */
export interface ExerciseBase {
  id: string
  projectId: string
  order: number
  name: string
  equipment: string
  equipmentPhotoId?: string
  fields: FieldKey[]
  restSec?: number
  target: string
  notes: string
}

export interface PlanExercise extends ExerciseBase {
  dayId: string
}

export interface Session {
  id: string
  projectId: string
  dayId?: string
  date: string // YYYY-MM-DD
  title: string
  type: TrainingType
  startedAt: number
  finishedAt?: number
  notes: string
}

export interface SessionExercise extends ExerciseBase {
  sessionId: string
  nameKey: string
  planExerciseId?: string
}

export interface SetLog {
  id: string
  sessionId: string
  sessionExerciseId: string
  projectId: string
  order: number
  load?: number
  reps?: number
  timeSec?: number
  distance?: number
  restSec?: number
  note?: string
  createdAt: number
}

export type PhotoKind = 'start' | 'progress' | 'end'
export interface Photo {
  id: string
  projectId: string
  sessionId?: string
  kind: PhotoKind
  date: string
  fileId: string
  note?: string
  createdAt: number
}

export interface StoredFile {
  id: string
  blob: Blob
  name: string
  type: string
  size: number
  createdAt: number
}

export interface Setting {
  key: string
  value: unknown
}

/* ---------- Banco de dados embutido (IndexedDB) ---------- */
class BrodemyDB extends Dexie {
  projects!: Table<Project, string>
  planDays!: Table<PlanDay, string>
  planExercises!: Table<PlanExercise, string>
  sessions!: Table<Session, string>
  sessionExercises!: Table<SessionExercise, string>
  sets!: Table<SetLog, string>
  photos!: Table<Photo, string>
  files!: Table<StoredFile, string>
  settings!: Table<Setting, string>

  constructor() {
    super('brodemy')
    this.version(1).stores({
      projects: 'id, status, createdAt',
      planDays: 'id, projectId, weekday',
      planExercises: 'id, dayId, projectId',
      sessions: 'id, projectId, dayId, date',
      sessionExercises: 'id, sessionId, projectId, nameKey',
      sets: 'id, sessionId, sessionExerciseId, projectId',
      photos: 'id, projectId, sessionId, date',
      files: 'id',
      settings: 'key',
    })
  }
}

export const db = new BrodemyDB()

export const PROJECT_COLORS = ['#c6f432', '#7cc4ff', '#ffb35c', '#ff7ab6', '#b99cff', '#4fe0c0']
