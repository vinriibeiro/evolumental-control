import type { Challenge } from './catalog'

export interface PracticeCase {
  label: string
  passed: boolean
  feedback: string
}

export interface PracticeResult {
  passed: boolean
  summary: string
  cases: PracticeCase[]
  output?: string
}

const recoveryHash = 'c0ffee2'

// Cada cenário tem um repositório inicial fixo. Os efeitos são resultados
// didáticos do simulador e nunca são enviados a um terminal do sistema.
const scenarios: Record<string, { start: string; effects: string[] }> = {
  'git-first_steps-1': { start: 'Terminal em uma pasta vazia.', effects: ['git version 2.44.0 (treino)', 'Uso: git status [opções] [--] [caminhos]'] },
  'git-first_steps-2': { start: 'Pasta vazia, sem repositório.', effects: ['Repositório inicializado. HEAD → main.', 'Branch main · nenhum commit · diretório de trabalho limpo.'] },
  'git-first_steps-3': { start: 'Repositório local inicializado, sem identidade configurada.', effects: ['Nome gravado em .git/config.', 'E-mail gravado em .git/config.', 'Aluno de Treino', 'aluno@example.invalid'] },
  'git-first_steps-4': { start: 'main contém um commit que rastreia notas.txt.', effects: ['ideias.txt foi criado fora da área de preparação.', '?? ideias.txt'] },
  'git-first_steps-5': { start: 'main rastreia notas.txt. aprendizado.txt ainda não existe.', effects: ['aprendizado.txt foi criado.', 'Área de preparação: aprendizado.txt.', 'Novo commit contém aprendizado.txt.', 'e5f0001 Registra aprendizado'] },
  'git-basic-1': { start: 'main tem dois commits. O mais recente ampliou notas.txt.', effects: ['a100002 Amplia notas\na100001 Cria notas de treino', 'O último commit alterou notas.txt.'] },
  'git-basic-2': { start: 'notas.txt está rastreado e sem alterações.', effects: ['Nova linha no diretório de trabalho.', 'diff: uma linha adicionada a notas.txt.', 'Alteração de notas.txt preparada.', 'diff vazio: trabalho e área de preparação são iguais.', 'diff --staged: uma linha preparada em notas.txt.'] },
  'git-basic-3': { start: 'main rastreia notas.txt. O índice está limpo.', effects: ['resumo.txt criado.', 'rascunho.txt criado.', 'Somente resumo.txt foi preparado.', 'Commit criado com resumo.txt.', '?? rascunho.txt'] },
  'git-basic-4': { start: 'Você está em main, com notas.txt rastreado.', effects: ['Branch estudo/python criada e selecionada.', 'notas.txt alterado em estudo/python.', 'notas.txt preparado.', 'Novo commit em estudo/python. main aponta para o commit anterior.', '* estudo/python\n  main'] },
  'git-basic-5': { start: 'Você está em melhoria, um commit à frente de main.', effects: ['Branch atual: main.', 'Fast-forward: main avançou para o commit de melhoria.', '* a500002 (HEAD → main, melhoria) Melhora notas\n* a500001 Cria notas de treino'] },
  'git-intermediate-1': { start: 'main e alternativa editaram a mesma linha de notas.txt.', effects: ['CONFLICT (content): notas.txt. O merge aguarda resolução.', 'notas.txt contém Estudar Python e Estudar SQL, nessa ordem.', 'A resolução foi preparada.', 'Commit de merge criado com dois pais.', 'Branch main · nenhum merge em andamento.'] },
  'git-intermediate-2': { start: 'main rastreia notas.txt e está limpo.', effects: ['notas.txt tem uma edição não preparada.', 'Edição armazenada no stash nomeado. Diretório de trabalho limpo.', 'Status curto vazio.', 'O stash nomeado aparece na lista.', 'Edição reaplicada. O stash continua disponível.', 'diff: a edição reapareceu em notas.txt.'] },
  'git-intermediate-3': { start: 'HEAD acrescentou Anotacao incorreta a notas.txt.', effects: ['Commit de reversão criado. A anotação incorreta foi retirada.', 'Histórico: reversão → alteração original → commit inicial.', 'Versao inicial'] },
  'git-intermediate-4': { start: 'main tem um commit. Nenhum remoto está configurado.', effects: ['Remoto bare criado na pasta irmã de treino.', 'origin → ../remoto-treino.git', 'main publicada no remoto local e configurada para acompanhar origin/main.', 'origin  ../remoto-treino.git (fetch/push)', '* main [origin/main] Cria notas de treino'] },
  'git-intermediate-5': { start: 'main rastreia notas.txt e não contém regras de exclusão.', effects: ['debug.log criado.', 'Regra *.log escrita em .gitignore.', 'Somente .gitignore preparado.', 'Commit contém apenas .gitignore.', '.gitignore:1:*.log\tdebug.log'] },
  'git-advanced-1': { start: 'Branch atual main. A tag guia-pronto aponta para um commit de experimento.', effects: ['Alteração guia-pronto copiada para um novo commit em main.', 'Histórico: guia copiado → commit inicial.', '  experimento\n* main', 'guia.txt está presente na branch main.'] },
  'git-advanced-2': { start: 'recurso-local e main avançaram a partir de uma base comum. Você está em recurso-local.', effects: ['Commit privado reaplicado sobre main.', 'Histórico: recurso reaplicado → avanço de main → base comum.', 'base.txt contém a evolução de main.', 'recurso.txt mantém a mudança privada.'] },
  'git-advanced-3': { start: 'HEAD falha. A tag inicio-saudavel marca um commit em que estado.txt contém ok.', effects: ['Intervalo inicial: inicio-saudavel (bom) até HEAD (ruim).', 'O teste simulado identificou o primeiro commit ruim: Introduz regressao.', 'Investigação encerrada. Você voltou para a branch inicial.'] },
  'git-advanced-4': { start: 'HEAD voltou para main. O commit da descoberta está no reflog.', effects: [`${recoveryHash} HEAD@{1}: commit: Descoberta em detached HEAD`, 'recuperada aponta para o commit da descoberta. main mantém sua referência.', 'O conteúdo de descoberta.txt está acessível pela branch recuperada.', 'Histórico de ambas as branches conferido.'] },
  'git-advanced-5': { start: 'Existe uma área de trabalho em main. notas.txt está rastreado.', effects: ['Segunda área criada em revisar-notas.', 'notas.txt foi editado na segunda área.', 'Alteração preparada no índice de revisar-notas.', 'Commit de revisão criado em revisar-notas.', 'Duas áreas: pasta inicial [main] e treino-worktree-notas [revisar-notas].', 'main'] },
}

