# VLM Control

Planejamento pessoal para organizar cursos, leituras, sessões de estudo e anotações em um só lugar.

![Logo](public/brand/logo-full.svg)

| Área | O que você faz |
|---|---|
| **Meu Planejamento** | Cria tarefas e matérias do zero, organiza a agenda por dia, semana ou mês, monta ciclos e agenda revisões. |
| **Meus Cursos** | Importa cursos do Drive, reúne partes numeradas em pastas e abre aulas, PDFs e HTMLs dentro do app. [Guia de cursos](docs/CURSOS.md) |
| **Meus Livros** | Lê EPUBs, ajusta fonte e tema, e retoma da última posição. [Guia da estante](docs/BIBLIOTECA.md) |
| **Meus Cadernos** | Cria páginas no caderno e seção escolhidos, retoma a edição e organiza anotações com tags, links, versões e revisões. [Guia de cadernos](docs/CADERNOS.md) |
| **Sala de Estudos** | Registra tempo líquido com cronômetro, temporizador ou Pomodoro. Acompanha sessões, metas, evolução e relatório semanal. |

## Pré-requisitos

- **Node.js 22.13+** (testado com 24.22.1 LTS) e npm. O leitor PDF utiliza PDF.js 6.
- Opcional, para nuvem: um projeto no [Supabase](https://supabase.com) (plano gratuito serve) ou a [Supabase CLI](https://supabase.com/docs/guides/cli).
- Opcional, para os testes E2E: Microsoft Edge ou Google Chrome instalados.

> **Importante (Windows + Google Drive):** mantenha o projeto em um disco local (ex.: `C:\Users\<você>\Projetos\...`). Pastas sincronizadas pelo Google Drive (`G:\Meu Drive`) não suportam bem o `node_modules` (erros `EBADF` e instalação muito lenta).

## Instalação e execução local

```bash
npm install
npm run dev          # http://localhost:5173
```

Sem variáveis de ambiente, o app abre em **modo local** (veja abaixo). Para produção:

```bash
npm run build        # verifica tipos e gera dist/
npm run preview      # serve o build localmente
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto (Project Settings → API → Project URL). |
| `VITE_SUPABASE_ANON_KEY` | Chave pública **anon** (Project Settings → API). |
| `VITE_GOOGLE_CLIENT_ID` | Opcional (Cursos do Drive): ID **público** do cliente OAuth, escopo só de leitura de metadados. Nunca coloque client secret ou chaves de serviço. Veja `docs/CURSOS.md`. |

Nunca use a chave `service_role` em variáveis `VITE_*`: tudo que começa com `VITE_` vai para o navegador. A segurança dos dados vem das políticas RLS do banco, não do sigilo da chave anon.

## Modo local × Supabase

| | Modo local | Supabase |
|---|---|---|
| Quando | `VITE_SUPABASE_*` ausentes | variáveis configuradas |
| Onde ficam os dados | IndexedDB **deste navegador** | PostgreSQL do seu projeto |
| Login | não há (perfil local único) | e-mail e senha reais, recuperação por e-mail |
| Sincronização entre dispositivos | **não** | sim |
| Uso indicado | desenvolvimento, testes, uso pessoal em um só navegador | uso real, multiusuário |

O modo local é explícito: uma faixa no topo de todas as telas avisa que não há sincronização. Ele reproduz as regras do banco (padrões, restrições únicas, cascatas e a revisão atômica de flashcards) para que o comportamento seja o mesmo nos dois modos. Limpar os dados do navegador apaga os dados do modo local — exporte antes em Configurações → Seus dados.

## Configurar o backend (Supabase)

1. Crie um projeto no Supabase.
2. Aplique a migração (próxima seção).
3. Em **Authentication → Providers**, mantenha **Email** habilitado. Em produção, mantenha "Confirm email" ativo.
4. Em **Authentication → URL Configuration**:
   - *Site URL*: a URL onde o app será servido (ex.: `http://localhost:5173` no desenvolvimento).
   - *Redirect URLs*: inclua `http://localhost:5173/redefinir-senha` e a URL equivalente de produção (usada na recuperação de senha).
5. Preencha `.env.local` com a URL e a chave anon e reinicie `npm run dev`.

**Primeiro usuário:** crie a conta pela tela **Criar conta** do próprio app (não existem credenciais de demonstração). Para testes, é possível criar um usuário em *Authentication → Users → Add user* com uma senha forte gerada na hora; não versione essas credenciais.

## Aplicar as migrações

Aplique os arquivos de `supabase/migrations/` em ordem de nome, começando por `20261021000000_init.sql`.

- **Pelo painel:** abra *SQL Editor*, execute cada arquivo na ordem indicada.
- **Pela CLI:**
  ```bash
  supabase link --project-ref <ref-do-projeto>
  supabase db push
  ```

A migração cria tabelas, chaves estrangeiras compostas, índices, gatilhos, a view `study_session_net`, a função `record_flashcard_review` e todas as políticas RLS. A documentação do esquema está em [`docs/ESQUEMA.md`](docs/ESQUEMA.md).

## Testes e verificações

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # Vitest: regras de negócio + migração/RLS em PostgreSQL embutido
npm run check        # tudo acima + build de produção
```

Testes de ponta a ponta no navegador (modo local; requer `npm run dev` em outro terminal):

```bash
npm run test:e2e     # fluxos reais + todas as páginas em desktop e celular
npm run screenshots  # capturas de estados com dados de exemplo
npm run test:e2e:videos # sala de estudos: timer, tela cheia, cinema, recarga e celular
npm run test:e2e:cursos # importação simulada, pastas, leitor HTML, PDF e celular
npm run test:e2e:cadernos # editor, organização, revisões e exportação
```

### Estudar com vídeos

Em **Meus Cursos → Vídeos**, informe a duração e clique em **Iniciar foco**. O temporizador vincula novas sessões à matéria e ao tópico da aula. Ao finalizar, use **Revisar e salvar sessão** para registrar o tempo no histórico.

O aviso antecipado ocorre no último minuto, ou nos últimos 20% para blocos com menos de cinco minutos. O aviso final tem um som diferente. Pausas manuais congelam a contagem; Pomodoro e intervalos já iniciados também aparecem na sala. O botão de som respeita a preferência do perfil. Os avisos não pausam o vídeo nem encerram o estudo automaticamente.

**Modo cinema** remove a navegação para ampliar a aula; Escape restaura a visualização. **Tela cheia** expande a sala inteira, incluindo timer e conteúdo; ocultar o conteúdo dá mais espaço ao vídeo. As duas opções preservam o iframe e a reprodução atual. Se o navegador bloquear a Fullscreen API, o modo cinema é usado como alternativa.

Os alertas exigem a página aberta e JavaScript em execução: suspensão do aparelho ou do navegador pode atrasá-los até a retomada. O som depende da liberação de áudio pelo navegador após uma interação (Iniciar foco, pausar/retomar ou ativar som). O relógio é reconstruído por timestamps, inclusive após recarregar. A reprodução dos vídeos depende do YouTube e da autorização do canal para incorporação. O teste E2E usa perfil isolado em modo local e o servidor Vite, com dados sintéticos; não comprova áudio audível nem reprodução do YouTube.

## Arquitetura

```
src/
  app/              App, rotas, autenticação, provedor de dados, layout (barra lateral, cabeçalho, pesquisa, notificações)
  components/       UI reutilizável (ui/), gráficos (charts/), marca (brand/), seletores e helpers
  features/timer/   sessão ativa, ações do cronômetro, alertas globais, lista de sessões
  hooks/            dados (TanStack Query), configurações, estatísticas, voz, utilitários
  lib/
    data/           camada de dados: interface comum, backend Supabase, backend local (Dexie), metadados do esquema
    timer/          motor do cronômetro (timestamps) e som
    cycle.ts srs.ts planner.ts goals.ts stats.ts time.ts tree.ts validation.ts
  content/          catálogo de cursos em vídeo
  pages/            uma pasta por módulo
  services/         operações compostas de sessões, cursos, revisões e cadernos
  types/db.ts       tipos do modelo de dados
supabase/
  migrations/       SQL versionado
  tests/            testes da migração e RLS
e2e/                testes de navegador (Playwright + Edge/Chrome do sistema)
```

Stack: React 19, TypeScript 6, Vite 8, Tailwind CSS 4, TanStack Query 5, Supabase JS 2, Dexie 4 (IndexedDB), Recharts 3, dnd-kit, Zod 4, Lucide, Vitest 5, PGlite.

Desempenho: consultas filtradas no banco e paginadas ("Carregar mais"), cache com invalidação apenas das tabelas afetadas (inclusive cascatas), sincronização entre abas via `BroadcastChannel`, páginas carregadas sob demanda e bibliotecas pesadas (gráficos, leitor de EPUB) em pacotes separados. O cronômetro re-renderiza a tela mas **não grava nada a cada segundo**: só há escrita ao iniciar, pausar, continuar, trocar de fase e finalizar.

## Regras de negócio importantes

- **Tempo líquido** = ⌊(fim − início) − pausas⌋ + ajuste explícito. Nada disso é armazenado como total; é sempre derivado das sessões e pausas (`netSeconds` no app e a view `study_session_net` no banco usam a mesma regra). Sessões canceladas e em andamento não entram nos indicadores.
- **Sessão ativa única por usuário** (índice único parcial). Inserções usam IDs gerados no cliente e atualizações são condicionais ao status, então cliques repetidos e outras abas não duplicam registros.
- **Ao finalizar**, o horário de término é congelado e a sessão fica "aguardando confirmação" (sobrevive a recarregar). O usuário revisa matéria, tópico, atividade, observação e um ajuste manual em minutos (registrado na sessão).
- **Cancelar** descarta a sessão (não conta) ou, por escolha explícita, salva o tempo aproveitado.
- **Ciclo**: avança apenas quando um bloco é concluído por sessões vinculadas; execução parcial pergunta se mantém a posição (retomar) ou avança; dias sem estudo não alteram a posição.
- **Cronograma automático**: regras determinísticas listadas na própria tela (sem IA). A proposta só substitui blocos *pendentes* a partir de hoje — concluídos, parciais e não realizados ficam como histórico.
  - empates: maior peso e, depois, ordem alfabética do pilar.
- **Revisões**: só são marcadas como feitas por ação explícita (botão ou caixa marcada no resumo da sessão).
- **Repetição espaçada**: SM-2 com quatro respostas; parâmetros ajustáveis em Configurações; cada resposta é gravada junto com o novo agendamento em uma transação idempotente.
- **Exclusões**: organização/planejamento em cascata; históricos de sessões e cartões apenas perdem o vínculo e continuam nos relatórios. A confirmação mostra quantos registros serão excluídos ou desvinculados, e matérias podem ser arquivadas em vez de excluídas.
- **Sem limites artificiais**: não há teto de matérias, tópicos ou cartões no código; a capacidade depende da infraestrutura.

## Segurança

- Autenticação do Supabase (senhas nunca passam pelo código do app nem são armazenadas por ele).
- RLS habilitado e forçado em todas as tabelas: `user_id = auth.uid()` em leitura, inserção, alteração e exclusão; `anon` sem acesso.
- Chaves estrangeiras compostas `(id, user_id)` impedem vincular registros a linhas de outro usuário, mesmo conhecendo o UUID.
- Validação em dois níveis: Zod nos formulários e `CHECK`/`NOT NULL`/FKs no banco (ex.: faixas de prioridade, formatos de cor/horário, tamanho máximo de textos).
- O texto dos flashcards nunca é enviado a serviços de voz externos (Web Speech API local).
- Cabeçalhos de segurança de exemplo em `vercel.json`.

## Backup e recuperação

- **Pelo usuário:** Configurações → Seus dados → *Exportar todos os dados* gera um JSON com todas as tabelas (sessões incluem as pausas). Relatórios exportam CSV/JSON por período.
- **Supabase (administrador):** os planos pagos fazem backups diários automáticos (e PITR opcional). Em qualquer plano, um dump lógico pode ser feito com:
  ```bash
  supabase db dump --data-only -f backup-dados.sql     # dados
  supabase db dump -f backup-esquema.sql               # esquema
  ```
  Para recuperar em um projeto novo: aplique a migração, depois `psql "<connection-string>" -f backup-dados.sql`.
- **Modo local:** os dados vivem só no navegador; faça exportações periódicas.

## Aplicativo no celular (PWA)

O VLM Control pode ser instalado pelo navegador, sem loja de aplicativos (`public/manifest.webmanifest`, ícones em `public/icons/`, service worker em `public/sw.js`):

- **Android (Chrome/Edge):** menu ⋮ → *Instalar app*.
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Computador (Chrome/Edge):** ícone de instalar na barra de endereço.

O botão **Instalar aplicativo** aparece no login, no menu do perfil e em Configurações. O service worker só é registrado no build de produção, busca as páginas sempre na rede (cópia local apenas como reserva offline) e nunca intercepta chamadas ao Supabase. Para regerar os ícones a partir da logo: `node scripts/gerar-icones.mjs`.

## Deploy

É um app estático (SPA). Qualquer hospedagem estática serve, desde que todas as rotas caiam no `index.html`:

- Vercel: `vercel.json` já inclui o rewrite e cabeçalhos.
- Netlify/Cloudflare Pages: `public/_redirects` já está incluído.

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de build da hospedagem e adicione a URL de produção em *Redirect URLs* no Supabase.

## Limitações conhecidas e próximos passos

Limitações atuais (honestas):

- O fluxo com **Supabase real** (login, RLS via PostgREST, RPC) foi verificado por tipos e pelos testes da migração em PostgreSQL embutido, mas não contra um projeto Supabase hospedado neste ambiente, por falta de credenciais. Ao conectar, faça um teste rápido: cadastro, login, criar matéria, cronômetro, revisão de flashcard.
- O **modo local** não tem login nem sincronização; dados dependem do navegador.
- Sessões são pareadas entre abas pelo banco (uma sessão ativa por usuário) e pelo `BroadcastChannel`; não há atualização em tempo real entre *dispositivos* diferentes sem recarregar (o app recarrega ao focar a janela).
- Painéis com séries históricas longas (dashboard e metas) baixam as sessões do intervalo e agregam no navegador. Para contas com muitos anos de dados, o próximo passo é usar agregações no banco (a view `study_session_net` já existe para isso).
- A exclusão da conta no Supabase deve ser feita pelo administrador (Authentication → Users); os dados são removidos em cascata.
