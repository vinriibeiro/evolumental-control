# Banco de questões de TI — briefing para o Claude (sessões na nuvem)

Este diretório serve para **escrever questões** que depois entram no aplicativo (Biblioteca → Banco de questões). Cada sessão recebe **um tema e uma faixa de ids** (por exemplo, "Python, py-0001 a py-0500") e entrega arquivos `.jsonl` em `banco-questoes/entregas/`. **Não altere nada fora de `banco-questoes/entregas/`** (nem o código do app).

Público: uma pessoa migrando de Analista para **Cientista de Dados**, que treina para concursos e entrevistas técnicas. Só TI voltada a dados; **não há questões de inglês**.

Prioridades, em ordem: **(1) gabarito correto**, (2) nenhuma ambiguidade, (3) cobertura dos subtemas, (4) variedade real. Uma questão com gabarito errado é pior do que nenhuma: se não tiver certeza, troque a questão.

## 1. Regras de conteúdo
1. **Originais.** Não copie nem parafraseie de perto questões de provas, sites de questões ou livros. Não cite banca, órgão, empresa, ano nem edital.
2. **Uma única alternativa correta**, defensável sem discussão. Se o comportamento muda entre versões (ex.: Pandas), diga a versão no enunciado ou escolha outro ponto.
3. **Todo código e toda saída precisam estar corretos, e você tem um terminal: EXECUTE.** SQL com `sqlite3` (módulo `sqlite3` do Python) ou `duckdb`; Python/Pandas/NumPy/scikit-learn/SciPy/statsmodels direto (instale com `pip` se faltar); shell/Linux/Git no próprio terminal (em diretório temporário); Docker/Spark/Power BI/DAX/serviços de nuvem não rodam aí: nesses temas, use só comportamentos que você conhece com certeza. Rode os testes em arquivos temporários **fora** de `banco-questoes/` (por exemplo, `/tmp`) e não os versione. Dentro do enunciado, código em bloco Markdown (três crases).
4. **Alternativas plausíveis**, de tamanho parecido, sem pegadinha de grafia. "Todas as anteriores" / "nenhuma das anteriores" em **no máximo 2%**. A alternativa certa **não** pode ser sempre a mais longa nem a do meio.
5. **Cada questão testa um ponto diferente.** Varie contexto, dados, tabelas, variáveis e cenários.
6. **Variedade de redação (importante).** Não abra os enunciados sempre do mesmo jeito: nenhuma abertura pode se repetir em mais de 5% das questões da sua faixa (nada de "Em uma rotina de …, considere …" em série). Alterne perguntas diretas, trechos de código, tabelas pequenas, cenários de trabalho, afirmações para julgar, "o que acontece se…", "qual é o erro…", "qual escolha é mais adequada e por quê".
7. **Explicação obrigatória**: por que a certa está certa **e** por que cada uma das outras está errada (em certo/errado, o motivo exato do acerto ou do erro). Mínimo de duas frases.
8. Português do Brasil; termos consagrados podem ficar em inglês (JOIN, overfitting, commit).
9. Sem conteúdo ofensivo, sem dados pessoais reais, sem links.

## 2. Formato (JSON Lines: um objeto JSON por linha)
```json
{"id":"sql-0001","tema":"SQL","subtema":"Agregação e GROUP BY","nivel":"basico","tipo":"multipla_escolha","estilo":"concurso","enunciado":"...","alternativas":["...","...","...","...","..."],"gabarito":"C","explicacao":"...","tags":["group-by","having"]}
```
Há exemplos completos e válidos em `banco-questoes/exemplos.jsonl` (**não entram no banco**).

