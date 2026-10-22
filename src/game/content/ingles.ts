import type { SubjectContent } from '../types'
import { cat, err, fill, listen, match, mcq, multi, order, short, step, tf } from './_build'

const content: SubjectContent = {
  subjectId: 'ingles',
  units: [
    {
      id: 'ingles.u1',
      title: 'A1 — Primeiros passos',
      summary: 'Verb to be, apresentações, rotina e vocabulário básico.',
      topics: [
        { id: 'tobe', name: 'Verb to be' },
        { id: 'present', name: 'Simple present' },
        { id: 'vocab1', name: 'Vocabulário do dia a dia' },
      ],
      lesson: [
        { title: 'Verb to be', body: 'I am · you are · he/she/it is · we/they are. Negativa: am not, isn’t, aren’t. Pergunta: inverta — Are you ready?', example: "I'm a student. She isn't at home. Are they Brazilian?" },
        { title: 'Simple present', body: 'Hábitos e fatos. Na 3ª pessoa do singular (he/she/it) o verbo ganha -s/-es: she works, he watches. Negativa e pergunta usam do/does + verbo sem -s.', example: 'He works in Brasília. Does he work on Saturdays? No, he doesn’t.' },
        { title: 'Advérbios de frequência', body: 'always > usually > often > sometimes > rarely > never. Ficam antes do verbo principal e depois do verb to be.', example: 'I usually study at night. She is always late.' },
        { title: 'Ouvir com calma', body: 'Nos desafios de áudio, ouça primeiro em velocidade normal e depois em velocidade lenta. A tradução aparece só depois da sua resposta.' },
      ],
      challenges: [
        fill('ingles.u1.c01', 'tobe', 1, 'Complete com o verb to be.', 'She ___ a teacher.', [{ accept: ['is'], options: ['am', 'is', 'are'] }], 'He/she/it → is.'),
        fill('ingles.u1.c02', 'tobe', 1, 'Complete com o verb to be.', 'We ___ from Brazil.', [{ accept: ['are'], options: ['am', 'is', 'are'] }], 'We/you/they → are.'),
        mcq('ingles.u1.c03', 'present', 1, 'Escolha a frase correta.', ['He work every day.', 'He works every day.', 'He working every day.', 'He is work every day.'], 1, 'No simple present, he/she/it recebe -s: works.', { whyWrong: '"He work" esquece o -s; "is work" mistura to be com verbo principal.' }),
        err('ingles.u1.c04', 'present', 2, 'Toque na palavra errada.', ['Does', 'she', 'likes', 'coffee?'], 2, 'like', 'Com does, o verbo volta à forma base: Does she like coffee? O -s já está no does.'),
        listen('ingles.u1.c05', 'vocab1', 1, 'Ouça e escolha o que foi dito.', 'Nice to meet you.', ['Nice to meet you.', 'Nice to see you.', 'Nice to beat you.', 'Need to meet you.'], 0, '"Nice to meet you" é dito ao conhecer alguém pela primeira vez.', { translation: 'Prazer em conhecer você.' }),
        listen('ingles.u1.c06', 'present', 1, 'Ouça e escolha a frase.', 'I usually study at night.', ['I usually study at night.', 'I usually stay at night.', 'I rarely study at night.', 'I usually study at nine.'], 0, 'usually = geralmente; o advérbio vem antes do verbo principal.', { translation: 'Eu geralmente estudo à noite.' }),
        match('ingles.u1.c07', 'vocab1', 1, 'Associe a palavra à tradução.', [['always', 'sempre'], ['sometimes', 'às vezes'], ['never', 'nunca'], ['usually', 'geralmente']], 'Advérbios de frequência, do mais ao menos frequente: always, usually, sometimes, never.'),
        order('ingles.u1.c08', 'present', 2, 'Monte a pergunta na ordem correta.', ['Where', 'do', 'you', 'live?'], 'Pergunta com wh-word: Wh + do/does + sujeito + verbo.'),
        tf('ingles.u1.c09', 'tobe', 1, '"They isn’t at school" está correto.', false, 'They → aren’t: They aren’t at school.'),
        short('ingles.u1.c10', 'vocab1', 2, 'Traduza para o inglês: "Eu tenho vinte anos."', ["I am twenty years old", "I'm twenty years old", "I am twenty", "I'm twenty", 'I am 20 years old', "I'm 20 years old", "I'm 20", 'I am 20'], 'Idade em inglês usa o verb to be: I am twenty (years old) — nunca "I have twenty years".', { whyWrong: '"I have 20 years" é um decalque do português.' }),
        cat('ingles.u1.c11', 'present', 2, 'Classifique cada verbo na 3ª pessoa (he/she/it).', ['+s', '+es', '+ies'], [['work → works', 0], ['watch → watches', 1], ['study → studies', 2], ['go → goes', 1], ['play → plays', 0]], 'Terminações -ch, -sh, -s, -x, -o levam -es; consoante + y vira -ies; vogal + y só +s.'),
        multi('ingles.u1.boss', 'present', 3, 'Chefe da unidade A1: um perfil.', [
          step.mcq('ingles.u1.boss.s1', '"Maria ___ a nurse."', ['am', 'is', 'are', 'be'], 1, 'Maria = she → is.'),
          step.mcq('ingles.u1.boss.s2', '"She ___ in a hospital."', ['work', 'works', 'working', 'is work'], 1, 'Simple present, 3ª pessoa → works.'),
          step.mcq('ingles.u1.boss.s3', '"___ she work at night?"', ['Do', 'Does', 'Is', 'Are'], 1, 'Pergunta no simple present com she → Does.'),
        ], 'Verb to be para identidade; simple present para rotina; does nas perguntas da 3ª pessoa.', { boss: true }),
      ],
    },
    {
      id: 'ingles.u2',
      title: 'A2 — Passado e planos',
      summary: 'Simple past, going to, comparativos e preposições.',
      topics: [
        { id: 'past', name: 'Simple past' },
        { id: 'future', name: 'Going to e will' },
        { id: 'compar', name: 'Comparativos' },
      ],
      lesson: [
        { title: 'Simple past', body: 'Ações terminadas no passado. Regulares: +ed (worked, studied). Irregulares têm forma própria (go → went, have → had). Negativa e pergunta usam did + verbo base.', example: 'I went to the gym yesterday. Did you go? No, I didn’t go.' },
        { title: 'Going to × will', body: 'Going to: planos já decididos e previsões com evidência. Will: decisões no momento, promessas e previsões em geral.', example: "I'm going to travel in July. — The phone is ringing! — I'll get it." },
        { title: 'Comparativos', body: 'Adjetivos curtos: +er than (cheaper than). Longos: more ... than (more expensive than). Irregulares: good → better, bad → worse.' },
        { title: 'Preposições de tempo', body: 'at + horas (at 7 pm), on + dias/datas (on Monday), in + meses/anos/períodos (in July, in 2025, in the morning).' },
      ],
      challenges: [
        fill('ingles.u2.c01', 'past', 1, 'Complete com o passado de "go".', 'Yesterday I ___ to the bank.', [['went']], 'go é irregular: go → went → gone.'),
        mcq('ingles.u2.c02', 'past', 2, 'Escolha a pergunta correta.', ['Did you went to the party?', 'Did you go to the party?', 'Do you went to the party?', 'Went you to the party?'], 1, 'Com did, o verbo fica na forma base: Did you go...?'),
        err('ingles.u2.c03', 'past', 2, 'Toque na palavra errada.', ['She', "didn't", 'saw', 'the', 'message.'], 2, 'see', "Depois de didn't, use a forma base: She didn't see the message."),
        match('ingles.u2.c04', 'past', 2, 'Associe o verbo ao passado.', [['buy', 'bought'], ['think', 'thought'], ['take', 'took'], ['write', 'wrote']], 'Todos são irregulares e muito frequentes.'),
        cat('ingles.u2.c05', 'future', 3, 'Going to ou will?', ['going to', 'will'], [['Plano já decidido: viagem comprada', 0], ['Decisão na hora: "Eu atendo!"', 1], ['Previsão com evidência: nuvens pretas', 0], ['Promessa: "Eu te ajudo amanhã"', 1]], 'Going to = intenção prévia/evidência; will = decisão no momento/promessa.'),
        fill('ingles.u2.c06', 'compar', 1, 'Complete o comparativo.', 'This laptop is ___ than that one. (cheap)', [['cheaper']], 'Adjetivo curto: +er.'),
        mcq('ingles.u2.c07', 'compar', 2, 'Qual é a forma correta?', ['more good', 'gooder', 'better', 'best than'], 2, 'good → better (comparativo) → the best (superlativo).'),
        fill('ingles.u2.c08', 'compar', 2, 'Complete com a preposição de tempo.', 'The class starts ___ Monday ___ 8 a.m.', [{ accept: ['on'], options: ['in', 'on', 'at'] }, { accept: ['at'], options: ['in', 'on', 'at'] }], 'on + dia da semana; at + horário.'),
        listen('ingles.u2.c09', 'past', 2, 'Ouça e responda: quando a pessoa chegou?', 'I arrived home late last night because the bus broke down.', ['Ontem à noite', 'Hoje cedo', 'Na semana passada', 'Amanhã'], 0, '"last night" = ontem à noite. "broke down" = quebrou (veículo).', { translation: 'Cheguei tarde em casa ontem à noite porque o ônibus quebrou.' }),
        listen('ingles.u2.c10', 'future', 2, 'Ouça e escolha o que a pessoa vai fazer.', "I'm going to visit my grandparents next weekend.", ['Visitar os avós no próximo fim de semana', 'Visitou os avós no fim de semana passado', 'Visitar os pais amanhã', 'Ligar para os avós hoje'], 0, '"going to" + next weekend = plano futuro.', { translation: 'Vou visitar meus avós no próximo fim de semana.' }),
        order('ingles.u2.c11', 'past', 2, 'Monte a frase.', ['We', "didn't", 'watch', 'the', 'game.'], 'Sujeito + didn’t + verbo base + complemento.'),
        multi('ingles.u2.boss', 'past', 4, 'Chefe A2: uma viagem.', [
          step.mcq('ingles.u2.boss.s1', '"Last year we ___ to Salvador."', ['go', 'went', 'gone', 'going'], 1, 'Passado simples de go.'),
          step.mcq('ingles.u2.boss.s2', '"It was ___ than Brasília." (hot)', ['hoter', 'hotter', 'more hot', 'hottest'], 1, 'CVC dobra a consoante: hot → hotter.'),
          step.mcq('ingles.u2.boss.s3', '"Next year we ___ visit Recife." (plano decidido)', ['are going to', 'went', 'will to', 'going'], 0, 'Plano decidido → be going to.'),
        ], 'Passado, comparativo e futuro na mesma narrativa.', { boss: true }),
      ],
    },
    {
      id: 'ingles.u3',
      title: 'B1 — Comunicação real',
      summary: 'Present perfect, condicionais, phrasal verbs e leitura.',
      topics: [
        { id: 'perfect', name: 'Present perfect' },
        { id: 'cond', name: 'Condicionais' },
        { id: 'phrasal', name: 'Phrasal verbs' },
      ],
      lesson: [
        { title: 'Present perfect', body: 'have/has + particípio. Liga passado e presente: experiências (ever/never), ações recentes (just/already/yet) e duração até agora (for/since). Com tempo definido no passado (yesterday, in 2020), use o simple past.', example: "I've lived here for five years. Have you ever been to London? I visited London in 2019." },
        { title: 'For × since', body: 'for + duração (for two years); since + ponto de início (since 2020, since Monday).' },
        { title: 'Condicionais', body: 'Zero: fatos (If you heat ice, it melts). First: possibilidade real (If it rains, I will stay home). Second: hipótese irreal no presente (If I had money, I would travel).' },
        { title: 'Phrasal verbs', body: 'Verbo + partícula com sentido próprio: give up (desistir), look for (procurar), find out (descobrir), turn down (recusar).' },
      ],
      challenges: [
        mcq('ingles.u3.c01', 'perfect', 2, 'Escolha a frase correta.', ['I have seen that movie yesterday.', 'I saw that movie yesterday.', 'I have saw that movie yesterday.', 'I seen that movie yesterday.'], 1, 'Com tempo definido (yesterday), use o simple past.', { whyWrong: 'Present perfect não combina com marcadores de tempo terminado.' }),
        fill('ingles.u3.c02', 'perfect', 2, 'Complete com for ou since.', "She has worked here ___ 2019.", [{ accept: ['since'], options: ['for', 'since'] }], 'since + ponto de início.'),
        fill('ingles.u3.c03', 'perfect', 2, 'Complete com o particípio de "be".', 'Have you ever ___ to Canada?', [['been']], 'be → was/were → been. "Have you ever been to…?" pergunta sobre experiência.'),
        mcq('ingles.u3.c04', 'cond', 3, '"If I ___ more time, I would learn Japanese."', ['have', 'had', 'will have', 'would have'], 1, 'Second conditional: If + simple past, would + verbo. Hipótese irreal no presente.'),
        cat('ingles.u3.c05', 'cond', 3, 'Classifique as frases.', ['Zero conditional', 'First conditional', 'Second conditional'], [['If you heat water to 100°C, it boils.', 0], ['If it rains tomorrow, I will stay home.', 1], ['If I were you, I would accept the offer.', 2], ['If you study, you will pass.', 1]], 'Zero: presente + presente (fato). First: presente + will. Second: passado + would.'),
        match('ingles.u3.c06', 'phrasal', 2, 'Associe o phrasal verb ao significado.', [['give up', 'desistir'], ['look for', 'procurar'], ['find out', 'descobrir'], ['turn down', 'recusar']], 'Phrasal verbs têm sentido próprio; memorize-os em frases.'),
        err('ingles.u3.c07', 'perfect', 3, 'Toque na palavra errada.', ['He', 'has', 'went', 'home', 'already.'], 2, 'gone', 'O present perfect usa particípio: has gone (went é o passado simples).'),
        listen('ingles.u3.c08', 'phrasal', 3, 'Ouça e escolha o sentido.', 'I finally gave up smoking last month.', ['Parei de fumar no mês passado', 'Comecei a fumar no mês passado', 'Fumei muito no mês passado', 'Vou parar de fumar no próximo mês'], 0, '"gave up" = desisti/parei de.', { translation: 'Finalmente parei de fumar no mês passado.' }),
        listen('ingles.u3.c09', 'cond', 3, 'Ouça e responda: a pessoa vai à praia?', 'If it rains tomorrow, we will not go to the beach.', ['Depende da chuva', 'Sim, com certeza', 'Não, nunca', 'Já foi'], 0, 'First conditional: o resultado depende da condição.', { translation: 'Se chover amanhã, não iremos à praia.' }),
        short('ingles.u3.c10', 'phrasal', 3, 'Escreva o phrasal verb que significa "descobrir" (ex.: ___ the truth).', ['find out', 'found out', 'finds out'], 'find out = descobrir uma informação.'),
        tf('ingles.u3.c11', 'perfect', 2, '"I have known her since ten years" está correto.', false, 'Duração usa for: I have known her for ten years.'),
        mcq('ingles.u3.c12', 'perfect', 3, 'Leia: "Tom has just finished the report." O que sabemos?', ['Ele terminou há pouco', 'Ele vai terminar', 'Ele terminou há anos', 'Ele nunca termina'], 0, 'just + present perfect = ação acabada de acontecer.'),
        multi('ingles.u3.boss', 'cond', 5, 'Chefe final B1: e-mail de trabalho.', [
          step.mcq('ingles.u3.boss.s1', '"I ___ the files to you this morning." (enviar, manhã já terminou)', ['sent', 'have sent', 'send', 'am sending'], 0, 'Tempo terminado e definido → simple past.'),
          step.mcq('ingles.u3.boss.s2', '"___ you received them yet?"', ['Did', 'Have', 'Do', 'Are'], 1, 'yet em perguntas → present perfect: Have you received...?'),
          step.mcq('ingles.u3.boss.s3', '"If you ___ any problems, let me know."', ['have', 'had', 'would have', 'will had'], 0, 'Condição real → presente na oração com if.'),
        ], 'Escolha o tempo verbal pelo marcador de tempo e pela intenção.', { boss: true }),
      ],
    },
  ],
}

export default content
