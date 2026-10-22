import type { SubjectContent } from '../types'
import { cat, err, fill, match, mcq, multi, order, short, step, tf } from './_build'

const content: SubjectContent = {
  subjectId: 'portugues',
  units: [
    {
      id: 'portugues.u1',
      title: 'Ortografia e acentuação',
      summary: 'Regras de acentuação, hífen e grafias que mais caem.',
      topics: [
        { id: 'acento', name: 'Acentuação gráfica' },
        { id: 'grafia', name: 'Grafia e parônimos' },
        { id: 'porques', name: 'Porquês' },
      ],
      lesson: [
        { title: 'Tonicidade', body: 'Oxítona: sílaba tônica é a última (café). Paroxítona: penúltima (fácil). Proparoxítona: antepenúltima (lâmpada) — TODAS as proparoxítonas são acentuadas.' },
        { title: 'Oxítonas e paroxítonas', body: 'Oxítonas: acentue as terminadas em a(s), e(s), o(s), em, ens (sofá, você, avô, também, parabéns). Paroxítonas: acentue as terminadas em l, n, r, x, ps, ã(s), ão(s), um, uns, i(s), us e ditongo (fácil, hífen, caráter, tórax, órfã, júri, vírus, história).' },
        { title: 'Novo Acordo', body: 'Caiu o acento dos ditongos abertos ei/oi em paroxítonas (ideia, heroico), de vogais dobradas (voo, leem) e o trema (frequente). Mantém-se em oxítonas: herói, papéis.' },
        { title: 'Porquês', body: 'por que (pergunta / "pelo qual"), por quê (no fim da frase), porque (explicação = pois), porquê (substantivo, com artigo: o porquê).', example: 'Por que você saiu? Saiu por quê? Saí porque choveu. Não sei o porquê.' },
      ],
      challenges: [
        mcq('portugues.u1.c01', 'acento', 1, 'Qual palavra está corretamente acentuada?', ['ídeia', 'heróico', 'herói', 'vôo'], 2, 'Herói é oxítona com ditongo aberto "oi" — mantém o acento. Ideia, heroico e voo perderam o acento no Novo Acordo.'),
        tf('portugues.u1.c02', 'acento', 1, 'Todas as proparoxítonas são acentuadas.', true, 'Regra sem exceção: lâmpada, médico, página.'),
        cat('portugues.u1.c03', 'acento', 2, 'Classifique quanto à tonicidade.', ['Oxítona', 'Paroxítona', 'Proparoxítona'], [['café', 0], ['fácil', 1], ['lâmpada', 2], ['também', 0], ['caráter', 1]], 'Identifique a sílaba tônica: ca-FÉ, FÁ-cil, LÂM-pa-da, tam-BÉM, ca-RÁ-ter.'),
        fill('portugues.u1.c04', 'porques', 1, 'Complete com o porquê correto.', '___ você chegou atrasado?', [{ accept: ['Por que'], options: ['Por que', 'Por quê', 'Porque', 'Porquê'] }], 'Pergunta no início da frase: por que (separado, sem acento).'),
        fill('portugues.u1.c05', 'porques', 2, 'Complete com o porquê correto.', 'Ele faltou e ninguém sabe o ___.', [{ accept: ['porquê'], options: ['por que', 'por quê', 'porque', 'porquê'] }], 'Com artigo (o porquê) é substantivo: junto e com acento.'),
        err('portugues.u1.c06', 'grafia', 2, 'Toque na palavra com erro de grafia.', ['A', 'excessão', 'confirma', 'a', 'regra.'], 1, 'exceção', 'Escreve-se exceção (com ç). Lembre: exceto → exceção.'),
        match('portugues.u1.c07', 'grafia', 2, 'Associe o parônimo ao sentido.', [['ratificar', 'confirmar'], ['retificar', 'corrigir'], ['emergir', 'vir à tona'], ['imergir', 'mergulhar']], 'Parônimos têm grafia parecida e sentidos diferentes — caem muito em concursos.'),
        mcq('portugues.u1.c08', 'grafia', 2, 'Qual frase está correta?', ['Há cerca de dez anos estudo aqui.', 'A cerca de dez anos estudo aqui.', 'À cerca de dez anos estudo aqui.', 'Acerca de dez anos estudo aqui.'], 0, 'Há (verbo haver) indica tempo decorrido. "Acerca de" = sobre; "a cerca de" = distância/futuro aproximado.'),
        tf('portugues.u1.c09', 'acento', 2, 'Após o Novo Acordo, "idéia" e "assembléia" mantêm o acento.', false, 'Ditongos abertos ei/oi em paroxítonas perderam o acento: ideia, assembleia.'),
        short('portugues.u1.c10', 'porques', 2, 'Complete: "Você não veio ___?" (use a forma correta)', ['por quê'], 'No fim da frase, "que" vira tônico e recebe acento: por quê.', { accentSensitive: true }),
        multi('portugues.u1.boss', 'acento', 3, 'Chefe da unidade: revisão de texto.', [
          step.mcq('portugues.u1.boss.s1', 'Qual grafia está correta?', ['paranóico', 'paranoico', 'paranôico', 'paranóiko'], 1, 'Paroxítona com ditongo aberto "oi": sem acento após o Acordo.'),
          step.mcq('portugues.u1.boss.s2', '"Estudo ___ quero passar."', ['por que', 'porque', 'por quê', 'porquê'], 1, 'Explicação (= pois): porque.'),
          step.mcq('portugues.u1.boss.s3', 'Qual palavra é acentuada pela mesma regra de "fácil"?', ['útil', 'café', 'lâmpada', 'herói'], 0, 'Paroxítonas terminadas em l: fácil, útil.'),
        ], 'Aplique: tonicidade → terminação → regra.', { boss: true }),
      ],
    },
    {
      id: 'portugues.u2',
      title: 'Concordância e regência',
      summary: 'Concordância verbal e nominal, regência e crase.',
      topics: [
        { id: 'concord', name: 'Concordância verbal' },
        { id: 'regencia', name: 'Regência' },
        { id: 'crase', name: 'Crase' },
      ],
      lesson: [
        { title: 'Concordância verbal', body: 'O verbo concorda com o sujeito em número e pessoa — encontre o sujeito mesmo quando ele vem depois do verbo (Faltam dois candidatos).' },
        { title: 'Haver e fazer impessoais', body: 'Haver no sentido de existir e fazer indicando tempo decorrido ficam no SINGULAR: Houve problemas. Faz dez anos.' },
        { title: 'Regência', body: 'Alguns verbos pedem preposição: assistir (= ver) a algo, obedecer a, preferir algo A outra coisa (nunca "preferir mais... do que"), chegar a um lugar.' },
        { title: 'Crase', body: 'Crase = preposição a + artigo a. Ocorre antes de palavra feminina que admite artigo, quando o termo regente exige "a". Truque: troque por uma palavra masculina — se virar "ao", há crase. Não ocorre antes de verbo, de palavra masculina ou de pronomes como "ela", "esta".', example: 'Vou à escola (vou ao colégio). Vou a Brasília (vou a Goiânia — sem artigo).' },
      ],
      challenges: [
        mcq('portugues.u2.c01', 'concord', 2, 'Qual frase está correta?', ['Houveram muitos problemas.', 'Houve muitos problemas.', 'Haviam muitos problemas.', 'Houveram-se muitos problemas.'], 1, 'Haver = existir é impessoal: fica no singular.', { whyWrong: 'Erro clássico: tentar concordar o verbo impessoal com o objeto.' }),
        tf('portugues.u2.c02', 'concord', 2, '"Faz dois anos que estudo para concursos" está correto.', true, 'Fazer indicando tempo decorrido é impessoal: faz (singular).'),
        fill('portugues.u2.c03', 'concord', 2, 'Complete com a forma correta.', '___ dois candidatos na sala. (faltar)', [{ accept: ['Faltam'], options: ['Falta', 'Faltam'] }], 'O sujeito é "dois candidatos" (posposto): plural.'),
        err('portugues.u2.c04', 'regencia', 2, 'Toque no trecho com erro de regência.', ['Ontem', 'assisti o filme', 'no cinema.'], 1, 'assisti ao filme', 'Assistir, no sentido de ver, exige a preposição "a": assistir ao filme.'),
        mcq('portugues.u2.c05', 'regencia', 2, 'Qual frase segue a norma-padrão?', ['Prefiro mais café do que chá.', 'Prefiro café do que chá.', 'Prefiro café a chá.', 'Prefiro mais café a chá.'], 2, 'Preferir algo a algo, sem "mais" e sem "do que".'),
        fill('portugues.u2.c06', 'crase', 1, 'Complete usando crase quando necessário.', 'Vou ___ farmácia.', [{ accept: ['à'], options: ['a', 'à', 'há'] }], 'Vou ao mercado → vou à farmácia: há crase.'),
        fill('portugues.u2.c07', 'crase', 2, 'Complete usando crase quando necessário.', 'Começou ___ chover.', [{ accept: ['a'], options: ['a', 'à', 'há'] }], 'Não há crase antes de verbo.'),
        cat('portugues.u2.c08', 'crase', 3, 'Há crase?', ['Com crase', 'Sem crase'], [['Entreguei o relatório ___ diretora.', 0], ['Fiz referência ___ ele.', 1], ['Chegamos ___ Bahia.', 0], ['Voltei ___ Brasília.', 1], ['Ficou frente ___ frente.', 1]], 'Diretora e Bahia aceitam artigo (a diretora, a Bahia). "Ele" é pronome; Brasília não aceita artigo (venho de Brasília); expressões com palavra repetida não têm crase.'),
        match('portugues.u2.c09', 'regencia', 2, 'Associe o verbo à regência correta (sentido indicado).', [['assistir (ver)', 'assistir a algo'], ['obedecer', 'obedecer a alguém'], ['visar (almejar)', 'visar a algo'], ['implicar (acarretar)', 'implicar algo']], 'Implicar no sentido de acarretar é transitivo direto: "implica gastos" (não "implica em").'),
        tf('portugues.u2.c10', 'concord', 3, '"Fui eu que fiz o relatório" e "Fui eu quem fez o relatório" estão de acordo com a norma-padrão.', true, 'Com "que", o verbo concorda com o antecedente (eu fiz). Com "quem", o verbo fica na 3ª pessoa (quem fez) — a concordância com o antecedente (quem fiz) também é aceita.'),
        multi('portugues.u2.boss', 'crase', 4, 'Chefe da unidade: ofício.', [
          step.mcq('portugues.u2.boss.s1', '"Encaminhamos o documento ___ Vossa Senhoria."', ['à', 'a', 'há', 'ah'], 1, 'Não há crase antes de pronomes de tratamento (exceto senhora, senhorita, dona).'),
          step.mcq('portugues.u2.boss.s2', '"___ duas vagas abertas."', ['Existe', 'Há', 'Hão', 'Houveram'], 1, 'Haver = existir no singular; "existir" iria para o plural (existem).'),
          step.mcq('portugues.u2.boss.s3', '"Os candidatos ___ ao edital."', ['obedeceram', 'obedeceu', 'obedeceram o', 'obedeceram com'], 0, 'Sujeito plural; obedecer a algo.'),
        ], 'Revise sujeito, impessoalidade e regência antes de marcar.', { boss: true }),
      ],
    },
    {
      id: 'portugues.u3',
      title: 'Sintaxe, pontuação e interpretação',
      summary: 'Vírgula, conectivos, sujeito e leitura de texto.',
      topics: [
        { id: 'virgula', name: 'Pontuação' },
        { id: 'conectivos', name: 'Conectivos e coesão' },
        { id: 'interpretacao', name: 'Interpretação de texto' },
      ],
      lesson: [
        { title: 'Vírgula: o que NÃO separar', body: 'Não se separa sujeito do verbo nem verbo de seus complementos. Ex.: "Os candidatos aprovados, serão convocados" está ERRADO.' },
        { title: 'Vírgula: usos obrigatórios', body: 'Isolar vocativo, aposto explicativo, adjunto adverbial deslocado (quando longo), orações intercaladas e conjunções intercaladas (porém, contudo, portanto quando no meio da oração).' },
        { title: 'Conectivos', body: 'Adversativos (mas, porém, contudo, todavia, no entanto) indicam oposição. Conclusivos (logo, portanto, por isso). Causais (porque, já que, visto que). Concessivos (embora, ainda que, mesmo que) — pedem subjuntivo.' },
        { title: 'Interpretação', body: 'Separe o que o texto DIZ (compreensão) do que se pode CONCLUIR (interpretação). Desconfie de alternativas com generalizações absolutas (sempre, nunca, todos) que o texto não sustenta.' },
      ],
      challenges: [
        err('portugues.u3.c01', 'virgula', 2, 'Toque no trecho com a vírgula indevida.', ['Os candidatos aprovados,', 'serão convocados', 'na próxima semana.'], 0, 'Os candidatos aprovados (sem vírgula)', 'A vírgula separava o sujeito do verbo — proibido.'),
        mcq('portugues.u3.c02', 'virgula', 2, 'Qual frase está pontuada corretamente?', ['Maria, venha aqui.', 'Maria venha, aqui.', 'Maria venha aqui,', ', Maria venha aqui.'], 0, 'O vocativo (Maria) é sempre isolado por vírgula.'),
        cat('portugues.u3.c03', 'conectivos', 2, 'Classifique os conectivos.', ['Oposição', 'Conclusão', 'Concessão'], [['porém', 0], ['portanto', 1], ['embora', 2], ['contudo', 0], ['logo', 1], ['ainda que', 2]], 'Adversativos opõem; conclusivos concluem; concessivos admitem um fato contrário sem impedir o principal.'),
        mcq('portugues.u3.c04', 'conectivos', 3, '"Estudou muito; ___, não foi aprovado." Qual conectivo mantém o sentido?', ['portanto', 'no entanto', 'porque', 'logo'], 1, 'Há oposição entre estudar muito e não passar: adversativo.'),
        fill('portugues.u3.c05', 'conectivos', 3, 'Complete com o verbo no modo correto.', 'Embora ___ cansado, continuou estudando. (estar)', [['estivesse', 'esteja']], 'Conjunções concessivas pedem subjuntivo: embora estivesse/esteja.'),
        tf('portugues.u3.c06', 'virgula', 2, 'Em "O diretor, que é muito exigente, aprovou o projeto", as vírgulas indicam uma oração explicativa.', true, 'Oração adjetiva explicativa: acrescenta informação sobre todo o termo, isolada por vírgulas.'),
        mcq('portugues.u3.c07', 'interpretacao', 3, 'Texto: "Embora a tecnologia facilite o acesso à informação, ela não substitui o hábito da leitura atenta." O autor defende que:', ['a tecnologia é prejudicial à leitura', 'a leitura atenta continua necessária', 'a informação é inacessível', 'ninguém mais lê'], 1, 'A concessão reconhece a vantagem da tecnologia e afirma que a leitura atenta segue indispensável.', { whyWrong: 'O texto não diz que a tecnologia é prejudicial; as demais extrapolam.' }),
        mcq('portugues.u3.c08', 'interpretacao', 3, 'Texto: "Alguns servidores aderiram ao programa." É correto inferir que:', ['todos os servidores aderiram', 'nenhum servidor aderiu', 'houve servidores que não aderiram ou cuja adesão é desconhecida', 'a maioria aderiu'], 2, '"Alguns" não permite concluir "todos" nem "maioria". Cuidado com extrapolações.'),
        order('portugues.u3.c09', 'conectivos', 2, 'Ordene para formar um parágrafo coeso.', ['A procura por cursos on-line cresceu.', 'Isso ocorreu, sobretudo, pela flexibilidade de horários.', 'No entanto, a evasão também aumentou.', 'Portanto, é preciso investir em acompanhamento.'], 'Fato → causa → contraponto → conclusão. Os conectivos (isso, no entanto, portanto) indicam a sequência.'),
        short('portugues.u3.c10', 'conectivos', 3, 'Reescreva com um conectivo conclusivo de uma palavra: "Choveu muito; ___ , o evento foi adiado."', ['portanto', 'logo', 'assim', 'então', 'consequentemente'], 'Portanto, logo, assim, então e consequentemente indicam conclusão.'),
        multi('portugues.u3.boss', 'interpretacao', 5, 'Chefe final de Português: análise de período.', [
          step.mcq('portugues.u3.boss.s1', '"Os alunos, que estudaram com método, foram aprovados." A oração entre vírgulas é:', ['restritiva', 'explicativa', 'adverbial', 'principal'], 1, 'Entre vírgulas → explicativa (todos os alunos estudaram com método).'),
          step.mcq('portugues.u3.boss.s2', 'Sem as vírgulas, o sentido passa a ser:', ['todos foram aprovados', 'só os que estudaram com método foram aprovados', 'ninguém foi aprovado', 'igual ao original'], 1, 'A restritiva delimita um subgrupo.'),
          step.mcq('portugues.u3.boss.s3', 'Qual vírgula seria um erro na frase original?', ['Os alunos, que estudaram...', '... com método, foram aprovados', 'Os alunos que estudaram com método foram, aprovados', 'Nenhuma das anteriores'], 2, 'A vírgula separaria o verbo de ligação do predicativo.'),
        ], 'Vírgulas mudam o sentido: explicativa (generaliza) × restritiva (delimita).', { boss: true }),
      ],
    },
  ],
}

export default content
