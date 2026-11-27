# VLM Knowledge — Meus Cadernos

Documentação técnica, arquitetura e plano incremental de implementação do módulo **Meus Cadernos** (identidade interna: **VLM Knowledge**) no **VLM Control 2.0**.

## 1. Visão Geral e Princípios

O módulo **Meus Cadernos** transforma o VLM Control 2.0 em uma central determinística de gestão de conhecimento pessoal (PKM) integrada ao ecossistema de estudos:

- **100% autoral e determinístico**: nenhum uso de IA externa para gerar resumos, conteúdos ou flashcards.
- **Reaproveitamento integral**: usa `subjects`, `topics`, `flashcard_decks`, `flashcards`, `flashcard_reviews` (+ RPC `record_flashcard_review` e motor SM-2), `study_sessions` (+ cronômetro único), `reviews`, `course_nodes`, `library_books`, `library_pdfs` e `study_materials`.
- **Paridade total entre modos**: todas as operações passam por `DataProvider` e `DataBackend`, com comportamento equivalente em `SupabaseBackend` (PostgreSQL 15+ com RLS) e `LocalBackend` (IndexedDB via Dexie v4).
- **Separação de metadados e conteúdo**: a árvore de navegação (`notebook_nodes`) carrega apenas metadados leves; o corpo estruturado (`notebook_page_contents`) é carregado sob demanda ao abrir uma página.
- **Preservação histórica**: exclusão envia para a lixeira (`deleted_at`); excluir permanentemente uma página nunca destrói flashcards, histórico de revisões SM-2 ou sessões de estudo; `reset_my_data()` preserva todo o conteúdo escrito pelo usuário.

---

## 2. Arquitetura e Modelo Relacional

Migração aditiva: `supabase/migrations/20261127000000_vlm_knowledge.sql`.

| Tabela | Finalidade | Isolamento e Integridade |
|---|---|---|
| `notebooks` | Cadernos (título, descrição, ícone, cor, capa, favorito, arquivamento, lixeira, vínculo opcional com matéria) | RLS + `FORCE RLS`, `unique (id, user_id)`, FK composta para `subjects` (`ON DELETE SET NULL`). |
| `notebook_nodes` | Hierarquia unificada (`section` e `page`) em profundidade ilimitada | FK composta `(notebook_id, user_id)` e `(parent_id, user_id)` + trigger de prevenção de ciclos e validação de mesmo `notebook_id`; RPC atômica `move_notebook_node`. |
| `notebook_page_contents` | Corpo JSON versionado (`content_json`, `content_schema_version`), texto extraído (`content_text`), contagem de palavras e `revision` otimista | 1:1 com `notebook_nodes` via `unique (user_id, node_id)`, índice GIN FTS (`to_tsvector('portuguese', content_text)`). |
| `notebook_page_versions` | Snapshots de histórico de versões (`snapshot`, `manual`, `restore`, `conflict_backup`, `import`) | FK composta `(node_id, user_id) ON DELETE CASCADE`. |
| `notebook_tags` | Tags globais de conhecimento (nome único case-insensitive por usuário, cor da paleta) | Índice único `(user_id, lower(btrim(name)))`. |
| `notebook_tag_links` | Associação N:N entre tags e cadernos ou páginas/seções | Check exclusivo `(node_id is not null) <> (notebook_id is not null)`, FKs compostas em cascata. |
| `notebook_page_links` | Links internos entre páginas/blocos (`[[...]]`) e backlinks | FKs compostas em cascata, check impedindo auto-link sem bloco alvo. |
| `notebook_flashcard_links` | Vínculo entre flashcards existentes e página/bloco de origem | `flashcard_id` em cascata; `notebook_id` e `node_id` com `ON DELETE SET NULL` (excluir página preserva o flashcard e o histórico SM-2). |
| `notebook_templates` | Templates personalizados de páginas | JSON estruturado versionado, sem conteúdo fictício. |
| `notebook_resource_links` | Referências a matérias adicionais, tópicos, cursos, PDFs, EPUBs, projetos e links externos | Suporta metadados de localização (`page`, `cfi`, `timestamp`) em `location jsonb`. |
| `notebook_attachments` | Metadados de anexos privados do editor (imagens e arquivos) | Bucket privado `cadernos` (20 MiB), prefixo `<user_id>/...`, validação de MIME type e tamanho. |

