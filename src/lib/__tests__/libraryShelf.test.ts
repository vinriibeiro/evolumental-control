import { describe, expect, it } from 'vitest'
import {
  filterShelf,
  findDuplicate,
  findIsbn,
  markVisited,
  matchKey,
  navigationProgress,
  normalizeIsbn,
  normalizeShelfState,
  sameSubject,
  seedVisitedPages,
  shelfSubjects,
  titleKey,
  type DedupeCandidate,
} from '../library'

const HASH_A = 'a'.repeat(32)
const HASH_B = 'b'.repeat(32)
const book = (id: string, extra: Partial<DedupeCandidate> & { title: string }) => ({ id, hash: id, ...extra })

describe('antiduplicidade da estante', () => {
  const shelf = [
    book(HASH_A, { title: 'Dom Casmurro', author: 'Machado de Assis', isbn: '9780306406157', identifier: 'urn:uuid:1111-2222-3333' }),
    book(HASH_B, { title: 'Cálculo — Volume 1', author: 'James Stewart' }),
  ]

  it('arquivo idêntico é reconhecido pelo conteúdo, mesmo com outro nome e outros metadados', () => {
    const match = findDuplicate({ hash: HASH_A, title: 'copia-renomeada (1)', author: '' }, shelf)
    expect(match).toMatchObject({ level: 'exact', reason: 'hash' })
    expect(match?.book.id).toBe(HASH_A)
  })

  it('compara o hash truncado do EPUB com o hash inteiro do PDF pelo prefixo', () => {
    expect(findDuplicate({ hash: HASH_A + 'f'.repeat(32), title: 'x' }, shelf)).toMatchObject({ level: 'exact', reason: 'hash' })
    // ids curtos (sem Web Crypto) só valem quando são exatamente iguais
    expect(findDuplicate({ hash: '1f-ab', title: 'x' }, [book('1f-abc', { title: 'y' })])).toBeNull()
  })

  it('arquivo diferente com o mesmo ISBN é só suspeito (ISBN-10, ISBN-13 e hífens equivalem)', () => {
    for (const isbn of ['0-306-40615-2', '978-0-306-40615-7', 'urn:isbn:9780306406157']) {
      expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Outro título', isbn }, shelf)).toMatchObject({ level: 'suspect', reason: 'isbn' })
    }
  })

  it('arquivo diferente com o mesmo identificador persistente é suspeito; identificador genérico não conta', () => {
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Outro', identifier: 'URN:UUID:1111-2222-3333' }, shelf)).toMatchObject({ level: 'suspect', reason: 'identifier' })
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Outro', identifier: 'unknown' }, [book(HASH_A, { title: 'Um', identifier: 'unknown' })])).toBeNull()
  })

  it('mesmo título e autor (ignorando acentos, caixa e pontuação) é suspeito, nunca igual', () => {
    const match = findDuplicate({ hash: 'c'.repeat(32), title: 'DOM CASMURRO', author: 'machado de assis' }, shelf)
    expect(match).toMatchObject({ level: 'suspect', reason: 'metadata' })
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Calculo: volume 1', author: 'James Stewart' }, shelf)).toMatchObject({ level: 'suspect', reason: 'metadata' })
  })

  it('mesmo título com autor desconhecido de um dos lados é suspeito; autores conhecidos e diferentes não', () => {
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Dom Casmurro' }, shelf)).toMatchObject({ level: 'suspect', reason: 'metadata' })
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Dom Casmurro', author: 'Autor desconhecido' }, shelf)).toMatchObject({ level: 'suspect' })
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Dom Casmurro', author: 'Outra Pessoa' }, shelf)).toBeNull()
  })

  it('marcas de cópia no nome do arquivo não escondem a semelhança', () => {
    expect(titleKey('Dom Casmurro (1)')).toBe(titleKey('Dom Casmurro'))
    expect(titleKey('Dom Casmurro - Cópia')).toBe('dom casmurro')
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Dom Casmurro (2)' }, shelf)).toMatchObject({ level: 'suspect', reason: 'metadata' })
  })

  it('livro sem nada em comum não é duplicata; estante vazia também não', () => {
    expect(findDuplicate({ hash: 'c'.repeat(32), title: 'Memórias Póstumas', author: 'Machado de Assis' }, shelf)).toBeNull()
    expect(findDuplicate({ hash: HASH_A, title: 'Dom Casmurro' }, [])).toBeNull()
    expect(findDuplicate({ title: '' }, shelf)).toBeNull()
  })

  it('o conteúdo igual vence os metadados: devolve o livro de mesmo hash, não o homônimo', () => {
    const twins = [book(HASH_B, { title: 'Dom Casmurro', author: 'Machado de Assis' }), book(HASH_A, { title: 'Arquivo sem nome' })]
    expect(findDuplicate({ hash: HASH_A, title: 'Dom Casmurro', author: 'Machado de Assis' }, twins)?.book.id).toBe(HASH_A)
  })
})