export function gitContext(challenge: Challenge) {
  return scenarios[challenge.id]?.start ?? ''
}

export function gitSolution(challenge: Challenge) {
  return challenge.solution.replace('HASH_ENCONTRADO', recoveryHash)
}

interface Command {
  words: string[]
  redirect?: { operator: '>' | '>>'; path: string }
}

function commandLines(source: string): Command[] {
  const commands: Command[] = []
  for (const line of source.split(/\r?\n/)) {
    const words: string[] = []
    const paths: string[] = []
    let operator: '>' | '>>' | undefined
    let word = ''
    let quote = ''
    let started = false
    const finish = () => {
      if (started) (operator ? paths : words).push(word)
      word = ''
      started = false
    }
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const next = line[i + 1]
      if (char === '\\' && (quote === '' || (quote === '"' && next && '\\"$`'.includes(next)))) {
        if (next === undefined) throw new Error('Complete o caractere escapado ou use aspas para escrever a barra.')
        word += next
        started = true
        i++
        continue
      }
      if (quote) {
        if (char === quote) quote = ''
        else if (quote === '"' && (char === '$' || char === '`')) throw new Error('Use aspas simples para incluir texto literal. O treino não aceita expansão ou substituição de comandos.')
        else word += char
      } else if (char === '#' && !started) break
      else if (char === '"' || char === "'") {
        quote = char
        started = true
      } else if (/\s/.test(char)) finish()
      else if (char === '>') {
        if (started && /^\d+$/.test(word) && /\d/.test(line[i - 1] ?? '')) throw new Error('Use > ou >> diretamente, sem número de descritor.')
        finish()
        if (operator) throw new Error('Use um único redirecionamento por linha.')
        operator = next === '>' ? '>>' : '>'
        if (operator === '>>') i++
      } else {
        if ('|&;<()'.includes(char)) throw new Error('Digite um comando por linha. O treino aceita apenas redirecionamento com > ou >>.')
        if ('*?[$`'.includes(char)) throw new Error('Coloque caracteres especiais entre aspas simples para que sejam tratados como texto literal.')
        word += char
        started = true
      }
    }
    if (quote) throw new Error(`Feche as aspas neste comando: ${line.trim()}`)
    finish()
    if (operator && (paths.length !== 1 || !paths[0] || !words.length)) throw new Error('Informe um único arquivo depois de > ou >>.')
    if (words.length) commands.push({ words, redirect: operator ? { operator, path: paths[0] } : undefined })
  }
  return commands
}

