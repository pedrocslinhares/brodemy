export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)

const pad = (n: number) => String(n).padStart(2, '0')

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDateShort(iso?: string): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
/** Ordem de exibição: segunda a domingo */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000)
}

/** Segunda-feira da semana da data informada */
export function weekStart(iso: string): string {
  const d = parseISODate(iso)
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return todayISO(d)
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return todayISO(d)
}

export function monthLabel(iso: string): string {
  const s = parseISODate(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function parseNumber(s: string): number | undefined {
  const t = s.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function fmtNum(n?: number, max = 2): string {
  return n == null ? '' : n.toLocaleString('pt-BR', { maximumFractionDigits: max })
}

/** Número para campo de edição (vírgula decimal) */
export function numToInput(n?: number): string {
  return n == null ? '' : String(n).replace('.', ',')
}

/** Aceita "90", "1:30" ou "1:02:00" e devolve segundos */
export function parseDuration(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  if (t.includes(':')) {
    return t.split(':').reduce((acc, p) => acc * 60 + (Number(p) || 0), 0)
  }
  const n = parseNumber(t)
  return n == null ? undefined : Math.round(n)
}

export function formatDuration(sec?: number): string {
  if (sec == null) return ''
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

export function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]+)/)
      if (m) return m[2]
    }
  } catch {
    /* url inválida */
  }
  return null
}

export function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(url.trim())
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function normalizeUrl(url: string): string {
  const t = url.trim()
  if (!t) return t
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

/** Reduz a foto para economizar espaço no aparelho */
export async function compressImage(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    return out ?? file
  } catch {
    return file
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function shareFile(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return true
    } catch {
      return false
    }
  }
  downloadBlob(blob, filename)
  return true
}
