import {
  db,
  type MediaItem,
  type Photo,
  type PlanDay,
  type PlanExercise,
  type Project,
  type Session,
  type SessionExercise,
  type SetLog,
  type StoredFile,
} from '../db'
import { blobToDataURL, todayISO, uid } from './utils'

/*
 * Exporta / importa UM projeto.
 * - "plan": plano semanal (dias, exercícios, fotos dos equipamentos, vídeos e links) — para compartilhar.
 * - "full": plano + treinos, séries e fotos de progresso — para migrar de celular.
 * A importação sempre ADICIONA um novo projeto (novos ids), sem mexer nos dados existentes.
 */

export type ExportScope = 'plan' | 'full'

interface FileEntry {
  id: string
  name: string
  type: string
  dataUrl: string
}

export interface ProjectFile {
  app: 'brodemy'
  kind: 'project'
  version: 1
  scope: ExportScope
  exportedAt: string
  project: Project
  planDays: PlanDay[]
  planExercises: PlanExercise[]
  sessions: Session[]
  sessionExercises: SessionExercise[]
  sets: SetLog[]
  photos: Photo[]
  files: FileEntry[]
}

async function projectData(projectId: string) {
  const [project, planDays, planExercises, sessions, sessionExercises, sets, photos] = await Promise.all([
    db.projects.get(projectId),
    db.planDays.where('projectId').equals(projectId).toArray(),
    db.planExercises.where('projectId').equals(projectId).toArray(),
    db.sessions.where('projectId').equals(projectId).toArray(),
    db.sessionExercises.where('projectId').equals(projectId).toArray(),
    db.sets.where('projectId').equals(projectId).toArray(),
    db.photos.where('projectId').equals(projectId).toArray(),
  ])
  if (!project) throw new Error('Projeto não encontrado.')
  return { project, planDays, planExercises, sessions, sessionExercises, sets, photos }
}

const isVideoFile = (m: MediaItem) => m.kind === 'video-file' && !!m.fileId
const videoIdsOf = (media: MediaItem[] = []) => media.filter(isVideoFile).map((m) => m.fileId!)
const videoFileIds = (days: PlanDay[], exercises: { media?: MediaItem[] }[]) => [
  ...new Set([...days.flatMap((d) => videoIdsOf(d.media)), ...exercises.flatMap((e) => videoIdsOf(e.media))]),
]
const withoutVideos = (media: MediaItem[] = []) => media.filter((m) => !isVideoFile(m))
const remapMedia = (media: MediaItem[] | undefined, mapOpt: (id?: string) => string | undefined) =>
  media?.map((m) => ({ ...m, id: uid(), fileId: mapOpt(m.fileId) }))

/** Informações para a tela de exportação (tamanhos e contagens) */
export async function exportInfo(projectId: string) {
  const d = await projectData(projectId)
  const sizeOf = async (ids: string[]) =>
    (await db.files.bulkGet([...new Set(ids)])).reduce((a, f) => a + (f?.size ?? 0), 0)
  const equipIds = [...d.planExercises, ...d.sessionExercises].map((e) => e.equipmentPhotoId).filter(Boolean) as string[]
  return {
    sessions: d.sessions.length,
    sets: d.sets.length,
    photos: d.photos.length,
    videos: videoFileIds(d.planDays, [...d.planExercises, ...d.sessionExercises]).length,
    videosSize: await sizeOf(videoFileIds(d.planDays, [...d.planExercises, ...d.sessionExercises])),
    photosSize: await sizeOf(d.photos.map((p) => p.fileId)),
    equipSize: await sizeOf(equipIds),
  }
}

