import {
  db,
  DEFAULT_FIELDS,
  type ExerciseBase,
  type PhotoKind,
  type Session,
  type SessionExercise,
  type SetLog,
} from '../db'
import { compressImage, normalizeKey, todayISO, uid, WEEKDAYS } from './utils'

/* ---------- Arquivos ---------- */

export async function addFile(blob: Blob, name = 'arquivo'): Promise<string> {
  const id = uid()
  await db.files.add({ id, blob, name, type: blob.type, size: blob.size, createdAt: Date.now() })
  return id
}

export async function addImageFile(file: Blob): Promise<string> {
  return addFile(await compressImage(file), 'foto.jpg')
}

/** Remove arquivos que não são mais referenciados por nenhum registro */
export async function cleanupOrphanFiles() {
  const used = new Set<string>()
  ;(await db.photos.toArray()).forEach((p) => used.add(p.fileId))
  ;(await db.planExercises.toArray()).forEach((e) => e.equipmentPhotoId && used.add(e.equipmentPhotoId))
  ;(await db.sessionExercises.toArray()).forEach((e) => e.equipmentPhotoId && used.add(e.equipmentPhotoId))
  ;(await db.planDays.toArray()).forEach((d) => d.media.forEach((m) => m.fileId && used.add(m.fileId)))
  const all = await db.files.toCollection().primaryKeys()
  const orphans = all.filter((id) => !used.has(id))
  if (orphans.length) await db.files.bulkDelete(orphans)
}

/* ---------- Fotos de progresso ---------- */

export async function addPhoto(
  projectId: string,
  kind: PhotoKind,
  file: Blob,
  opts: { date?: string; sessionId?: string } = {},
) {
  const fileId = await addImageFile(file)
  const id = uid()
  await db.photos.add({
    id,
    projectId,
    kind,
    fileId,
    sessionId: opts.sessionId,
    date: opts.date ?? todayISO(),
    createdAt: Date.now(),
  })
  return id
}

/** Foto do dia 1 ou foto final: substitui a anterior do mesmo tipo */
export async function setProjectPhoto(projectId: string, kind: 'start' | 'end', file: Blob, date: string) {
  const old = await db.photos.where('projectId').equals(projectId).filter((p) => p.kind === kind).primaryKeys()
  await db.photos.bulkDelete(old)
  await addPhoto(projectId, kind, file, { date })
  await cleanupOrphanFiles()
}

export async function deletePhoto(id: string) {
  await db.photos.delete(id)
  await cleanupOrphanFiles()
}

/* ---------- Projetos ---------- */

export async function createProject(input: {
  name: string
  objectives: string
  color: string
  startDate: string
  copyFromProjectId?: string
}): Promise<string> {
  const id = uid()
  await db.transaction('rw', db.projects, db.planDays, db.planExercises, async () => {
    await db.projects.add({
      id,
      name: input.name,
      objectives: input.objectives,
      color: input.color,
      startDate: input.startDate,
      status: 'active',
      createdAt: Date.now(),
    })
    const srcDays = input.copyFromProjectId
      ? await db.planDays.where('projectId').equals(input.copyFromProjectId).toArray()
      : []
    for (let wd = 0; wd < 7; wd++) {
      const src = srcDays.find((d) => d.weekday === wd)
      const dayId = uid()
      await db.planDays.add({
        id: dayId,
        projectId: id,
        weekday: wd,
        name: src?.name ?? '',
        type: src?.type ?? 'academia',
        notes: src?.notes ?? '',
        media: src ? src.media.map((m) => ({ ...m, id: uid() })) : [],
      })
      if (src) {
        const exs = await db.planExercises.where('dayId').equals(src.id).toArray()
        await db.planExercises.bulkAdd(exs.map((e) => ({ ...e, id: uid(), dayId, projectId: id })))
      }
    }
  })
  return id
}

export async function deleteProject(id: string) {
  await db.transaction(
    'rw',
    [db.projects, db.planDays, db.planExercises, db.sessions, db.sessionExercises, db.sets, db.photos],
    async () => {
      await db.projects.delete(id)
      await db.planDays.where('projectId').equals(id).delete()
      await db.planExercises.where('projectId').equals(id).delete()
      await db.sessions.where('projectId').equals(id).delete()
      await db.sessionExercises.where('projectId').equals(id).delete()
      await db.sets.where('projectId').equals(id).delete()
      await db.photos.where('projectId').equals(id).delete()
    },
  )
  await cleanupOrphanFiles()
}

/* ---------- Plano ---------- */

export async function addPlanExercise(dayId: string, projectId: string): Promise<string> {
  const day = await db.planDays.get(dayId)
  const count = await db.planExercises.where('dayId').equals(dayId).count()
  const id = uid()
  await db.planExercises.add({
    id,
    dayId,
    projectId,
    order: count,
    name: '',
    equipment: '',
    fields: [...DEFAULT_FIELDS[day?.type ?? 'academia']],
    target: '',
    notes: '',
  })
  return id
}

