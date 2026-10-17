import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Database, Download, FileSpreadsheet, Share2, Timer, Upload } from 'lucide-react'
import { db } from '../db'
import { exportBackup, importBackup } from '../lib/backup'
import { projectsCSV, sessionsCSV, setsCSV } from '../lib/csv'
import { saveTimerSettings, useTimerSettings } from '../lib/settings'
import { CommitInput, Field, PageHeader } from '../components/ui'
import { downloadBlob, formatBytes, formatDuration, parseDuration, shareFile, todayISO } from '../lib/utils'

export default function Settings() {
  const timer = useTimerSettings()
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<{ usage?: number; quota?: number }>({})
  const [busy, setBusy] = useState('')
  const [csvProject, setCsvProject] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const projects = useLiveQuery(() => db.projects.orderBy('createdAt').reverse().toArray(), [])
  const counts = useLiveQuery(async () => ({
    projects: await db.projects.count(),
    sessions: await db.sessions.count(),
    sets: await db.sets.count(),
    photos: await db.photos.count(),
  }), [])

  const refreshStorage = async () => {
    setPersisted((await navigator.storage?.persisted?.()) ?? null)
    setUsage((await navigator.storage?.estimate?.()) ?? {})
  }
  useEffect(() => {
    refreshStorage()
  }, [counts])

  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.()
    await refreshStorage()
    alert(ok ? 'Armazenamento persistente ativado.' : 'O navegador não concedeu agora. Instale o app na tela inicial e tente novamente.')
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      alert('Erro: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy('')
    }
  }

  const suffix = () => {
    const p = projects?.find((x) => x.id === csvProject)
    return (p ? '-' + p.name.replace(/[^\w-]+/g, '_') : '') + '-' + todayISO()
  }

  const doImport = (f: File) =>
    run('import', async () => {
      if (!confirm('Importar este backup vai SUBSTITUIR todos os dados atuais do app. Continuar?')) return
      await importBackup(f)
      alert('Backup restaurado com sucesso!')
    })

  return (
    <div className="page">
      <PageHeader title="Ajustes" />

      <div className="section-label">
        <Timer size={14} /> Timer de descanso
      </div>
      <div className="card stack">
        <label className="switch-row">
          <span>Som ao terminar</span>
          <input type="checkbox" checked={timer.sound} onChange={(e) => saveTimerSettings({ sound: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>Vibrar ao terminar</span>
          <input type="checkbox" checked={timer.vibrate} onChange={(e) => saveTimerSettings({ vibrate: e.target.checked })} />
        </label>
        <Field label="Descanso padrão" hint="Usado quando a série/exercício não tem descanso definido. Ex.: 90 ou 1:30">
          <CommitInput
            className="input"
            inputMode="numeric"
            value={formatDuration(timer.defaultRest)}
            onCommit={(v) => saveTimerSettings({ defaultRest: parseDuration(v) ?? 90 })}
          />
        </Field>
      </div>

      <div className="section-label">
        <FileSpreadsheet size={14} /> Relatórios CSV
      </div>
      <div className="card stack">
        <select className="input" value={csvProject} onChange={(e) => setCsvProject(e.target.value)}>
          <option value="">Todos os projetos</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {[
          { key: 'sets', label: 'Séries (detalhado)', fn: () => setsCSV(csvProject || undefined), name: 'series' },
          { key: 'sessions', label: 'Treinos (resumo)', fn: () => sessionsCSV(csvProject || undefined), name: 'treinos' },
          { key: 'projects', label: 'Projetos', fn: () => projectsCSV(), name: 'projetos' },
        ].map((r) => (
          <div key={r.key} className="row gap-sm">
            <span className="grow">{r.label}</span>
            <button
              className="icon-btn"
              aria-label="Compartilhar"
              disabled={!!busy}
              onClick={() => run(r.key, async () => void (await shareFile(await r.fn(), `brodemy-${r.name}${suffix()}.csv`)))}
            >
              <Share2 size={18} />
            </button>
            <button
              className="btn btn-sm"
              disabled={!!busy}
              onClick={() => run(r.key, async () => downloadBlob(await r.fn(), `brodemy-${r.name}${suffix()}.csv`))}
            >
              <Download size={16} /> Baixar
            </button>
          </div>
        ))}
        <div className="muted small">Separador ";" — abre direto no Excel ou Google Planilhas.</div>
      </div>

      <div className="section-label">
        <Database size={14} /> Banco de dados
      </div>
      <div className="card stack">
        <div className="small">
          Seus dados ficam salvos no <b>banco de dados embutido do app</b> (IndexedDB), direto no celular, e funcionam
          sem internet.
        </div>
        {counts && (
          <div className="small muted">
            {counts.projects} projetos · {counts.sessions} treinos · {counts.sets} séries · {counts.photos} fotos
            {usage.usage != null && ` · ${formatBytes(usage.usage)} usados`}
          </div>
        )}
        <div className="row gap-sm">
          <span className="grow small">
            Armazenamento persistente:{' '}
            <b className={persisted ? 'up' : 'down'}>{persisted == null ? '—' : persisted ? 'ativo' : 'não ativo'}</b>
          </span>
          {!persisted && (
            <button className="btn btn-sm btn-ghost" onClick={requestPersist}>
              Ativar
            </button>
          )}
        </div>
        <div className="muted small">
          Com o armazenamento persistente o Android não apaga os dados para liberar espaço. Desinstalar o app ou limpar
          os dados do site no Chrome apaga tudo, então guarde uma cópia de segurança de tempos em tempos.
        </div>
        <button
          className="btn"
          disabled={!!busy}
          onClick={() =>
            run('backup', async () => void (await shareFile(await exportBackup(), `brodemy-backup-${todayISO()}.json`)))
          }
        >
          <Download size={18} /> {busy === 'backup' ? 'Gerando…' : 'Exportar cópia de segurança'}
        </button>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => importRef.current?.click()}>
          <Upload size={18} /> {busy === 'import' ? 'Restaurando…' : 'Restaurar cópia de segurança'}
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) doImport(f)
          }}
        />
      </div>

      <div className="section-label">Sobre</div>
      <div className="card small stack-sm">
        <div>
          <b>Brodemy</b> v1.0 · Academia, Street e Calistenia
        </div>
        <div className="muted">
          Para instalar: abra no Chrome do Android → menu ⋮ → <b>Instalar app</b> (ou “Adicionar à tela inicial”).
        </div>
      </div>
    </div>
  )
}