### Regras de Exclusão e Reset

- **Lixeira (exclusão lógica)**: definir `deleted_at` em um caderno ou nó (propagando para a subárvore de nós filhos com o mesmo carimbo ou preservando distinção de itens já excluídos).
- **Restauração**: limpa `deleted_at`; se o nó pai estiver excluído ou ausente, promove o nó restaurado com segurança para a raiz do caderno.
- **Exclusão permanente**:
  - Caderno -> remove nós, conteúdos, versões, vínculos de tags/links/recursos/anexos em cascata; flashcards vinculados mantêm-se intactos (`notebook_id = NULL`, `node_id = NULL`).
  - Página/Seção -> remove subárvore e conteúdos em cascata; flashcards vinculados mantêm-se intactos (`node_id = NULL`).
- **`reset_my_data()`**: preserva integralmente cadernos, páginas, versões, tags, templates e vínculos.
- **`delete_my_account()`**: remove tudo em cascata a partir de `auth.users(id) ON DELETE CASCADE`.

---

## 3. Formato do Conteúdo (JSON Estruturado e Versionado)

O conteúdo da página é persistido em `notebook_page_contents.content_json` com `content_schema_version = 1`, adotando estrutura compatível com ProseMirror/Tiptap (`{ type: 'doc', content: [...] }`):

- Cada bloco relevante recebe `attrs.blockId` (UUID estável) para links internos por bloco, referências de flashcards e navegação direta.
- `content_text` é derivado deterministicamente do JSON ao salvar, alimentando busca local (normalizada sem acentos) e PostgreSQL Full Text Search (índice GIN em português).
- `revision` (inteiro monotônico) fornece controle otimista contra sobrescrita silenciosa entre abas/dispositivos.

---

## 4. Rotas e Navegação

Área de primeiro nível **Meus Cadernos** (`src/app/nav.ts`):

- `/cadernos` — Página inicial (visão geral, métricas, favoritos, recentes, arquivados, grade/lista, busca)
- `/cadernos/favoritos` — Cadernos e páginas favoritos
- `/cadernos/recentes` — Páginas editadas e estudadas recentemente
- `/cadernos/conexoes` — Central de conexões, backlinks e (Fase 4) grafo interativo
- `/cadernos/lixeira` — Itens excluídos logicamente com restauração e exclusão permanente
- `/cadernos/:notebookId` — Workspace do caderno (navegação hierárquica + editor + painel de contexto)
- `/cadernos/:notebookId/pagina/:pageId` — Página específica aberta no workspace

---

## 5. Decisões Técnicas e Funcionamento Offline

