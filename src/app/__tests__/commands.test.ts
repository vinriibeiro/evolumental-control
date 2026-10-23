import { describe, expect, it } from 'vitest'
import { COMMANDS, matchCommands } from '../commands'

describe('paleta de comandos', () => {
  it('sem termo: todos os comandos', () => {
    expect(matchCommands('')).toHaveLength(COMMANDS.length)
  })

  it('acha por palavras, sem acento e em qualquer ordem', () => {
    expect(matchCommands('nova tarefa').map((c) => c.id)).toEqual(['tarefa'])
    expect(matchCommands('revisar atrasados')[0].to).toBe('/revisoes')
    expect(matchCommands('mapa novo')[0].to).toBe('/mapas?novo=mapa')
    expect(matchCommands('registrar estudo').map((c) => c.id)).toContain('manual')
    expect(matchCommands('questoes')[0].id).toBe('questoes')
  })

  it('"estudar <matéria>" vira comando dinâmico só para matérias ativas', () => {
    const subjects = [
      { id: 'pt', name: 'Português', status: 'active' },
      { id: 'pa', name: 'Português jurídico', status: 'archived' },
      { id: 'es', name: 'Estatística', status: 'active' },
    ]
    const r = matchCommands('estudar portugues', subjects)
    expect(r[0]).toEqual({ id: 'estudar:pt', label: 'Estudar Português', keywords: '', to: '/cronometro?materia=pt' })
    expect(r.some((c) => c.id === 'estudar:pa')).toBe(false)
  })

  it('termo sem correspondência: nada', () => {
    expect(matchCommands('xyzzy')).toEqual([])
  })
})