describe('ISBN', () => {
  it('normaliza para 13 dígitos e recusa dígito verificador errado', () => {
    expect(normalizeIsbn('0-306-40615-2')).toBe('9780306406157')
    expect(normalizeIsbn('ISBN 978-0-306-40615-7')).toBe('9780306406157')
    expect(normalizeIsbn('080442957X')).toBe('9780804429573')
    expect(normalizeIsbn('9780306406158')).toBeNull()
    expect(normalizeIsbn('0306406153')).toBeNull()
    expect(normalizeIsbn('urn:uuid:abc')).toBeNull()
    expect(normalizeIsbn(undefined)).toBeNull()
  })

  it('só aceita como ISBN o identificador marcado como tal ou no formato 978/979', () => {
    expect(findIsbn([{ value: 'urn:uuid:1234' }, { value: 'urn:isbn:0306406152' }])).toBe('9780306406157')
    expect(findIsbn([{ value: '0306406152', scheme: ' opf:scheme="ISBN"' }])).toBe('9780306406157')
    expect(findIsbn([{ value: '978-0-306-40615-7' }])).toBe('9780306406157')
    // dez dígitos soltos que por acaso passam no verificador não são tratados como ISBN
    expect(findIsbn([{ value: '0306406152' }])).toBeUndefined()
    expect(findIsbn([])).toBeUndefined()
  })
})

describe('progresso de navegação do PDF', () => {
  it('é a parcela das páginas já abertas, não a página atual', () => {
    expect(navigationProgress([], 10)).toBe(0)
    expect(navigationProgress(undefined, 10)).toBe(0)
    expect(navigationProgress([1, 2, 3], 10)).toBe(30)
    // pular para o fim do documento não vira progresso alto
    expect(navigationProgress([1, 200], 200)).toBe(1)
  })

  it('ignora repetições e páginas que não existem', () => {
    expect(navigationProgress([1, 1, 2, 2, 0, -3, 11, 2.5], 10)).toBe(20)
  })

  it('só chega a 100 com todas as páginas abertas e nunca mostra 0 depois da primeira', () => {
    expect(navigationProgress([1], 500)).toBe(1)
    expect(navigationProgress(Array.from({ length: 199 }, (_, i) => i + 1), 200)).toBe(99)
    expect(navigationProgress(Array.from({ length: 200 }, (_, i) => i + 1), 200)).toBe(100)
    expect(navigationProgress([1], 1)).toBe(100)
  })

  it('devolve 0 para contagem de páginas inválida', () => {
    expect(navigationProgress([1], 0)).toBe(0)
    expect(navigationProgress([1], Number.NaN)).toBe(0)
  })

  it('registra a página aberta sem repetir, em ordem, e só se ela existir', () => {
    expect(markVisited(undefined, 3, 10)).toEqual([3])
    expect(markVisited([5, 1], 3, 10)).toEqual([1, 3, 5])
    expect(markVisited([1, 3], 3, 10)).toEqual([1, 3])
    expect(markVisited([1, 99], 0, 10)).toEqual([1])
  })

  it('PDF lido antes do registro de visitas parte do trecho já percorrido', () => {
    expect(seedVisitedPages(3, 10)).toEqual([1, 2, 3])
    expect(seedVisitedPages(50, 4)).toEqual([1, 2, 3, 4])
    expect(seedVisitedPages(0, 10)).toEqual([])
    expect(navigationProgress(seedVisitedPages(5, 10), 10)).toBe(50)
  })
})

describe('estante: assunto, busca e situação', () => {
  it('lista os assuntos sem repetir (ignora caixa e acentos) e em ordem', () => {
    expect(shelfSubjects([{ subject: 'Estatística' }, { subject: ' estatistica ' }, { subject: 'Direito' }, { subject: '' }, {}])).toEqual(['Direito', 'Estatística'])
    expect(sameSubject('Estatística', 'ESTATISTICA')).toBe(true)
    expect(sameSubject('', '')).toBe(false)
  })

  it('a busca por título ou autor ignora acentos e pontuação', () => {
    const list = [
      { title: 'Pense em Estatística', author: 'Allen Downey' },
      { title: 'Cálculo: Volume 1', author: 'James Stewart' },
    ]
    expect(filterShelf(list, 'estatistica')).toHaveLength(1)
    expect(filterShelf(list, 'calculo volume')).toHaveLength(1)
    expect(filterShelf(list, 'STEWART')[0].title).toBe('Cálculo: Volume 1')
    expect(matchKey('  Olá,   Mundo! ')).toBe('ola mundo')
  })

  it('situação desconhecida ou ausente significa "na estante"', () => {
    expect(normalizeShelfState(undefined)).toBe('active')
    expect(normalizeShelfState('qualquer')).toBe('active')
    expect(normalizeShelfState('archived')).toBe('archived')
    expect(normalizeShelfState('hidden')).toBe('hidden')
  })
})