| Campo | Regra |
|---|---|
| `id` | `<prefixo>-NNNN` (4 dígitos), único; use **somente os ids da sua faixa**, em sequência, sem pular nem repetir. |
| `tema` | Exatamente o nome da tabela do item 3. |
| `subtema` | Um dos subtemas da tabela, sempre com a mesma grafia. |
| `nivel` | `basico`, `intermediario`, `avancado` ou `extremo`. |
| `tipo` | `multipla_escolha` (4 ou 5 alternativas) ou `certo_errado` (uma afirmação para julgar). |
| `estilo` | `concurso` ou `entrevista`. |
| `enunciado` | 20 a 1.500 caracteres. Em `certo_errado` é a afirmação a julgar. |
| `alternativas` | Só em `multipla_escolha`: 4 ou 5 textos, **sem** letra na frente. Em `certo_errado`, **omita** o campo. |
| `gabarito` | `multipla_escolha`: `A` a `E` (dentro do nº de alternativas). `certo_errado`: `C` ou `E`. |
| `explicacao` | 40 a 1.500 caracteres. |
| `tags` | 1 a 5 palavras curtas, minúsculas, com hífen. |

Use `\n` para quebra de linha nas strings e escape as aspas (`\"`). Sem vírgula no fim da linha e sem texto fora dos objetos.

**Níveis:**
- `basico`: definição, sintaxe simples, conceito direto.
- `intermediario`: aplicação em cenário, leitura de código curto, comparação de abordagens.
- `avancado`: casos de borda, otimização, armadilhas conhecidas, decisões de projeto, código mais longo.
- `extremo`: o mais difícil: internals e comportamento sutil, otimização em escala, trade-offs de arquitetura, raciocínio de várias etapas, código longo com armadilha escondida; nível de entrevista sênior/staff. Ainda precisa ter **uma única resposta defensável**.

**Estilos:**
- `concurso`: linguagem formal; em certo/errado, afirmações de banca ("é correto afirmar que…"); em múltipla escolha, "Assinale a alternativa correta/incorreta".
- `entrevista`: cenário prático: "o que este código imprime?", "qual abordagem você escolheria e por quê?", diagnóstico de problema real.

## 3. Temas, prefixos e subtemas (alvo total de 20.000 no banco)
| Tema (campo `tema`) | Prefixo | Alvo | Subtemas |
|---|---|---:|---|
| SQL | `sql` | 2500 | Consultas básicas; Filtros e operadores; JOINs; Agregação e GROUP BY; Subconsultas e CTE; Funções de janela; DDL e DML; Índices e desempenho; Transações e ACID; Funções de texto, data e NULL |
| Python | `py` | 2500 | Sintaxe e tipos; Estruturas de dados; Funções; Orientação a objetos; Erros e exceções; Compreensões e iteradores; Módulos e ambientes; Arquivos e dados; Boas práticas e testes |
| Pandas e NumPy | `pd` | 1500 | Series e DataFrame; Seleção e filtros; Limpeza de dados; Agrupamento; Junções e concatenação; Datas; Arrays NumPy; Desempenho |
| Estatística | `est` | 2000 | Estatística descritiva; Probabilidade; Distribuições; Amostragem; Intervalos de confiança; Testes de hipótese; Correlação e regressão; Teste A/B |
| Machine Learning | `ml` | 2500 | Conceitos básicos; Regressão; Classificação; Árvores e ensembles; Clusterização; Avaliação e métricas; Overfitting e validação; Engenharia de atributos; Redes neurais; MLOps e MLflow |
| Git e GitHub | `git` | 700 | Fundamentos; Branches e merge; Rebase e histórico; Remotos e pull request; Resolução de conflitos; Boas práticas |
| Modelagem de Dados e Bancos de Dados | `bd` | 1500 | Modelo relacional; Normalização; Modelo dimensional (DW); Chaves e integridade; NoSQL; Arquitetura de dados |
| BI e Visualização | `bi` | 1200 | Conceitos de BI; Dashboards e boas práticas; Power BI e DAX; Medidas e indicadores; Storytelling com dados; Streamlit e apps de dados |
| Engenharia de Dados | `ed` | 1200 | ETL e ELT; Pipelines e orquestração; Spark e processamento distribuído; Formatos (Parquet, CSV, JSON); Data lake e lakehouse; Qualidade de dados |
| Algoritmos e Estruturas de Dados | `alg` | 900 | Complexidade; Listas, pilhas e filas; Árvores e grafos; Ordenação e busca; Recursão |
| Lógica de Programação | `log` | 500 | Lógica proposicional; Raciocínio lógico; Fluxo e laços; Pseudocódigo |
| Redes de Computadores | `rede` | 700 | Modelo OSI e TCP/IP; Endereçamento IP; Protocolos de aplicação; Segurança de redes |
| Sistemas Operacionais e Linux | `so` | 600 | Processos e memória; Comandos Linux; Permissões; Shell script |
| Segurança da Informação | `seg` | 600 | Criptografia; Autenticação e autorização; Ameaças e vulnerabilidades; LGPD |
| Engenharia de Software | `es` | 600 | Princípios SOLID; Padrões de projeto; Testes; Metodologias ágeis; APIs |
| Cloud e DevOps | `cloud` | 500 | Conceitos de nuvem; Contêineres e Docker; CI/CD; Infraestrutura como código |