- **Modo local (IndexedDB/Dexie v4)**: 100% funcional offline; upgrade aditivo da v3 para v4 sem perda de dados existentes.
- **Modo Supabase**: consultas paginadas/filtradas via `DataBackend`, cache seletivo via TanStack Query e sincronização entre abas via `BroadcastChannel`. **Limitação explícita**: ainda não há fila global de sincronização offline bidirecional com o Supabase; na Fase 2, o editor acrescentará rascunho local de recuperação em caso de queda de rede ou fechamento inesperado, sem sobrescrever revisões mais recentes no servidor.
- **Dependências**:
  - Fase 1: nenhuma dependência nova (reaproveita React 19, dnd-kit, Dexie, Zod, TanStack Query, Lucide, PGlite).
  - Fase 2: Tiptap 3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` e extensões oficiais de tabela, listas de tarefas, links, imagens, cores, destaque, alinhamento, sub/sobrescrito e `code-block-lowlight`) + `lowlight` / `highlight.js` em chunk assíncrono separado (`editor-cadernos`), carregado sob demanda apenas ao abrir uma página.
  - Fase 5: `katex` (chunk lazy `math-katex`, `trust: false`) e `mermaid` (chunk lazy `diagrams-mermaid`, `securityLevel: 'strict'`), reaproveitando `jszip` e `pdf-lib` já presentes no repositório.
- **Backup global e anexos binários**: `SettingsPage` e `importData.ts` exportam e importam todas as tabelas estruturadas de **Meus Cadernos** (`notebooks`, `notebook_nodes`, `notebook_page_contents` com remapeamento de links internos, `notebook_tags`, `notebook_tag_links`, `notebook_page_links`, `notebook_flashcard_links`, `notebook_templates`). Imagens embutidas no JSON das páginas são preservadas integralmente; anexos binários armazenados separadamente no bucket privado `cadernos` do Supabase não são embutidos no JSON global (mantendo o arquivo leve e compatível com o limite de 50 MB).

---

## 6. Checklist Versionado de Implementação

### Fase 1 — Fundação
- [x] Análise da arquitetura e documentação técnica (`docs/CADERNOS.md`)
- [x] Modelagem relacional e migração SQL aditiva (`20261127000000_vlm_knowledge.sql`)
- [x] RLS, `FORCE RLS`, FKs compostas, bucket privado `cadernos` e proteção de hierarquia/ciclos
- [x] Tipos TypeScript, metadados de schema (`RELATIONS`, `DEFAULTS`, `UNIQUE_RULES`), Dexie v4 e `DataBackend` (`moveNotebookNode`)
- [x] Domínio hierárquico, serviços e hooks TanStack Query
- [x] Navegação principal **Meus Cadernos**, rotas lazy-loaded e integração na busca global (`Ctrl+K`)
- [x] Página inicial dos cadernos (métricas reais, grade/lista, filtros, arquivados, busca, criação rápida)
- [x] Workspace 3 áreas (desktop) + drawer (mobile): CRUD completo, árvore ilimitada, drag-and-drop, mover entre seções/cadernos, duplicar página/subárvore, fixar, favoritar, arquivar, lixeira e restauração
- [x] Editor base funcional com salvamento automático, controle de revisão otimista (`revision`) e contagem de palavras/tempo de leitura
- [x] Testes unitários, integração (`LocalBackend` + Dexie) e PostgreSQL/RLS (`PGlite`)

### Fase 2 — Editor de Conhecimento
- [x] Editor em blocos rico (Tiptap 3 / ProseMirror, lazy-loaded em chunk dedicado) com slash menu `/`, bubble menu, toolbar contextual e mover/duplicar blocos
- [x] Formatação completa (H1–H6, negrito, itálico, sublinhado, tachado, super/subscrito, cor, destaque, alinhamento, listas aninhadas, checklists, citações, divisores, links sanitizados e importação de Markdown)
- [x] Blocos especiais (callouts semânticos: informação, atenção, definição, exemplo, resumo, erro comum, exercício; Q&A expansível; conteúdo recolhível; glossário; tabelas editáveis; imagens por arquivo/colagem/URL segura)
- [x] Blocos de código técnicos (16 linguagens: SQL, PostgreSQL, T-SQL, Python, R, DAX, Power Query M, JS, TS, HTML, CSS, JSON, YAML, Bash, PowerShell e texto simples; numeração de linhas, copiar, quebra de linha, título/descrição, visualização expandida e execução manual segura no sandbox isolado Python/SQLite)
- [x] Templates de páginas (8 modelos nativos + criação/duplicação/exclusão de templates personalizados)
- [x] Rascunho local de recuperação, histórico de versões com política de snapshots/retenção (5 min / máx. 30), restauração segura e resolução de conflito de edição (recarregar, sobrescrever ou salvar como cópia)
- [x] Modos leitura, edição, foco (`Escape` para sair), tela cheia, busca dentro da página e sumário automático clicável

### Fase 3 — Integração de Estudos
- [x] Criação de flashcards a partir de seleção de texto, bloco, página ou seção (menu flutuante + `Ctrl+Shift+F`, reutilizando `flashcard_decks`, `flashcards`, `record_flashcard_review` e SM-2)
- [x] Botão "Ver anotação de origem" na revisão de flashcards (com navegação direta ao bloco `?bloco=`) e atualização manual confirmada (editar anotação nunca altera cartões silenciosamente)
- [x] Seção "Cadernos e anotações relacionadas" nas páginas de matérias e tópicos (sem duplicar dados e sem marcar conclusão/domínio automaticamente)
- [x] Botão "Estudar este conteúdo" reutilizando `useStartStudy` (cronômetro único minimizado no topo) e "Agendar revisão" integrado a `/revisoes`
- [x] Integração com Sala de Cursos (painel dividido com largura ajustável e escolha explícita do caderno do usuário) e leitor de PDF (envio de trecho selecionado com referência de página)

### Fase 4 — Gestão de Conhecimento
- [x] Sistema completo de tags personalizadas (criar, editar, cores da paleta, filtros em páginas e flashcards)
- [x] Autocomplete de links internos `[[`, links por bloco, backlinks, referências cruzadas e páginas relacionadas
- [x] Busca avançada por texto, código, tags, matérias, tópicos e links com trechos destacados (FTS PostgreSQL + índice local)
- [x] Grafo de conhecimento interativo (lazy-loaded, zoom, pan, filtros por caderno/matéria/tag)

### Fase 5 — Recursos Premium
- [x] Revisão ativa de anotações (blocos Q&A ocultáveis em lote, dificuldade 1–5, sinalizador `needs_review`, progresso de checklists e pontos de atenção)
- [x] Cloze Deletion (`{{c1::trecho}}`) e Oclusão de Imagem em flashcards (100% compatíveis com a tabela `flashcards` e motor SM-2 existentes)
- [x] Fórmulas LaTeX/KaTeX (`trust: false`) e diagramas Mermaid seguros (`securityLevel: 'strict'`), ambos lazy-loaded em chunks dedicados
- [x] Exportação (Markdown, JSON estruturado, HTML sanitizado, PDF A4 profissional, ZIP) e importação (Markdown, JSON VLM, ZIP Notion/Obsidian com prévia)
- [x] Integração completa ao backup/restauração global (`SettingsPage` e `importData.ts`)

### Fase 6 — Validação
- [x] Cobertura E2E Playwright (`e2e/notebooks.mjs` — 16 fluxos em desktop 1366×860 e mobile 390×844, 0 erros de console/página, 0 overflow horizontal)
- [x] Auditoria de segurança, acessibilidade (teclado/ARIA/contraste), performance com alto volume (`notebooksPerfSecurity.test.ts`) e documentação final

---

## 7. Resumo da Validação Final

- **Qualidade estática**: `tsc --noEmit` (0 erros) e `eslint .` (0 erros, 0 avisos).
- **Testes automatizados (Vitest + PGlite)**: cobertura unitária, integração (`LocalBackend` / Dexie v4), RLS/PostgreSQL (`supabase/tests/rls.test.ts`) e auditoria de segurança/performance em alto volume (`notebooksPerfSecurity.test.ts`).
- **Testes ponta a ponta (Playwright)**: `npm run test:e2e:cadernos` (ou `node e2e/notebooks.mjs --serve <distDir>`) valida os 16 fluxos completos em desktop e mobile.
- **Princípio autoral**: nenhum caderno, seção, página ou flashcard é criado automaticamente; todo conteúdo pertence e é escrito manualmente pelo usuário.
