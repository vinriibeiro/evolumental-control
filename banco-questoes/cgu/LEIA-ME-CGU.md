# Banco de questões CGU 2026 — AFFC, especialidade TI – Ciência de Dados (certo/errado, estilo Cebraspe)

Este diretório reúne **questões certo/errado** para o concurso da CGU 2026 (banca Cebraspe, prova em 13/12/2026), organizadas pelas **13 disciplinas do edital** (4 do bloco P1, 5 do P2 e 4 do P3 – Ciência de Dados) e, dentro de cada uma, pelos **itens numerados do edital** (campo `subtema`). O programa oficial está em `programa-cgu-2026.md` / `programa-cgu-2026.json` (temas, prefixos, alvos e subtemas: use **exatamente** essas grafias).

Duas fontes entram no mesmo banco:

| Pasta | Origem | Ids | Observação |
|---|---|---|---|
| `oficiais/` | Itens oficiais do Cebraspe/Cespe (2009–2025), gabarito definitivo, transcritos de cadernos públicos e classificados por disciplina | `<prefixo>-0001` em diante | Gerados por `importar-oficiais.mjs`; **não edite à mão**. Têm a tag `oficial` e a fonte na explicação. |
| `entregas/` | Questões **autorais** escritas pelo Claude em sessões na nuvem | `<prefixo>-5001` em diante | Uma faixa de ids por sessão (veja `PROMPTS-CGU.md`). |

As regras gerais de `../LEIA-ME.md` continuam valendo (gabarito correto acima de tudo, originalidade, execução de código, formato JSON Lines, validador). O que muda para a CGU está abaixo.

## 1. Formato das questões autorais
- **Somente `tipo: "certo_errado"`** e `estilo: "concurso"`. O validador rejeita múltipla escolha nos temas CGU.
- `tema`: um dos 13 nomes da tabela do programa (ex.: `CGU P3 · Estatística, programação e análise de dados`). `subtema`: um item do edital daquele tema, com o número (ex.: `2 Probabilidade e inferência`).
- `enunciado`: **uma afirmação para julgar**, como o Cebraspe escreve: frase declarativa, formal, 1 a 4 linhas, sem "julgue o item" e sem pergunta. Quando precisar de cenário, comece com "Em determinado órgão federal, …" / "Considere que …" / "Suponha que …" e termine com "Nessa situação, …". Código ou tabela em bloco de três crases é bem-vindo nos temas de estatística, programação, SQL e ML (pelo menos 25% das questões desses temas).
- `gabarito`: `C` ou `E`, **metade de cada** em cada lote de 50 (23 a 27 de cada).
- `explicacao`: 2 a 6 frases dizendo exatamente **o que torna o item certo ou errado** e, quando o item for errado, **qual seria a versão correta**. Em temas jurídicos, cite a norma e o artigo só quando tiver certeza; senão, explique pelo conceito.
- `nivel`: `basico` (definição direta), `intermediario` (aplicação/cenário), `avancado` (sutileza, exceção, código mais longo), `extremo` (várias etapas, armadilha escondida). Por lote de 50: ~12 / 18 / 12 / 8.
- `tags`: 1 a 5, minúsculas com hífen. **Nunca** use a tag `oficial` (reservada à importação).

## 2. Como o Cebraspe erra um item (use isso para construir os itens ERRADOS)
1. Troca de conceitos vizinhos (viés × variância; precisão × sensibilidade; ETL × ELT; transparência ativa × passiva; avaliação × consultoria; PAD × PAR).
2. Generalização indevida: "sempre", "nunca", "qualquer", "necessariamente", "independentemente de", "é suficiente", "é vedado em qualquer hipótese".
3. Inversão de causa e efeito, de condição e consequência, ou de quem faz o quê (CGU × TCU; gestor × auditor; controlador × operador de dados).
4. Número, prazo, limite ou operador trocado (nível de significância, k do k-fold, cardinalidade, saída de código).
5. Afirmação verdadeira ligada a uma consequência falsa ("…, por isso, …", "…, o que dispensa…").
6. Exceção apresentada como regra ou regra apresentada sem a exceção que o edital destaca.

Itens CERTOS devem ser verdadeiros **sem ressalvas**; evite itens certos que dependem de "em geral" ou "normalmente" quando a banca poderia considerar o contrário. Não escreva itens cuja resposta dependa de opinião ou de doutrina divergente.

## 3. Conteúdo
- **Cole no edital.** Cada subtema do programa tem um texto; escreva itens que testem aquele texto (o edital de 2026 é novo e conceitual: capacidades estatais, corrupção como fenômeno, data mesh, LLMs, agentes, MLOps, contratação de soluções de IA). Use os termos do próprio edital.
- Rodízio de subtemas: ao fim da faixa, todos os subtemas do tema com quantidade parecida.
- Originalidade: não reaproveite os itens oficiais da pasta `oficiais/` nem itens de provas que você lembre; escreva o seu.
- Dados brasileiros e contexto da administração pública federal (órgãos, políticas públicas, Portal da Transparência, LAI, LGPD, Lei 14.133/2021, IN SFC, Decreto 9.203/2017, Lei 12.846/2013, Lei 12.813/2013, Lei 9.784/1999, Lei 13.460/2017, Lei 12.527/2011, Lei 13.709/2018) quando couber ao subtema.
- Nos temas P3, execute o código (Python 3, SQL em SQLite ou DuckDB, Pandas, NumPy, scikit-learn, SciPy, statsmodels) antes de afirmar uma saída ou um valor; instale com `pip` o que faltar e rode em `/tmp`, nunca dentro do repositório.

## 4. Protocolo (sessões autorais)
1. Leia este arquivo, `programa-cgu-2026.md` (só o seu tema) e `../exemplos.jsonl` (formato).
2. Lotes de 50. Arquivo do lote: `banco-questoes/cgu/entregas/<prefixo>-NNN.jsonl`, com `NNN = ceil(primeiro id / 50)` (ids 5001–5050 → `-101.jsonl`; 5051–5100 → `-102.jsonl`; 5101–5150 → `-103.jsonl`, …).
3. Por lote: escreva as 50; resolva todas de novo sem olhar o gabarito; troque as duvidosas; rode `node banco-questoes/validar-questoes.mjs banco-questoes/cgu/entregas` até `RESULTADO: APROVADO`; leia os avisos de enunciados parecidos e corrija os seus.
4. Commit por lote (`questões CGU <prefixo>-NNN (<primeiro-id> a <último-id>)`) e push a cada 3 lotes, **a menos que o prompt da sessão diga para não usar git** (sessões paralelas dentro de uma mesma máquina: nesse caso só grave os arquivos).
5. Não altere nada fora de `banco-questoes/cgu/entregas/`. Se algo impedir o trabalho, pare e relate.