const equal = (a: string[], b: string[]) => a.length === b.length && a.every((part, index) => part === b[index])
const localPath = (path: string) => path.replace(/^\.\//, '')

function printedText([name, ...args]: string[]): string | null {
  if (name === 'echo') {
    if (!args.length || /^-[neE]+$/.test(args[0])) return null
    return `${args.join(' ')}\n`
  }
  if (name !== 'printf') return null
  const explicitFormat = args[0] === '--'
  const [format, ...values] = explicitFormat ? args.slice(1) : args
  if (format === undefined || (!explicitFormat && format.startsWith('-') && format.length > 1)) return null
  const pieces = format.match(/%[%s]|\\[nrt\\]|[^%\\]+/g) ?? []
  if (pieces.join('') !== format) return null
  const slots = pieces.filter((piece) => piece === '%s').length
  if (!slots && values.length) return null
  const escapes = new Map([['\\n', '\n'], ['\\r', '\r'], ['\\t', '\t'], ['\\\\', '\\'], ['%%', '%']])
  let value = 0
  let output = ''
  do {
    for (const piece of pieces) output += piece === '%s' ? (values[value++] ?? '') : (escapes.get(piece) ?? piece)
  } while (value < values.length)
  return output
}

const exactWriteScenarios = new Set(['git-first_steps-4', 'git-first_steps-5', 'git-intermediate-1'])
const withoutFinalNewline = (text: string) => text.replace(/\r?\n$/, '')

function matchesWrite(actual: Command, expected: Command, id: string) {
  const target = expected.redirect
  if (!actual.redirect || !target || localPath(actual.redirect.path) !== localPath(target.path)) return false
  const replaceAllowed = id === 'git-intermediate-2' || id === 'git-advanced-5'
  if (actual.redirect.operator !== target.operator && !replaceAllowed) return false
  const text = printedText(actual.words)
  if (!text?.trim()) return false
  const content = withoutFinalNewline(text)
  if (target.path === '.gitignore' || exactWriteScenarios.has(id)) {
    return content === withoutFinalNewline(printedText(expected.words) ?? '')
  }
  if (id === 'git-basic-2' && /[\r\n]/.test(content)) return false
  if (replaceAllowed && actual.redirect.operator === '>' && content === 'Versao inicial') return false
  return true
}

function normalizeMessage(args: string[]): string[] {
  if (args.length === 2 && args[0] === '--message') return ['-m', args[1]]
  if (args.length === 1 && args[0].startsWith('--message=')) return ['-m', args[0].slice('--message='.length)]
  if (args.length === 1 && /^-m.+/.test(args[0])) return ['-m', args[0].slice(2)]
  return args
}

function logOptions(args: string[]): string[] {
  const options: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-n' || arg === '--max-count') {
      const count = args[++i]
      if (!/^[1-3]$/.test(count ?? '')) return args
      options.push(`-${count}`)
      continue
    }
    const count = /^(?:-n|--max-count=)([1-3])$/.exec(arg)?.[1]
    if (count) options.push(`-${count}`)
    else if (/^-[1-3]$/.test(arg) || ['--all', '--graph', '--oneline'].includes(arg)) options.push(arg)
    else return args
  }
  return options.sort()
}

