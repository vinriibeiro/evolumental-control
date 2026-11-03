import { useEffect, useRef, useState } from 'react'
import { applyChallengePatch, challengeStorageKey, challengeStoragePrefix, initialChallengeState, mergeChallengePatches, persistChallengePatch, readChallengeState, type ChallengePatch } from './progress'

/** Cada aba conserva sua navegação; rascunhos e conclusões acompanham as demais abas da conta. */
export function useChallengeProgress(scope: string) {
  const [initial] = useState(() => {
    try { return readChallengeState(localStorage, scope) }
    catch { return { state: initialChallengeState(), warning: 'Não foi possível recuperar seus dados locais de desafios. Exporte seu rascunho antes de sair.' } }
  })
  const [state, setState] = useState(initial.state)
  const current = useRef(state)
  const pending = useRef<ChallengePatch>({})
  const [warning, setWarning] = useState(initial.warning)
  const [saveError, setSaveError] = useState('')

  const refresh = () => {
    const loaded = readChallengeState(localStorage, scope)
    const merged = applyChallengePatch(loaded.state, pending.current)
    const next = { ...merged, track: current.current.track, level: current.current.level, selectedId: current.current.selectedId }
    current.current = next
    setState(next)
    setWarning(loaded.warning)
  }

  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== localStorage) return
      if (event.key !== null && event.key !== challengeStorageKey(scope) && !event.key.startsWith(challengeStoragePrefix(scope))) return
      try { refresh() }
      catch { setSaveError('Não foi possível atualizar os dados de outra aba. Seu rascunho continua disponível nesta tela para exportação.') }
    }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
    // O workspace é remontado quando a conta muda; refresh usa referências para o estado atual.
  }, [scope]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: ChallengePatch) => {
    const next = applyChallengePatch(current.current, patch)
    current.current = next
    setState(next)
    pending.current = mergeChallengePatches(pending.current, patch)
    try {
      persistChallengePatch(localStorage, scope, pending.current)
      pending.current = {}
      refresh()
      setSaveError('')
    } catch {
      setSaveError('Não foi possível salvar neste navegador. Mantenha esta tela aberta e use Exportar progresso e rascunhos antes de sair.')
    }
  }

  return { state, update, error: saveError || warning }
}
