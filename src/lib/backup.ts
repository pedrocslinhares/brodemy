import { db, type StoredFile } from '../db'
import { blobToDataURL } from './utils'

/*
 * Cópia de segurança: os dados vivem no banco embutido (IndexedDB).
 * Este arquivo serve apenas para levar os dados para outro aparelho
 * ou guardar uma cópia fora do celular.
 */

export async function exportBackup(): Promise<Blob> {
  const tables: Record<string, unknown[]> = {}
  for (const t of db.tables) {
    const rows = await t.toArray()
    if (t.name === 'files') {
      tables.files = await Promise.all(
        (rows as StoredFile[]).map(async ({ blob, ...rest }) => ({ ...rest, dataUrl: await blobToDataURL(blob) })),
      )
    } else {
      tables[t.name] = rows
    }
  }
  const payload = { app: 'brodemy', version: 1, exportedAt: new Date().toISOString(), tables }
  return new Blob([JSON.stringify(payload)], { type: 'application/json' })
}

export async function importBackup(file: Blob) {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'brodemy' || !data.tables) throw new Error('Arquivo não é um backup do Brodemy.')

  // Converte as mídias antes da transação (fetch não pode rodar dentro dela)
  const files: StoredFile[] = await Promise.all(
    (data.tables.files ?? []).map(async (f: StoredFile & { dataUrl: string }) => {
      const { dataUrl, ...rest } = f
      return { ...rest, blob: await (await fetch(dataUrl)).blob() }
    }),
  )

  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear()
      const rows = t.name === 'files' ? files : data.tables[t.name]
      if (Array.isArray(rows) && rows.length) await t.bulkPut(rows)
    }
  })
}