function normalized(command: string[]): string[] {
  const parts = [...command]
  if (parts[0] === 'cat' && parts.length === 3 && parts[1] === '--') return ['cat', localPath(parts[2])]
  if (parts[0] === 'cat' && parts.length === 2) return ['cat', localPath(parts[1])]
  if (parts[0] !== 'git') return parts
  if (parts[1] === '-C' && parts.length >= 4) return ['git', '-C', localPath(parts[2]), ...normalized(['git', ...parts.slice(3)]).slice(1)]
  const args = parts.slice(2)
  if (parts[1] === 'version' && !args.length) return ['git', '--version']
  if (parts[1] === 'checkout' && parts[2] === '-b') return ['git', 'switch', '-c', ...parts.slice(3)]
  if (parts[1] === 'checkout' && parts.length === 3 && parts[2] === 'main') return ['git', 'switch', 'main']
  if (parts[1] === 'switch') return parts.flatMap((word) => word === '--create' ? ['-c'] : word.startsWith('--create=') ? ['-c', word.slice('--create='.length)] : [word])
  if (parts[1] === 'status') return parts.map((word) => word === '-s' ? '--short' : word)
  if (parts[1] === 'diff') {
    const options = args.at(-2) === '--' && localPath(args.at(-1) ?? '') === 'notas.txt' ? args.slice(0, -2) : args
    return ['git', 'diff', ...options.map((word) => word === '--cached' ? '--staged' : word)]
  }
  if (parts[1] === 'init') return parts.flatMap((word) => word === '--initial-branch' ? ['-b'] : word.startsWith('--initial-branch=') ? ['-b', word.slice('--initial-branch='.length)] : [word])
  if (parts[1] === 'config') {
    if (args.length === 2 && /^user\.(name|email)$/.test(args[0])) return ['git', 'config', '--local', ...args]
    if (args.length === 2 && args[0] === '--local') return ['git', 'config', '--local', '--get', args[1]]
    if (args.length === 3 && args[0] === '--get' && args[1] === '--local') return ['git', 'config', '--local', '--get', args[2]]
  }
  if (parts[1] === 'show' && [['--stat'], ['--name-only'], ['--name-only', 'HEAD'], ['HEAD', '--stat'], ['HEAD', '--name-only']].some((variant) => equal(args, variant))) return ['git', 'show', '--stat', 'HEAD']
  if (parts[1] === 'commit') return ['git', 'commit', ...normalizeMessage(args)]
  if (parts[1] === 'stash') {
    if (equal(args, ['apply']) || equal(args, ['apply', '0'])) return ['git', 'stash', 'apply', 'stash@{0}']
    if (args[0] === 'push') return ['git', 'stash', 'push', ...normalizeMessage(args.slice(1))]
    if (args[0] === 'save' && args.length === 2 && !args[1].startsWith('-')) return ['git', 'stash', 'push', '-m', args[1]]
  }
  if (parts[1] === 'push') return parts.map((word) => word === '--set-upstream' ? '-u' : word)
  if (parts[1] === 'log') return ['git', 'log', ...logOptions(args)]
  if (parts[1] === 'add') {
    const files = args[0] === '--' ? args.slice(1) : args
    if (files.length === 1) return ['git', 'add', localPath(files[0])]
  }
  if (parts[1] === 'branch' && equal(args, ['--list'])) return ['git', 'branch']
  if (parts[1] === 'merge' && equal(args, ['melhoria', '--ff-only'])) return ['git', 'merge', '--ff-only', 'melhoria']
  if (parts[1] === 'revert' && equal(args, ['HEAD', '--no-edit'])) return ['git', 'revert', '--no-edit', 'HEAD']
  if (parts[1] === 'remote' && equal(args, ['--verbose'])) return ['git', 'remote', '-v']
  if (parts[1] === 'check-ignore' && equal(args, ['--verbose', 'debug.log'])) return ['git', 'check-ignore', '-v', 'debug.log']
  if (parts[1] === 'reflog' && [[], ['show'], ['show', 'HEAD'], ['show', '--oneline'], ['--oneline', 'HEAD']].some((variant) => equal(args, variant))) return ['git', 'reflog', '--oneline']
  if (parts[1] === 'bisect' && [['run', 'grep', '-qx', 'ok', 'estado.txt'], ['run', 'grep', '-xq', 'ok', 'estado.txt']].some((variant) => equal(args, variant))) return ['git', 'bisect', 'run', 'sh', '-c', 'grep -qx "ok" estado.txt']
  return parts
}

function matches(actual: Command, expected: Command, id: string) {
  if (expected.redirect) return matchesWrite(actual, expected, id)
  if (actual.redirect) return false
  const a = normalized(actual.words)
  const b = normalized(expected.words)
  if (equal(a, b)) return true
  const messageFlag = b.indexOf('-m')
  if (messageFlag >= 0 && id !== 'git-first_steps-5' && equal(a.slice(0, messageFlag + 1), b.slice(0, messageFlag + 1))) {
    return a.length === b.length && Boolean(a[messageFlag + 1]?.trim()) && equal(a.slice(messageFlag + 2), b.slice(messageFlag + 2))
  }
  return false
}

