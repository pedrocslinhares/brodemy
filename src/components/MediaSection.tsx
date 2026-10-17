import { useRef, useState } from 'react'
import { ExternalLink, Film, Link2, Play, Plus, Trash2 } from 'lucide-react'
import type { MediaItem } from '../db'
import { addFile, cleanupOrphanFiles } from '../lib/repo'
import { formatBytes, hostname, isDirectVideo, normalizeUrl, uid, youtubeId } from '../lib/utils'
import { CommitInput, useFileUrl } from './ui'

function YouTubeEmbed({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false)
  return (
    <div className="video-frame">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <button className="video-poster" onClick={() => setPlay(true)} aria-label={`Reproduzir ${title}`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="play-overlay">
            <Play size={30} fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  )
}

function FileVideo({ fileId }: { fileId: string }) {
  const url = useFileUrl(fileId)
  return (
    <div className="video-frame">
      {url ? <video src={url} controls playsInline preload="metadata" /> : <div className="img-placeholder" />}
    </div>
  )
}

function MediaView({ item }: { item: MediaItem }) {
  if (item.kind === 'youtube' && item.url) {
    const id = youtubeId(item.url)
    if (id) return <YouTubeEmbed id={id} title={item.title} />
  }
  if (item.kind === 'video-url' && item.url) {
    return (
      <div className="video-frame">
        <video src={item.url} controls playsInline preload="metadata" />
      </div>
    )
  }
  if (item.kind === 'video-file' && item.fileId) return <FileVideo fileId={item.fileId} />
  return (
    <a className="link-card" href={item.url} target="_blank" rel="noopener noreferrer">
      <Link2 size={18} />
      <div className="grow ellipsis">
        <div className="ellipsis">{item.title || item.url}</div>
        <div className="muted small">{item.url ? hostname(item.url) : ''}</div>
      </div>
      <ExternalLink size={16} />
    </a>
  )
}

export function MediaSection({ items, editable, onChange }: {
  items: MediaItem[]
  editable?: boolean
  onChange?: (items: MediaItem[]) => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const videos = items.filter((m) => m.kind !== 'link')
  const links = items.filter((m) => m.kind === 'link')

  const addUrl = () => {
    const u = normalizeUrl(url)
    if (!u) return
    const kind: MediaItem['kind'] = youtubeId(u) ? 'youtube' : isDirectVideo(u) ? 'video-url' : 'link'
    onChange?.([...items, { id: uid(), kind, url: u, title: title.trim() || (kind === 'link' ? hostname(u) : 'Vídeo') }])
    setUrl('')
    setTitle('')
  }

  const addVideoFile = async (f: File) => {
    if (f.size > 200 * 1024 * 1024 && !confirm(`Este vídeo tem ${formatBytes(f.size)} e vai ocupar bastante espaço. Continuar?`)) return
    setBusy(true)
    try {
      const fileId = await addFile(f, f.name)
      onChange?.([...items, { id: uid(), kind: 'video-file', fileId, title: title.trim() || f.name }])
      setTitle('')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Remover esta mídia?')) return
    onChange?.(items.filter((m) => m.id !== id))
    setTimeout(cleanupOrphanFiles, 500)
  }

  const renameItem = (id: string, t: string) => onChange?.(items.map((m) => (m.id === id ? { ...m, title: t } : m)))

  if (!editable && !items.length) return null

  return (
    <div className="stack">
      {videos.map((m) => (
        <div key={m.id} className="media-item">
          <MediaView item={m} />
          <div className="row gap-sm media-caption">
            <Film size={14} className="muted" />
            {editable ? (
              <CommitInput className="input-plain grow" value={m.title} onCommit={(t) => renameItem(m.id, t)} />
            ) : (
              <span className="grow small">{m.title}</span>
            )}
            {editable && (
              <button className="icon-btn danger" onClick={() => remove(m.id)} aria-label="Remover">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
      {links.map((m) => (
        <div key={m.id} className="row gap-sm">
          <div className="grow">
            <MediaView item={m} />
          </div>
          {editable && (
            <button className="icon-btn danger" onClick={() => remove(m.id)} aria-label="Remover">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}

      {editable && (
        <div className="media-add">
          <input
            className="input"
            placeholder="Cole o link (YouTube, vídeo ou site)"
            value={url}
            inputMode="url"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addUrl()}
          />
          <input
            className="input"
            placeholder="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="row gap-sm wrap">
            <button className="btn btn-sm" onClick={addUrl} disabled={!url.trim()}>
              <Plus size={16} /> Adicionar link
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Film size={16} /> {busy ? 'Salvando…' : 'Vídeo da galeria'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) addVideoFile(f)
              }}
            />
          </div>
          <div className="muted small">Links do YouTube tocam aqui mesmo. Outros links abrem no navegador.</div>
        </div>
      )}
    </div>
  )
}