export async function exportProject(
  projectId: string,
  opts: { scope: ExportScope; includeVideos: boolean },
): Promise<Blob> {
  const d = await projectData(projectId)
  const full = opts.scope === 'full'

  // vídeos da galeria podem ser grandes: opcionais
  const strip = <T extends { media?: MediaItem[] }>(x: T): T =>
    opts.includeVideos ? x : { ...x, media: x.media && withoutVideos(x.media) }
  const planDays = d.planDays.map((day) => ({ ...strip(day), media: strip(day).media ?? [] }))
  const planExercises = d.planExercises.map(strip)

  const sessions = full ? d.sessions : []
  const sessionExercises = full ? d.sessionExercises.map(strip) : []
  const sets = full ? d.sets : []
  const photos = full ? d.photos : []

  const project: Project = full
    ? d.project
    : { ...d.project, status: 'active', endDate: undefined, feedback: undefined, finishedAt: undefined }

  const fileIds = new Set<string>()
  planDays.forEach((day) => day.media.forEach((m) => m.fileId && fileIds.add(m.fileId)))
  ;[...planExercises, ...sessionExercises].forEach((e) => {
    if (e.equipmentPhotoId) fileIds.add(e.equipmentPhotoId)
    e.media?.forEach((m) => m.fileId && fileIds.add(m.fileId))
  })
  photos.forEach((p) => fileIds.add(p.fileId))

  const files: FileEntry[] = []
  for (const f of await db.files.bulkGet([...fileIds])) {
    if (f) files.push({ id: f.id, name: f.name, type: f.type, dataUrl: await blobToDataURL(f.blob) })
  }

  const payload: ProjectFile = {
    app: 'brodemy',
    kind: 'project',
    version: 1,
    scope: opts.scope,
    exportedAt: new Date().toISOString(),
    project,
    planDays,
    planExercises,
    sessions,
    sessionExercises,
    sets,
    photos,
    files,
  }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function readProjectFile(file: Blob): Promise<ProjectFile> {
  let data: unknown
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('Arquivo inválido.')
  }
  const p = data as Partial<ProjectFile> & { tables?: unknown }
  if (p?.app !== 'brodemy') throw new Error('Este arquivo não é do Brodemy.')
  if (p.tables) throw new Error('Este arquivo é uma cópia de segurança completa. Restaure em Ajustes → Restaurar cópia de segurança.')
  if (p.kind !== 'project' || !p.project || !Array.isArray(p.planDays)) throw new Error('Arquivo de projeto inválido.')
  return {
    ...(p as ProjectFile),
    planExercises: p.planExercises ?? [],
    sessions: p.sessions ?? [],
    sessionExercises: p.sessionExercises ?? [],
    sets: p.sets ?? [],
    photos: p.photos ?? [],
    files: p.files ?? [],
  }
}

export interface ImportOptions {
  name: string
  includeHistory: boolean
  includePhotos: boolean
}

