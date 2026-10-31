# Banco de questões

Aba **Biblioteca → Banco de questões**. Questões técnicas de TI (múltipla escolha e certo/errado, estilo concurso e entrevista), com gabarito comentado.

## Como usar
- A barra de filtros fica em cima, com menus suspensos: **tema**, **subtemas** (múltipla escolha; nenhum marcado = todos), **nível**, **tipo**, **estilo**, **situação** (todas, não respondidas, que errei, favoritas), **quantidade** (10 a 100, ou todas) e **palavra-chave**. Clique em **Trazer questões**: a barra se recolhe num resumo e a questão ocupa a tela. O botão **Filtros** reabre a barra; mexer nela não muda a lista até você trazer de novo.
- A tela mostra **uma questão por vez**. Clique numa alternativa: o app corrige na hora e mostra a explicação. Depois, **Próxima** (ou a seta → do teclado) passa para a seguinte; **Pular** avança sem responder e **Anterior** volta. A questão fica travada depois de respondida; use **Embaralhar** ou mude os filtros para recomeçar a lista.
- No celular os filtros ficam escondidos atrás do botão **Filtros**, para a questão ocupar a tela.
- A estrela marca como **favorita**.
- **Salvar em Desempenho** grava o resumo da sessão (total, certas e erradas) na aba Desempenho, em "Questões e desempenho", com a origem "Banco de questões". Isso sincroniza com a conta.
- O **progresso por questão** (tentativas, última resposta, favoritas) fica salvo **neste aparelho** (localStorage, uma chave por conta). Em outro aparelho o progresso começa do zero.

## De onde vêm as questões
Os arquivos ficam em `public/questoes/` (um índice e um arquivo por subtema), carregados só quando o tema é aberto e guardados no cache do aparelho para uso sem internet.

Para atualizar o banco (um consolidado por pasta de fontes; os JSON já publicados de um tema cuja fonte não está no repositório, como o SQL, entram direto como entrada):

```
node banco-questoes/validar-questoes.mjs banco-questoes/cgu --saida /tmp/cgu.json
node banco-questoes/validar-questoes.mjs banco-questoes/entregas --saida /tmp/ti.json
node scripts/gerar-banco-questoes.mjs /tmp/cgu.json /tmp/ti.json public/questoes/sql/*.json --saida public/questoes
```

O validador confere formato, ids, gabarito, alternativas repetidas, duplicatas e, nos temas da CGU, se o subtema é um item do edital. Depois de regerar, aumente o `VERSION` em `public/sw.js` para o cache do navegador buscar os arquivos novos.

## Banco CGU 2026 (AFFC – TI – Ciência de Dados)
Temas com o prefixo **"CGU P1/P2/P3 ·"** seguem o programa oficial do Edital nº 1 – CGU – AFFC/2026 (Cebraspe), com um tema por disciplina e um subtema por item numerado do edital (`banco-questoes/cgu/programa-cgu-2026.md`). Só há questões certo/errado, como na prova. Duas origens, distinguíveis pela tag:
- **`oficial`**: itens de provas anteriores do Cebraspe/Cespe (2009–2025) com gabarito definitivo, transcritos de cadernos públicos e classificados por palavras-chave (`banco-questoes/cgu/importar-oficiais.mjs`, regras em `regras-classificacao.json`). A explicação traz o concurso, o item, o caderno e o link do gabarito; o comentário pedagógico ainda não foi escrito e o nível é sempre "intermediário" (não há informação de dificuldade). Como a classificação é automática, uma parte pequena pode estar na disciplina errada ou depender de um texto que não veio junto: use a estrela/favoritos para marcar e reportar.
- **sem tag `oficial`**: questões autorais escritas pelo Claude seguindo `banco-questoes/cgu/LEIA-ME-CGU.md`, com explicação completa e código executado quando há código.

## Estado atual
- 2.000 questões de **SQL** (10 subtemas, 200 por subtema), geradas com os resultados verificados pela execução real das consultas.
- 100 questões de **Machine Learning** (piloto do banco de TI, branch `banco-questoes-claude`, pasta `banco-questoes/`).
- **CGU 2026**: 4.450 questões (17 oficiais que dependiam de figura, gráfico ou texto de apoio ausentes foram retiradas por `banco-questoes/cgu/limpar-oficiais.mjs`, que também junta as quebras de linha do PDF; lista em `oficiais-removidas.json`). Antes eram 4.467 questões certo/errado nas 13 disciplinas do edital (3.167 oficiais + 1.300 autorais). O alvo é 20.000; as faixas das sessões que faltam estão em `banco-questoes/cgu/PROMPTS-CGU.md`.
- Os demais temas de TI (Python, Pandas, Estatística etc.) entram quando as entregas chegarem: basta rodar os comandos acima com todas as pastas.