## 4. Distribuição dentro de CADA lote de 50 (aproximada)
- **Nível:** 12 `basico`, 18 `intermediario`, 12 `avancado`, 8 `extremo`.
- **Tipo:** 35 `multipla_escolha`, 15 `certo_errado`.
- **Estilo:** 30 `concurso`, 20 `entrevista`.
- **Gabarito:** letras bem distribuídas (em ME com 5 alternativas, cada letra ≈ 20%; em certo/errado ≈ 50% `C` e 50% `E`).
- **Subtemas:** cada lote cobre **vários subtemas** em rodízio; ao fim da sua faixa, todos os subtemas do tema precisam ter quantidade parecida.
- Em SQL, Python, Pandas e Machine Learning, **pelo menos 25%** das questões com código, tabela ou saída no enunciado.

## 5. Protocolo de trabalho
1. Leia este arquivo e `exemplos.jsonl`. Confirme sua faixa de ids (vem no prompt da sessão).
2. Trabalhe em **lotes de 50 questões**. O arquivo do lote é `banco-questoes/entregas/<prefixo>-NNN.jsonl`, em que `NNN` = número do lote (ex.: ids `py-0001` a `py-0050` → `py-001.jsonl`; `py-0501` a `py-0550` → `py-011.jsonl`).
3. Para **cada lote**:
   - escreva as 50 questões;
   - **verificação independente:** resolva cada questão de novo, sem olhar o gabarito, executando o código quando o tema permitir (item 1.3) e comparando com o gabarito escrito; onde a teoria não é executável, confira o comportamento pela documentação oficial ou por conhecimento consolidado; **troque** qualquer questão em que restar dúvida;
   - rode `node banco-questoes/validar-questoes.mjs banco-questoes/entregas` e corrija até aparecer `RESULTADO: APROVADO` (ignore as linhas "Por tema (feito / alvo)", que contam o banco inteiro; **leia os avisos** de enunciado muito parecido e de distribuição, e corrija o que for seu);
   - faça `git add banco-questoes/entregas` e um commit com a mensagem `questões <prefixo>-NNN (<primeiro-id> a <último-id>)`.
4. **Envie (push) a cada 3 lotes** e no final, para não perder trabalho.
5. **Não repita** ideias de lotes anteriores (os seus e os que já estiverem na pasta). Se perceber que está repetindo, mude de enfoque, subtema ou nível de abstração.
6. Ao terminar a faixa: confirme que o validador está APROVADO para a pasta inteira, faça o push final e escreva um resumo curto: quantidade de questões, ids de início e fim, quantas tiveram código executado/verificado, e quantas você trocou por dúvida.
7. Se algo impedir o trabalho (ferramenta indisponível, id fora da faixa, conflito de arquivo), **pare e relate**; não invente nem apague arquivos de outras faixas.
