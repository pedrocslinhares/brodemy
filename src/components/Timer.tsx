import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pause, Play, X } from 'lucide-react'
import { useTimerSettings } from '../lib/settings'
import { formatDuration } from '../lib/utils'

interface TimerApi {
  start: (seconds: number, label: string) => void
  defaultRest: number
}

const Ctx = createContext<TimerApi>({ start: () => {}, defaultRest: 90 })
export const useTimer = () => useContext(Ctx)

type AudioCtor = typeof AudioContext

export function TimerProvider({ children }: { children: ReactNode }) {
  const settings = useTimerSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const [endAt, setEndAt] = useState<number | null>(null)
  const [paused, setPaused] = useState<number | null>(null) // ms restantes quando pausado
  const [total, setTotal] = useState(0)
  const [label, setLabel] = useState('')
  const [done, setDone] = useState(false)
  const [now, setNow] = useState(Date.now())
  const audio = useRef<AudioContext | null>(null)
  const doneTimer = useRef<number>()

  const running = endAt != null && paused == null

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setNow(Date.now()), 200)
    const vis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [running])

  const alarm = useCallback(() => {
    const s = settingsRef.current
    if (s.vibrate) navigator.vibrate?.([400, 150, 400, 150, 600])
    const ctx = audio.current
    if (s.sound && ctx) {
      for (let i = 0; i < 3; i++) {
        const t0 = ctx.currentTime + i * 0.35
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = i === 2 ? 1175 : 880
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + 0.3)
      }
    }
  }, [])

  useEffect(() => {
    if (running && endAt != null && now >= endAt) {
      setEndAt(null)
      setDone(true)
      alarm()
      clearTimeout(doneTimer.current)
      doneTimer.current = window.setTimeout(() => setDone(false), 6000)
    }
  }, [now, running, endAt, alarm])

  const start = useCallback((seconds: number, l: string) => {
    // o AudioContext precisa ser criado num toque do usuário
    if (!audio.current) {
      const A: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
      if (A) audio.current = new A()
    }
    audio.current?.resume()
    clearTimeout(doneTimer.current)
    const secs = Math.max(1, Math.round(seconds))
    setDone(false)
    setTotal(secs)
    setLabel(l)
    setPaused(null)
    setNow(Date.now())
    setEndAt(Date.now() + secs * 1000)
  }, [])

  const stop = () => {
    setEndAt(null)
    setPaused(null)
    setDone(false)
  }

  const toggle = () => {
    if (paused != null) {
      setNow(Date.now())
      setEndAt(Date.now() + paused)
      setPaused(null)
    } else if (endAt != null) {
      setPaused(Math.max(0, endAt - Date.now()))
    }
  }

  const add = (delta: number) => {
    if (paused != null) setPaused(Math.max(1000, paused + delta * 1000))
    else if (endAt != null) setEndAt(Math.max(Date.now() + 1000, endAt + delta * 1000))
    setTotal((t) => Math.max(1, t + delta))
  }

  const remainingMs = paused ?? (endAt != null ? Math.max(0, endAt - now) : 0)
  const visible = endAt != null || paused != null || done
  const pct = total ? Math.min(100, (remainingMs / (total * 1000)) * 100) : 0

  return (
    <Ctx.Provider value={{ start, defaultRest: settings.defaultRest }}>
      {children}
      {visible && (
        <div className={'timer-bar' + (done ? ' done' : '')} role="timer">
          <div className="timer-progress" style={{ width: `${done ? 100 : pct}%` }} />
          <div className="timer-content">
            <div className="timer-info">
              <div className="timer-time">{done ? 'Bora!' : formatDuration(Math.ceil(remainingMs / 1000))}</div>
              <div className="timer-label">{done ? 'Descanso concluído · ' + label : 'Descanso · ' + label}</div>
            </div>
            {!done && (
              <>
                <button className="timer-btn" onClick={() => add(-15)}>-15</button>
                <button className="timer-btn" onClick={toggle} aria-label={paused != null ? 'Continuar' : 'Pausar'}>
                  {paused != null ? <Play size={18} /> : <Pause size={18} />}
                </button>
                <button className="timer-btn" onClick={() => add(15)}>+15</button>
              </>
            )}
            <button className="timer-btn" onClick={stop} aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}
