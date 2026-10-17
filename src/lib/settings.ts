import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export interface TimerSettings {
  sound: boolean
  vibrate: boolean
  defaultRest: number
}

export const DEFAULT_TIMER: TimerSettings = { sound: true, vibrate: true, defaultRest: 90 }

export function useTimerSettings(): TimerSettings {
  const s = useLiveQuery(() => db.settings.get('timer'), [])
  return { ...DEFAULT_TIMER, ...((s?.value as Partial<TimerSettings>) ?? {}) }
}

export async function saveTimerSettings(patch: Partial<TimerSettings>) {
  const cur = (await db.settings.get('timer'))?.value as Partial<TimerSettings> | undefined
  await db.settings.put({ key: 'timer', value: { ...DEFAULT_TIMER, ...cur, ...patch } })
}
