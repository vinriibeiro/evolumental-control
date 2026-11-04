import { describe, expect, it } from 'vitest'
import { CHALLENGES } from './catalog'
import { checkGit, gitContext, gitSolution } from './gitPractice'

const challenges = CHALLENGES.filter(({ track }) => track === 'git')
const exercise = (id: string) => challenges.find((challenge) => challenge.id === `git-${id}`)!

describe('roteiros do simulador de Git', () => {
  it('tem os vinte cenários do catálogo', () => {
    expect(challenges).toHaveLength(20)
  })

  it.each(challenges)('aceita a solução do catálogo em $id', (challenge) => {
    const result = checkGit(challenge, gitSolution(challenge))
    expect(result.passed, JSON.stringify(result.cases)).toBe(true)
    expect(result.cases.every(({ passed, feedback }) => passed && Boolean(feedback))).toBe(true)
  })

  it('aceita outro texto, aliases de diff e o caminho equivalente de um arquivo', () => {
    const result = checkGit(exercise('basic-2'), [
      "printf '%s\\n' 'Uma ideia minha' >> ./notas.txt",
      'git diff -- ./notas.txt',
      'git add -- ./notas.txt',
      'git diff -- notas.txt',
      'git diff --cached -- notas.txt',
    ].join('\n'))
    expect(result.passed).toBe(true)
  })

  it('aceita conteúdo e mensagem livres e explica a necessidade de preparar antes de commitar', () => {
    const challenge = exercise('basic-3')
    const writes = ['echo Meu resumo > resumo.txt', "echo 'Uma tarefa pendente' > rascunho.txt"]
    const commit = 'git commit --message="Meu resumo de hoje"'
    expect(checkGit(challenge, [...writes, 'git add resumo.txt', commit, 'git status -s'].join('\n')).passed).toBe(true)
    const early = checkGit(challenge, [...writes, commit, 'git add resumo.txt', 'git status -s'].join('\n'))
    expect(early.passed).toBe(false)
    expect(early.cases.at(-1)?.feedback).toContain('Prepare resumo.txt com git add antes')
  })

  it('preserva a frase e a mensagem quando o enunciado as fixa', () => {
    const idea = exercise('first_steps-4')
    expect(checkGit(idea, 'echo Minha primeira ideia > ideias.txt\ngit status -s').passed).toBe(true)
    expect(checkGit(idea, 'echo Uma frase diferente > ideias.txt\ngit status -s').passed).toBe(false)
    const firstCommit = exercise('first_steps-5')
    expect(checkGit(firstCommit, gitSolution(firstCommit).replace('Registra aprendizado', 'Outra mensagem')).passed).toBe(false)
  })

  it('mantém a ordem exata da resolução e o padrão de exclusão literal', () => {
    const conflict = exercise('intermediate-1')
    const script = gitSolution(conflict)
    expect(checkGit(conflict, script.replace("printf 'Estudar Python\\nEstudar SQL\\n'", "printf '%s\\n' 'Estudar Python' 'Estudar SQL'")).passed).toBe(true)
    expect(checkGit(conflict, script.replace('Estudar Python\\nEstudar SQL', 'Estudar SQL\\nEstudar Python')).passed).toBe(false)
    const ignore = exercise('intermediate-5')
    expect(checkGit(ignore, gitSolution(ignore).replace("printf '*.log\\n'", "echo '*.log'")).passed).toBe(true)
    expect(checkGit(ignore, gitSolution(ignore).replace("printf '*.log\\n'", 'echo *.log')).passed).toBe(false)
  })

  it('mostra o nome escolhido no stash e aceita editar a versão inteira de notas.txt', () => {
    const result = checkGit(exercise('intermediate-2'), [
      'echo Uma edição diferente > notas.txt',
      'git stash push --message="Amanhã continuo"',
      'git status -s',
      'git stash list',
      'git stash apply',
      'git diff',
    ].join('\n'))
    expect(result.passed).toBe(true)
    expect(result.cases[3].feedback).toBe('stash@{0}: Amanhã continuo')
  })

  it('aceita configuração local implícita ao escrever e rejeita escopo global com explicação', () => {
    const challenge = exercise('first_steps-3')
    const script = [
      'git config user.name "Aluno de Treino"',
      'git config --local user.email aluno@example.invalid',
      'git config --get --local user.name',
      'git config --local user.email',
    ].join('\n')
    expect(checkGit(challenge, script).passed).toBe(true)
    const global = checkGit(challenge, script.replace('git config user.name', 'git config --global user.name'))
    expect(global.passed).toBe(false)
    expect(global.cases[0].feedback).toContain('configuração local')
  })

  it('mostra o hash no reflog e exige que a recuperação aponte para ele', () => {
    const challenge = exercise('advanced-4')
    const reading = checkGit(challenge, 'git reflog show')
    const first = reading.cases[0]
    expect(first.passed).toBe(true)
    expect(first.feedback).toContain('Descoberta em detached HEAD')
    const hash = first.feedback.split(' ')[0]
    expect(gitContext(challenge)).not.toContain(hash)
    const script = gitSolution(challenge).replace('git reflog --oneline', 'git reflog show')
    expect(checkGit(challenge, script).passed).toBe(true)
    const wrong = checkGit(challenge, script.replace(hash, 'HEAD'))
    expect(wrong.passed).toBe(false)
    expect(wrong.cases.at(-1)?.feedback).toContain('hash da descoberta')
  })

  it('reconhece opções equivalentes sem confundir argumento citado e sintaxe', () => {
    expect(checkGit(exercise('first_steps-1'), 'git version\ngit status -h').passed).toBe(true)
    expect(checkGit(exercise('first_steps-2'), 'git init --initial-branch=main\ngit status').passed).toBe(true)
    expect(checkGit(exercise('basic-1'), 'git log --oneline --max-count=2\ngit show --name-only HEAD').passed).toBe(true)
    expect(checkGit(exercise('basic-1'), 'git log "-n 2" --oneline\ngit show --stat HEAD').passed).toBe(false)
  })

  it.each([
    'echo Uma ideia ">>" notas.txt',
    'echo Uma ideia 2>>notas.txt',
    'echo "$(git status)" >> notas.txt',
    'echo Uma ideia >> notas.txt && git status',
    'echo "    " >> notas.txt',
    'echo Uma ideia > notas.txt',
    'echo Uma ideia >> outro.txt',
  ])('rejeita edição incompatível com a etapa %s', (write) => {
    const challenge = exercise('basic-2')
    expect(checkGit(challenge, gitSolution(challenge).replace(/^.+/m, write)).passed).toBe(false)
  })
})