const gitSubcommand = (words: string[]) => words[0] === 'git' ? (words[1] === '-C' ? words[3] : words[1]) : undefined

function action(command: Command) {
  if (command.redirect) return `Editar ${command.redirect.path}`
  if (command.words[0] === 'cat') return `Conferir ${command.words[1]}`
  const name = gitSubcommand(command.words)
  const labels: Record<string, string> = {
    '--version': 'Conferir a versão', status: 'Consultar o estado', init: 'Inicializar o repositório',
    config: 'Conferir a configuração local', add: 'Preparar o arquivo', commit: 'Registrar o commit',
    log: 'Conferir o histórico', show: 'Inspecionar o conteúdo', diff: 'Comparar as alterações',
    switch: 'Trocar de branch', branch: 'Trabalhar com a referência da branch', merge: 'Integrar a branch',
    stash: 'Operar sobre o stash', revert: 'Reverter o commit', remote: 'Conferir o remoto de treino',
    push: 'Enviar ao remoto de treino', 'check-ignore': 'Conferir o padrão de exclusão',
    'cherry-pick': 'Aplicar o commit escolhido', rebase: 'Reaplicar a branch privada', bisect: 'Investigar o histórico',
    reflog: 'Inspecionar o reflog', worktree: 'Gerenciar a área de trabalho',
  }
  return (name ? labels[name] : undefined) ?? 'Executar a etapa'
}

function stepFeedback(expected: Command, actual: Command | undefined, id: string, step: number): string {
  if (!actual) return `Falta a etapa ${step}. Consulte a tarefa e as dicas.`
  const actualName = gitSubcommand(actual.words)
  const expectedName = gitSubcommand(expected.words)
  if (expectedName === 'add' && actualName === 'commit') {
    return `Prepare ${expected.words.at(-1)} com git add antes de criar o commit.`
  }
  if (expectedName === 'config' && actualName === 'config' && actual.words.some((word) => ['--global', '--system', '--worktree', '--file', '-f'].includes(word))) {
    return 'Use a configuração local deste repositório. Use --local para limitar o comando.'
  }
  if (id === 'git-advanced-4' && expectedName === 'branch') {
    return 'Crie recuperada apontando para o hash da descoberta exibido na etapa de reflog.'
  }
  if (expected.redirect) {
    const { path, operator } = expected.redirect
    const content = path === '.gitignore' || exactWriteScenarios.has(id) ? 'Use o conteúdo especificado no enunciado.' : 'Use um texto não vazio.'
    const redirect = id === 'git-intermediate-2' || id === 'git-advanced-5' ? '> ou >>' : operator
    return `Escreva em ${path} com printf ou echo e use ${redirect}. ${content}`
  }
  return `Revise a etapa ${step}. “${actual.words.join(' ')}” não corresponde à operação pedida neste cenário.`
}

export function checkGit(challenge: Challenge, source: string): PracticeResult {
  const scenario = scenarios[challenge.id]
  if (!scenario) throw new Error('Cenário de treino indisponível.')
  let submitted: Command[]
  try { submitted = commandLines(source) }
  catch (error) {
    return { passed: false, summary: 'Revise a sintaxe do comando.', cases: [{ label: 'Sintaxe', passed: false, feedback: error instanceof Error ? error.message : 'Comando inválido.' }] }
  }
  const expected = commandLines(gitSolution(challenge))
  const cases: PracticeCase[] = []
  for (let i = 0; i < expected.length; i++) {
    const label = action(expected[i])
    if (!submitted[i] || !matches(submitted[i], expected[i], challenge.id)) {
      cases.push({ label, passed: false, feedback: stepFeedback(expected[i], submitted[i], challenge.id, i + 1) })
      return { passed: false, summary: `O simulador parou na etapa ${i + 1} de ${expected.length}.`, cases }
    }
    const feedback = challenge.id === 'git-intermediate-2' && i === 3
      ? `stash@{0}: ${normalized(submitted[1].words).at(-1)}`
      : scenario.effects[i]
    cases.push({ label, passed: true, feedback })
  }
  if (submitted.length > expected.length) {
    cases.push({ label: 'Finalizar o cenário', passed: false, feedback: 'As etapas pedidas passaram. Retire os comandos extras para confirmar apenas o fluxo de treino.' })
    return { passed: false, summary: 'O roteiro contém comandos além do cenário.', cases }
  }
  return { passed: true, summary: 'Os comandos atingiram o objetivo do cenário.', cases }
}
