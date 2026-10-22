import type { SubjectContent } from '../types'
import { cat, fill, match, mcq, multi, num, order, short, step, tf } from './_build'

const content: SubjectContent = {
  subjectId: 'logica',
  units: [
    {
      id: 'logica.u1',
      title: 'Proposições e conectivos',
      summary: 'Proposições, tabela-verdade, negações e equivalências.',
      topics: [
        { id: 'proposicoes', name: 'Proposições' },
        { id: 'conectivos', name: 'Conectivos e tabela-verdade' },
        { id: 'negacao', name: 'Negação e equivalências' },
      ],
      lesson: [
        { title: 'Proposição', body: 'Frase declarativa que pode ser julgada como verdadeira ou falsa (nunca as duas). Perguntas, ordens, exclamações e frases abertas ("x > 3") NÃO são proposições.' },
        { title: 'Conectivos', body: 'E (∧): V só se ambas V. OU (∨): F só se ambas F. Se…então (→): F só quando V → F. Se e somente se (↔): V quando têm o mesmo valor. Ou…ou (⊻): V quando têm valores diferentes.' },
        { title: 'Tabela-verdade', body: 'Com n proposições simples, a tabela tem 2ⁿ linhas.' },
        { title: 'Negações (De Morgan)', body: '~(p ∧ q) ≡ ~p ∨ ~q. ~(p ∨ q) ≡ ~p ∧ ~q. ~(p → q) ≡ p ∧ ~q ("mantém a primeira E nega a segunda").', example: 'Negação de "Se estudo, passo": "Estudo e não passo".' },
        { title: 'Equivalências do condicional', body: 'p → q ≡ ~q → ~p (contrapositiva) ≡ ~p ∨ q.' },
      ],
      challenges: [
        tf('logica.u1.c01', 'proposicoes', 1, '"Que horas são?" é uma proposição.', false, 'Perguntas não podem ser julgadas como V ou F.'),
        cat('logica.u1.c02', 'proposicoes', 2, 'É proposição?', ['Proposição', 'Não é proposição'], [['Brasília é a capital do Brasil.', 0], ['Estude mais!', 1], ['x + 2 = 5', 1], ['2 + 2 = 5', 0], ['Que dia lindo!', 1]], '"2 + 2 = 5" é falsa, mas é proposição. "x + 2 = 5" é sentença aberta (depende de x).'),
        num('logica.u1.c03', 'conectivos', 1, 'Quantas linhas tem a tabela-verdade de uma proposição com 3 proposições simples?', 8, '2³ = 8.'),
        mcq('logica.u1.c04', 'conectivos', 2, 'Quando "p → q" é FALSA?', ['p V e q V', 'p V e q F', 'p F e q V', 'p F e q F'], 1, 'O condicional só é falso na combinação "Vera Fischer": V → F.'),
        mcq('logica.u1.c05', 'conectivos', 2, 'Se p é V e q é F, qual o valor de (p ∨ q) ∧ ~q?', ['V', 'F', 'Indeterminado', 'Depende de r'], 0, 'p ∨ q = V; ~q = V; V ∧ V = V.'),
        match('logica.u1.c06', 'conectivos', 2, 'Associe o conectivo à condição de VERDADE.', [['p ∧ q', 'Ambas verdadeiras'], ['p ∨ q', 'Pelo menos uma verdadeira'], ['p ↔ q', 'Mesmo valor lógico'], ['p ⊻ q', 'Valores diferentes']], 'Memorize as condições de verdade e de falsidade de cada conectivo.'),
        mcq('logica.u1.c07', 'negacao', 2, 'Negação de "João estuda e Maria trabalha":', ['João não estuda e Maria não trabalha', 'João não estuda ou Maria não trabalha', 'João estuda ou Maria trabalha', 'Se João estuda, Maria não trabalha'], 1, 'De Morgan: ~(p ∧ q) ≡ ~p ∨ ~q.', { whyWrong: 'Negar os dois mantendo "e" é o erro mais comum.' }),
        mcq('logica.u1.c08', 'negacao', 3, 'Negação de "Se chove, então levo guarda-chuva":', ['Se não chove, não levo guarda-chuva', 'Chove e não levo guarda-chuva', 'Não chove ou levo guarda-chuva', 'Se levo guarda-chuva, chove'], 1, '~(p → q) ≡ p ∧ ~q.'),
        mcq('logica.u1.c09', 'negacao', 3, 'Qual é equivalente a "Se estudo, então passo"?', ['Se passo, então estudo', 'Se não estudo, não passo', 'Se não passo, então não estudei', 'Estudo e passo'], 2, 'Contrapositiva: p → q ≡ ~q → ~p.', { whyWrong: 'Inverter (q → p) ou só negar (~p → ~q) não gera equivalência.' }),
        fill('logica.u1.c10', 'negacao', 3, 'Complete a equivalência.', 'p → q ≡ ~p ___ q', [{ accept: ['∨', 'ou', 'v'], options: ['∧', '∨', '→', '↔'] }], 'p → q ≡ ~p ∨ q ("não p ou q").'),
        tf('logica.u1.c11', 'conectivos', 2, 'Se p é F, então p → q é verdadeira, qualquer que seja q.', true, 'Antecedente falso torna o condicional verdadeiro (verdade por vacuidade).'),
        multi('logica.u1.boss', 'negacao', 4, 'Chefe da unidade: julgue as afirmações.', [
          step.mcq('logica.u1.boss.s1', 'Negação de "Todo aluno estuda":', ['Nenhum aluno estuda', 'Algum aluno não estuda', 'Todo aluno não estuda', 'Algum aluno estuda'], 1, 'Negar "todo" → "algum… não".'),
          step.mcq('logica.u1.boss.s2', 'Negação de "Algum servidor é pontual":', ['Nenhum servidor é pontual', 'Algum servidor não é pontual', 'Todo servidor é pontual', 'Todo servidor é impontual e algum é pontual'], 0, 'Negar "algum" → "nenhum".'),
          step.mcq('logica.u1.boss.s3', '~(p ∨ q) equivale a:', ['~p ∨ ~q', '~p ∧ ~q', 'p ∧ q', '~p → q'], 1, 'De Morgan.'),
        ], 'Quantificadores: todo ↔ algum não; algum ↔ nenhum.', { boss: true }),
      ],
    },
    {
      id: 'logica.u2',
      title: 'Argumentação e diagramas',
      summary: 'Quantificadores, diagramas lógicos e validade.',
      topics: [
        { id: 'quantificadores', name: 'Quantificadores' },
        { id: 'diagramas', name: 'Diagramas lógicos' },
        { id: 'argumentos', name: 'Validade de argumentos' },
      ],
      lesson: [
        { title: 'Quantificadores', body: 'Todo A é B: o conjunto A está dentro de B. Algum A é B: há interseção. Nenhum A é B: conjuntos disjuntos.' },
        { title: 'Argumento válido', body: 'Válido quando, SE as premissas forem verdadeiras, a conclusão é necessariamente verdadeira. Validade é sobre a forma, não sobre a verdade das frases.' },
        { title: 'Modus ponens e modus tollens', body: 'Modus ponens: p → q; p; logo q. Modus tollens: p → q; ~q; logo ~p. Falácias: afirmar o consequente (p → q; q; logo p) e negar o antecedente (p → q; ~p; logo ~q).' },
      ],
      challenges: [
        mcq('logica.u2.c01', 'argumentos', 2, '"Se chove, a rua molha. Choveu. Logo, a rua molhou." Esse argumento é:', ['válido (modus ponens)', 'inválido', 'válido (modus tollens)', 'falácia do consequente'], 0, 'p → q; p ⊢ q.'),
        mcq('logica.u2.c02', 'argumentos', 3, '"Se estudo, passo. Passei. Logo, estudei." Esse argumento é:', ['válido', 'inválido: afirma o consequente', 'válido por contraposição', 'inválido: nega o antecedente'], 1, 'Passar pode ter outra causa. p → q; q não garante p.'),
        mcq('logica.u2.c03', 'argumentos', 3, '"Se o sistema cair, o alarme toca. O alarme não tocou. Logo…"', ['o sistema caiu', 'o sistema não caiu', 'nada se pode concluir', 'o alarme está quebrado'], 1, 'Modus tollens: p → q; ~q ⊢ ~p.'),
        tf('logica.u2.c04', 'diagramas', 2, '"Todo gato é mamífero" e "Algum mamífero é gato" podem ser ambas verdadeiras.', true, 'Se o conjunto dos gatos está dentro dos mamíferos (e não é vazio), há mamíferos que são gatos.'),
        mcq('logica.u2.c05', 'diagramas', 3, '"Todo A é B. Nenhum B é C." Então, necessariamente:', ['Algum A é C', 'Nenhum A é C', 'Todo C é A', 'Algum C é B'], 1, 'A está dentro de B, e B não toca C; logo A também não toca C.'),
        cat('logica.u2.c06', 'argumentos', 3, 'Classifique a forma do argumento.', ['Válido', 'Inválido'], [['p → q; p ⊢ q', 0], ['p → q; ~q ⊢ ~p', 0], ['p → q; q ⊢ p', 1], ['p → q; ~p ⊢ ~q', 1], ['p ∨ q; ~p ⊢ q', 0]], 'Modus ponens, modus tollens e silogismo disjuntivo são válidos; afirmar o consequente e negar o antecedente, não.'),
        num('logica.u2.c07', 'diagramas', 3, 'Numa turma, 20 estudam inglês, 15 estudam espanhol e 8 estudam os dois. Quantos estudam ao menos um idioma?', 27, 'União = 20 + 15 − 8 = 27.'),
        num('logica.u2.c08', 'diagramas', 4, 'Em 40 candidatos, 25 fizeram a prova A, 18 a prova B e 5 não fizeram nenhuma. Quantos fizeram as duas?', 8, 'Fizeram alguma: 40 − 5 = 35. Interseção = 25 + 18 − 35 = 8.'),
        short('logica.u2.c09', 'argumentos', 2, 'Como se chama a regra "p → q; ~q; logo ~p"? (em latim)', ['modus tollens'], 'Modus tollens ("modo que nega").'),
        mcq('logica.u2.c10', 'quantificadores', 3, '"Nenhum político é honesto" é falsa. Então é verdade que:', ['Todo político é honesto', 'Algum político é honesto', 'Nenhum político é desonesto', 'Algum político não é honesto'], 1, 'A negação de "nenhum A é B" é "algum A é B".'),
        multi('logica.u2.boss', 'argumentos', 5, 'Chefe da unidade: investigação.', [
          step.mcq('logica.u2.boss.s1', 'Premissas: "Se Ana foi, Bia foi." e "Bia não foi." Conclusão:', ['Ana foi', 'Ana não foi', 'Nada se conclui', 'Bia foi'], 1, 'Modus tollens.'),
          step.mcq('logica.u2.boss.s2', 'Nova premissa: "Ana foi ou Carla foi." Então:', ['Carla foi', 'Carla não foi', 'Nada se conclui', 'Ana foi'], 0, 'Silogismo disjuntivo: Ana não foi, logo Carla foi.'),
          step.mcq('logica.u2.boss.s3', 'Se também vale "Se Carla foi, Davi não foi", então:', ['Davi foi', 'Davi não foi', 'Nada se conclui', 'Carla não foi'], 1, 'Modus ponens.'),
        ], 'Encadeie as regras a partir da premissa simples.', { boss: true }),
      ],
    },
    {
      id: 'logica.u3',
      title: 'Contagem e probabilidade',
      summary: 'Princípio fundamental, arranjos, combinações e probabilidade.',
      topics: [
        { id: 'contagem', name: 'Princípio da contagem' },
        { id: 'combinatoria', name: 'Arranjos e combinações' },
        { id: 'probabilidade', name: 'Probabilidade' },
      ],
      lesson: [
        { title: 'Princípio multiplicativo', body: 'Se uma escolha tem m opções e outra, independente, tem n, há m × n possibilidades.' },
        { title: 'Ordem importa?', body: 'Permutação: ordena todos (n!). Arranjo: escolhe e ordena (n!/(n−p)!). Combinação: escolhe sem ordem (n!/(p!(n−p)!)). Pergunta-chave: trocar a ordem gera um resultado diferente?' },
        { title: 'Probabilidade', body: 'P(A) = casos favoráveis / casos possíveis (equiprováveis). P(não A) = 1 − P(A). Eventos independentes: P(A e B) = P(A) × P(B).' },
      ],
      challenges: [
        num('logica.u3.c01', 'contagem', 1, 'Com 3 camisas e 4 calças, quantos looks diferentes (1 camisa + 1 calça)?', 12, '3 × 4 = 12.'),
        num('logica.u3.c02', 'combinatoria', 2, 'De quantas formas 4 pessoas podem se sentar em 4 cadeiras enfileiradas?', 24, '4! = 24.'),
        num('logica.u3.c03', 'combinatoria', 3, 'Quantas comissões de 2 pessoas podem ser formadas com 5 pessoas?', 10, 'Ordem não importa: C(5,2) = 10.'),
        num('logica.u3.c04', 'combinatoria', 3, 'Quantas formas de escolher presidente e vice entre 5 pessoas?', 20, 'Ordem importa (cargos diferentes): A(5,2) = 5 × 4 = 20.'),
        cat('logica.u3.c05', 'combinatoria', 3, 'A ordem importa?', ['Arranjo/permutação', 'Combinação'], [['Senha de 4 dígitos distintos', 0], ['Escolher 3 livros para levar', 1], ['Pódio de uma corrida', 0], ['Grupo de estudo de 4 pessoas', 1]], 'Se trocar a ordem muda o resultado, é arranjo.'),
        num('logica.u3.c06', 'probabilidade', 1, 'Qual a probabilidade (em %) de sair número par em um dado comum?', 50, '3 pares (2, 4, 6) em 6 faces = 1/2 = 50%.', { unit: '%', tolerance: 0.01 }),
        num('logica.u3.c07', 'probabilidade', 2, 'Lançando duas moedas, qual a probabilidade (em %) de saírem duas caras?', 25, '1/2 × 1/2 = 1/4 = 25%.', { unit: '%', tolerance: 0.01 }),
        num('logica.u3.c08', 'probabilidade', 3, 'Uma urna tem 3 bolas vermelhas e 7 azuis. Tirando uma, qual a probabilidade (em %) de NÃO ser vermelha?', 70, 'P(não vermelha) = 1 − 3/10 = 7/10 = 70%.', { unit: '%', tolerance: 0.01 }),
        tf('logica.u3.c09', 'probabilidade', 2, 'Se uma moeda deu cara 5 vezes seguidas, a chance de dar coroa na próxima é maior que 50%.', false, 'Lançamentos independentes: continua 50%. Acreditar no contrário é a "falácia do apostador".'),
        order('logica.u3.c10', 'combinatoria', 2, 'Ordene do MENOR para o MAIOR resultado.', ['C(5,2)', 'A(5,2)', '5!', '2⁸'], 'C(5,2) = 10; A(5,2) = 20; 5! = 120; 2⁸ = 256.'),
        mcq('logica.u3.c11', 'contagem', 3, 'Quantos anagramas tem a palavra AMOR?', ['12', '16', '24', '4'], 2, '4 letras distintas: 4! = 24.'),
        num('logica.u3.c12', 'combinatoria', 4, 'Quantos anagramas tem a palavra ARARA?', 10, 'Permutação com repetição: 5! / (3! × 2!) = 120 / 12 = 10.'),
        multi('logica.u3.boss', 'probabilidade', 5, 'Chefe final de Lógica: sorteio.', [
          step.num('logica.u3.boss.s1', 'Quantos grupos de 3 podem ser sorteados entre 6 pessoas?', 20, 'C(6,3) = 20.'),
          step.num('logica.u3.boss.s2', 'Em quantos desses grupos Ana está?', 10, 'Fixando Ana, escolha 2 entre 5: C(5,2) = 10.'),
          step.num('logica.u3.boss.s3', 'Qual a probabilidade (em %) de Ana ser sorteada?', 50, '10/20 = 50%.', 0.01),
        ], 'Probabilidade = favoráveis / possíveis, contando com combinações.', { boss: true }),
      ],
    },
  ],
}

export default content