/** Troca a ordem de um item com o vizinho (dir = -1 sobe, 1 desce) */
export async function moveExercise(
  table: 'planExercises' | 'sessionExercises',
  list: ExerciseBase[],
  index: number,
  dir: -1 | 1,
) {
  const j = index + dir
  if (j < 0 || j >= list.length) return
  const t = db.table<ExerciseBase, string>(table)
  const reordered = [...list]
  ;[reordered[index], reordered[j]] = [reordered[j], reordered[index]]
  await db.transaction('rw', t, async () => {
    for (let i = 0; i < reordered.length; i++) await t.update(reordered[i].id, { order: i })
  })
}

/* ---------- Sessões de treino ---------- */

export async function startSession(projectId: string, dayId?: string, date = todayISO()): Promise<string> {
  // Se já existe um treino aberto deste dia hoje, continua nele
  const open = await db.sessions
    .where('projectId')
    .equals(projectId)
    .filter((s) => !s.finishedAt && s.dayId === dayId && s.date === date)
    .first()
  if (open) return open.id

  const day = dayId ? await db.planDays.get(dayId) : undefined
  const exs = dayId ? await db.planExercises.where('dayId').equals(dayId).sortBy('order') : []
  const id = uid()
  await db.transaction('rw', db.sessions, db.sessionExercises, async () => {
    await db.sessions.add({
      id,
      projectId,
      dayId,
      date,
      title: day ? day.name || WEEKDAYS[day.weekday] : 'Treino livre',
      type: day?.type ?? 'outro',
      startedAt: Date.now(),
      notes: '',
    })
    await db.sessionExercises.bulkAdd(
      exs.map((e, i) => ({
        id: uid(),
        sessionId: id,
        projectId,
        order: i,
        name: e.name,
        nameKey: normalizeKey(e.name),
        equipment: e.equipment,
        equipmentPhotoId: e.equipmentPhotoId,
        fields: [...e.fields],
        restSec: e.restSec,
        target: e.target,
        notes: '',
        planExerciseId: e.id,
      })),
    )
  })
  return id
}

export async function addSessionExercise(
  session: Session,
  data: Partial<SessionExercise> & { name: string },
): Promise<string> {
  const count = await db.sessionExercises.where('sessionId').equals(session.id).count()
  const id = uid()
  await db.sessionExercises.add({
    id,
    sessionId: session.id,
    projectId: session.projectId,
    order: count,
    equipment: '',
    fields: [...DEFAULT_FIELDS[session.type]],
    target: '',
    notes: '',
    ...data,
    nameKey: normalizeKey(data.name),
  })
  return id
}

/** Nova série: copia os valores da série anterior para agilizar o registro */
export async function addSet(ex: SessionExercise): Promise<string> {
  const prev = await db.sets.where('sessionExerciseId').equals(ex.id).sortBy('order')
  const last = prev[prev.length - 1]
  const id = uid()
  const set: SetLog = {
    id,
    sessionId: ex.sessionId,
    sessionExerciseId: ex.id,
    projectId: ex.projectId,
    order: last ? last.order + 1 : 0,
    load: last?.load,
    reps: last?.reps,
    timeSec: last?.timeSec,
    distance: last?.distance,
    restSec: last?.restSec ?? ex.restSec,
    createdAt: Date.now(),
  }
  await db.sets.add(set)
  return id
}

export async function deleteSessionExercise(id: string) {
  await db.transaction('rw', db.sessionExercises, db.sets, async () => {
    await db.sessionExercises.delete(id)
    await db.sets.where('sessionExerciseId').equals(id).delete()
  })
  await cleanupOrphanFiles()
}

export async function finishSession(id: string, notes: string, photo?: Blob) {
  const s = await db.sessions.get(id)
  if (!s) return
  await db.sessions.update(id, { finishedAt: Date.now(), notes })
  if (photo) await addPhoto(s.projectId, 'progress', photo, { date: s.date, sessionId: id })
}

/** Exclui o treino. As fotos de progresso são mantidas no histórico do projeto. */
export async function deleteSession(id: string) {
  await db.transaction('rw', db.sessions, db.sessionExercises, db.sets, db.photos, async () => {
    await db.sessions.delete(id)
    await db.sessionExercises.where('sessionId').equals(id).delete()
    await db.sets.where('sessionId').equals(id).delete()
    await db.photos.where('sessionId').equals(id).modify({ sessionId: undefined })
  })
  await cleanupOrphanFiles()
}

/** Séries do último treino anterior com o mesmo exercício */
export async function previousSets(nameKey: string, currentSessionId: string, beforeDate: string) {
  if (!nameKey) return null
  const exs = await db.sessionExercises.where('nameKey').equals(nameKey).toArray()
  const candidates: { ex: SessionExercise; session: Session }[] = []
  for (const ex of exs) {
    if (ex.sessionId === currentSessionId) continue
    const session = await db.sessions.get(ex.sessionId)
    if (session && session.date <= beforeDate) candidates.push({ ex, session })
  }
  candidates.sort((a, b) =>
    a.session.date === b.session.date
      ? b.session.startedAt - a.session.startedAt
      : b.session.date.localeCompare(a.session.date),
  )
  for (const c of candidates) {
    const sets = await db.sets.where('sessionExerciseId').equals(c.ex.id).sortBy('order')
    if (sets.length) return { date: c.session.date, sets }
  }
  return null
}