export async function importProject(data: ProjectFile, opts: ImportOptions): Promise<string> {
  const withHistory = opts.includeHistory && data.sessions.length > 0
  const withPhotos = opts.includePhotos && data.photos.length > 0

  // mapeamento de ids antigos -> novos
  const ids = new Map<string, string>()
  const map = (old: string) => {
    let n = ids.get(old)
    if (!n) ids.set(old, (n = uid()))
    return n
  }
  const mapOpt = (old?: string) => (old ? map(old) : undefined)

  const projectId = uid()
  const keepOriginal = withHistory || withPhotos
  const src = data.project
  const project: Project = {
    id: projectId,
    name: opts.name.trim() || src.name,
    objectives: src.objectives ?? '',
    color: src.color,
    createdAt: Date.now(),
    // só o plano: começa um projeto novo hoje; com registros: mantém datas e status originais
    status: keepOriginal ? src.status : 'active',
    startDate: keepOriginal ? src.startDate : todayISO(),
    endDate: keepOriginal ? src.endDate : undefined,
    feedback: keepOriginal ? src.feedback : undefined,
    finishedAt: keepOriginal ? src.finishedAt : undefined,
  }

  const planDays: PlanDay[] = data.planDays.map((d) => ({
    ...d,
    id: map(d.id),
    projectId,
    media: d.media.map((m: MediaItem) => ({ ...m, id: uid(), fileId: mapOpt(m.fileId) })),
  }))
  // garante os 7 dias da semana
  for (let wd = 0; wd < 7; wd++) {
    if (!planDays.some((d) => d.weekday === wd))
      planDays.push({ id: uid(), projectId, weekday: wd, name: '', type: 'academia', notes: '', media: [] })
  }
  const planExercises: PlanExercise[] = data.planExercises
    .filter((e) => ids.has(e.dayId))
    .map((e) => ({
      ...e,
      id: map(e.id),
      dayId: map(e.dayId),
      projectId,
      equipmentPhotoId: mapOpt(e.equipmentPhotoId),
      media: remapMedia(e.media, mapOpt),
    }))

  let sessions: Session[] = []
  let sessionExercises: SessionExercise[] = []
  let sets: SetLog[] = []
  if (withHistory) {
    sessions = data.sessions.map((s) => ({
      ...s,
      id: map(s.id),
      projectId,
      dayId: s.dayId && ids.has(s.dayId) ? map(s.dayId) : undefined,
    }))
    sessionExercises = data.sessionExercises
      .filter((e) => ids.has(e.sessionId))
      .map((e) => ({
        ...e,
        id: map(e.id),
        sessionId: map(e.sessionId),
        projectId,
        equipmentPhotoId: mapOpt(e.equipmentPhotoId),
        media: remapMedia(e.media, mapOpt),
        planExerciseId: e.planExerciseId && ids.has(e.planExerciseId) ? map(e.planExerciseId) : undefined,
      }))
    sets = data.sets
      .filter((s) => ids.has(s.sessionId) && ids.has(s.sessionExerciseId))
      .map((s) => ({
        ...s,
        id: uid(),
        sessionId: map(s.sessionId),
        sessionExerciseId: map(s.sessionExerciseId),
        projectId,
      }))
  }

  const photos: Photo[] = withPhotos
    ? data.photos.map((p) => ({
        ...p,
        id: uid(),
        projectId,
        fileId: map(p.fileId),
        sessionId: withHistory && p.sessionId && ids.has(p.sessionId) ? map(p.sessionId) : undefined,
      }))
    : []

  // apenas os arquivos realmente usados pelo que foi importado
  const used = new Set<string>()
  planDays.forEach((d) => d.media.forEach((m) => m.fileId && used.add(m.fileId)))
  ;[...planExercises, ...sessionExercises].forEach((e) => {
    if (e.equipmentPhotoId) used.add(e.equipmentPhotoId)
    e.media?.forEach((m) => m.fileId && used.add(m.fileId))
  })
  photos.forEach((p) => used.add(p.fileId))

  const files: StoredFile[] = []
  for (const f of data.files) {
    const newId = ids.get(f.id)
    if (!newId || !used.has(newId)) continue
    const blob = await (await fetch(f.dataUrl)).blob()
    files.push({ id: newId, blob, name: f.name, type: f.type || blob.type, size: blob.size, createdAt: Date.now() })
  }
  // remove referências a arquivos que não vieram no arquivo exportado
  const have = new Set(files.map((f) => f.id))
  planDays.forEach((d) => (d.media = d.media.filter((m) => !m.fileId || have.has(m.fileId))))
  ;[...planExercises, ...sessionExercises].forEach((e) => {
    if (e.equipmentPhotoId && !have.has(e.equipmentPhotoId)) e.equipmentPhotoId = undefined
    if (e.media) e.media = e.media.filter((m) => !m.fileId || have.has(m.fileId))
  })
  const validPhotos = photos.filter((p) => have.has(p.fileId))

  await db.transaction(
    'rw',
    [db.projects, db.planDays, db.planExercises, db.sessions, db.sessionExercises, db.sets, db.photos, db.files],
    async () => {
      await db.files.bulkAdd(files)
      await db.projects.add(project)
      await db.planDays.bulkAdd(planDays)
      await db.planExercises.bulkAdd(planExercises)
      await db.sessions.bulkAdd(sessions)
      await db.sessionExercises.bulkAdd(sessionExercises)
      await db.sets.bulkAdd(sets)
      await db.photos.bulkAdd(validPhotos)
    },
  )
  return projectId
}
