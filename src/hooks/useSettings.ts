import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import type { UserSettings } from '@/types/db'
import { browserTimeZone, isValidTimeZone } from '@/lib/time'
import { DEFAULT_SRS } from '@/lib/srs'
import { invalidateTables } from './data'

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'light',
  sound: true,
  voiceURI: null,
  speechRate: 1,
  autoRead: false,
  dailyGoalMinutes: 180,
  weeklyGoalMinutes: 1200,
  timezone: browserTimeZone(),
  hourFormat: '24h',
  pomodoro: { focus: 25, shortBreak: 5, longBreak: 15, rounds: 4 },
  autoReviews: true,
  reviewIntervals: [1, 7, 30],
  srs: DEFAULT_SRS,
}

export function mergeSettings(raw: Partial<UserSettings> | undefined): UserSettings {
  const s = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  s.pomodoro = { ...DEFAULT_SETTINGS.pomodoro, ...(raw?.pomodoro ?? {}) }
  s.srs = { ...DEFAULT_SRS, ...(raw?.srs ?? {}) }
  if (!isValidTimeZone(s.timezone)) s.timezone = DEFAULT_SETTINGS.timezone
  return s
}

export function useProfile() {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', ['profiles'], 'profile', backend.kind],
    queryFn: () => backend.getProfile(),
    staleTime: 5 * 60_000,
  })
}

export function useSettings() {
  const { data } = useProfile()
  return useMemo(() => mergeSettings(data?.settings), [data])
}

export function useUpdateSettings() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings> & { display_name?: string }) => {
      const current = await backend.getProfile()
      const { display_name, ...rest } = patch
      return backend.updateProfile({
        ...(display_name !== undefined ? { display_name } : {}),
        settings: { ...current.settings, ...rest },
      })
    },
    onSettled: () => invalidateTables(qc, ['profiles']),
  })
}

/** Aplica o tema ao <html>; cache por dispositivo evita "piscar" ao carregar. */
export function useApplyTheme(theme: UserSettings['theme'] | null) {
  useEffect(() => {
    if (!theme) return // perfil ainda carregando: mantém o tema aplicado pelo index.html
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media?.matches)
      document.documentElement.classList.toggle('dark', Boolean(dark))
    }
    apply()
    try {
      localStorage.setItem('evl:theme', JSON.stringify(theme))
    } catch {
      /* armazenamento indisponível: sem problema */
    }
    if (theme !== 'system' || !media) return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
