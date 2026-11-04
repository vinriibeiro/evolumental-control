import { describe, expect, it } from 'vitest'
import { CHALLENGES } from './catalog'
import { checkGit, gitContext, gitSolution } from './gitPractice'
import { describeChanges, repoTimeline, timelineSteps } from './gitStates'
import { VARIATIONS } from './variations'

const gits = [...CHALLENGES.filter(({ track }) => track === 'git'), ...VARIATIONS.filter(({ track }) => track === 'git')]

describe('estados do repositório simulado', () => {
  it('cobre os vinte cenários e as variações de Git', () => {
    expect(gits).toHaveLength(23)
  })

  it.each(gits)('tem um estado para cada comando esperado em $id', (challenge) => {
    const result = checkGit(challenge, gitSolution(challenge))
    expect(result.passed, JSON.stringify(result.cases)).toBe(true)
    expect(timelineSteps(challenge.id)).toBe(result.cases.length)
    expect(repoTimeline(challenge.id)).toHaveLength(result.cases.length + 1)
    expect(gitContext(challenge)).not.toBe('')
    for (const item of result.cases) {
      expect(item.detail?.repo?.changes.length).toBeGreaterThan(0)
      expect(item.detail?.repo?.command).toBeTruthy()
    }
  })

  it('mostra onde a sequência saiu do caminho e como o repositório deveria mudar', () => {
    const challenge = CHALLENGES.find(({ id }) => id === 'git-first_steps-5')!
    const result = checkGit(challenge, [
      "printf 'Aprendi a fazer um commit\\n' > aprendizado.txt",
      'git commit -m "Registra aprendizado"',
    ].join('\n'))
    expect(result.passed).toBe(false)
    const failed = result.cases.at(-1)!
    expect(failed.passed).toBe(false)
    const repo = failed.detail?.repo
    expect(repo).toMatchObject({ step: 2, total: 4, command: 'git commit -m Registra aprendizado' })
    expect(repo?.before?.untracked).toEqual(['aprendizado.txt'])
    expect(repo?.before?.staged).toEqual([])
    expect(repo?.after?.staged).toEqual(['aprendizado.txt'])
    expect(repo?.changes).toEqual(['Deixa de ser não rastreado: aprendizado.txt.', 'Preparado para o próximo commit: aprendizado.txt.'])
  })

  it('não revela o comando correto, só a ação esperada e a mudança', () => {
    const challenge = CHALLENGES.find(({ id }) => id === 'git-basic-4')!
    const result = checkGit(challenge, 'git branch estudo/python')
    const text = JSON.stringify(result)
    expect(result.passed).toBe(false)
    expect(text).not.toContain('switch -c')
  })

  it('descreve criação de branch, commit e conflito', () => {
    const branch = repoTimeline('git-basic-4')!
    expect(describeChanges(branch[0], branch[1])).toEqual(['Branch atual: main → estudo/python.', 'Nova branch: estudo/python.', 'O histórico exibido passa a ser o de estudo/python.'])
    expect(describeChanges(branch[3], branch[4])).toEqual(expect.arrayContaining(['Novo commit: b4a0002 Planeja estudo de Python.', 'Sai da área de preparação: notas.txt.']))
    const merge = repoTimeline('git-intermediate-1')!
    expect(describeChanges(merge[0], merge[1]).join(' ')).toContain('CONFLICT')
    expect(describeChanges(merge[4], merge[5])).toEqual(['Nenhuma mudança no repositório: é um comando de consulta.'])
  })

  it('informa o comando extra depois do cenário concluído', () => {
    const challenge = CHALLENGES.find(({ id }) => id === 'git-first_steps-2')!
    const result = checkGit(challenge, [gitSolution(challenge), 'git status'].join('\n'))
    expect(result.passed).toBe(false)
    expect(result.cases.at(-1)?.detail?.repo?.command).toBe('git status')
  })
})
