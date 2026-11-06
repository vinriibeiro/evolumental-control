# Cursos e materiais (Google Drive)

Aba **Biblioteca → Cursos** (`/cursos`): catálogo de cursos montado a partir de pastas do Google Drive, com módulos, aulas, visualizador dentro da plataforma, progresso e "Continuar estudando".

## O que fica onde

| Onde | O quê |
|---|---|
| **Google Drive** | Os arquivos (vídeos, PDFs, documentos…). Continuam lá, com as permissões de sempre. |
| **App (local ou Supabase)** | Só referências: IDs do Drive, nomes, tipos (MIME), tamanho, hierarquia, ordem, nome personalizado, ocultação, vínculo com matéria/tópico e o progresso (concluído, último acesso). |

A visualização padrão carrega o arquivo diretamente no visualizador incorporado do Google. Para PDFs, **Ler e marcar PDF** abre o leitor próprio após autorização de leitura: os bytes são carregados pela API do Drive somente na memória da aba; as marcações ficam separadas no navegador. Não há cópia persistente do arquivo do curso, proxy, upload ou alteração do original no Drive. Veja [Leitor PDF](LEITOR-PDF.md) para configuração, exportação e limites.

- **Modo local:** catálogo e progresso ficam no IndexedDB **deste navegador**.
- **Supabase:** tabelas `course_sources`, `course_nodes` e `course_progress`, com RLS por usuário; sincronizam entre aparelhos da mesma conta.
- Ver os arquivos exige internet e permissão no Drive.

## Três autorizações diferentes

1. **Importar metadados** — o importador pede, por um clique, um token do Google com o escopo `drive.metadata.readonly` (nomes, tipos e pastas; sem conteúdo, sem escrita). Fluxo de token do Google Identity Services no navegador: **sem client secret e sem refresh token**. O token dura ~1 hora e fica só na memória da aba (não vai para banco, `localStorage`, logs ou Git). Sair da conta revoga o token.
2. **Ver o arquivo** — o iframe do Google usa a **sessão Google do próprio navegador**. O token do importador não autentica o iframe, e o login no VLM Control não dá acesso ao Drive. Se o arquivo for restrito, a pessoa precisa estar logada no Google com uma conta que tenha acesso.
3. **Catálogo e progresso** — protegidos pelo login do app (Supabase + RLS) ou pelo navegador (modo local).

O app nunca torna arquivos públicos nem altera permissões do Drive.

### Por que não há backend

O app é uma SPA estática. Para ler metadados basta um token de curta duração obtido no navegador; um backend só seria necessário para guardar refresh tokens/segredos e sincronizar sozinho — o que aqui não é preciso (a atualização é manual, pelo botão **Atualizar do Drive**).

## Configuração mínima (uma vez)

### 1. ID do cliente OAuth do Google

1. [Google Cloud Console](https://console.cloud.google.com/) → crie (ou escolha) um projeto.
2. **APIs e serviços → Biblioteca** → ative a **Google Drive API**.
3. **Tela de consentimento OAuth** → tipo *Externo*, status *Em teste* → em **Usuários de teste**, adicione o seu e-mail Google. Escopo: `.../auth/drive.metadata.readonly`.
4. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**. Em **Origens JavaScript autorizadas**, inclua `http://localhost:5173` e a URL de produção (ex.: `https://seu-app.vercel.app`). Em **URIs de redirecionamento autorizados**, inclua a mesma origem seguida de `/cursos` (ex.: `https://seu-app.vercel.app/cursos` e `http://localhost:5173/cursos`): é o que permite o botão **Conectar nesta aba**, usado quando o navegador deixa a janela do Google em branco (bloqueio de cookies de terceiros, proteção contra rastreamento ou extensões).
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`). Ele é público por natureza; **não** use nem copie o *client secret*.
6. Use de uma das formas: variável `VITE_GOOGLE_CLIENT_ID` — já definida em `.env.production` (público, versionado) ou nas variáveis da Vercel — **ou** cole na própria tela, em **Pastas do Drive** (fica salvo só naquele navegador). Origens autorizadas hoje: `https://evolumental-control.vercel.app`, `https://evolumental-control-4eep.vercel.app` e `http://localhost:5173`; um domínio novo precisa ser adicionado no Google Cloud.

Enquanto o app estiver "Em teste", só os usuários de teste conseguem autorizar, e o Google mostra um aviso de app não verificado — esperado para uso pessoal.

Dois jeitos de conectar, ambos com o token só na memória da aba (`src/lib/googleAuth.ts`): **Conectar com o Google** abre a janela do Google (GIS); **Conectar nesta aba** leva a própria aba ao Google e volta para `/cursos` com o token no fragmento da URL, que é lido uma vez, conferido pelo `state` guardado em `sessionStorage` e apagado da URL. Use o segundo se a janela aparecer em branco com a mensagem "Janela do Google fechada antes de autorizar".

### 2. Supabase (se usar a nuvem)

SQL Editor → cole e execute `supabase/migrations/20261103000000_courses_drive.sql`. Sem ela, a aba Cursos mostra "Falta ativar Cursos no banco"; o resto do app segue normal (inclusive a exportação).

## Importar e atualizar

1. **Pastas do Drive → Conectar com o Google** → cole o link da pasta → **Ler pasta e ver prévia**.
2. A prévia mostra cursos, módulos, aulas por tipo, itens sem visualizador, pastas vazias, falhas de leitura e o que muda em relação ao catálogo salvo. Ajuste:
   - **Cada subpasta é um curso** (padrão) ou **A pasta inteira é um curso** (subpastas viram módulos);
   - pastas do primeiro nível incluídas/excluídas.
3. **Importar**. Depois, na sala do curso, **Organizar** permite renomear, ocultar, subir/descer e vincular a matéria/tópico.

Regras da reimportação (`src/lib/courseImport.ts`):

- Itens são reconhecidos pelo **ID do Drive** na pasta em que estão: renomear no Drive só atualiza o nome; mover de pasta mantém o mesmo item (e o progresso).
- Nome personalizado, ocultação, vínculos e ordem/pasta definidas à mão são preservados.
- Sumiu de uma pasta lida **por completo** → "não encontrado" (removido ou sem acesso), sem apagar; volta a "disponível" se reaparecer.
- Pasta que falhou ou leitura truncada → nada abaixo dela é marcado como removido (fica "não verificado"). Falha na pasta raiz → o catálogo não é alterado.
- Pastas excluídas no mapeamento ficam guardadas como "excluídas" (com as personalizações) e voltam se forem incluídas de novo.
- Paginação completa, novas tentativas com espera para limites da API (429/403 de cota, 5xx), até 20.000 itens e 30 níveis por pasta.
- Atalhos viram referência ao alvo; pasta já incluída por outro caminho (ou ciclo) não é repetida. O mesmo arquivo em dois lugares vira duas referências ao mesmo ID, e o progresso é compartilhado (é por arquivo).
- Ordem natural (Aula 2 antes de Aula 10).

Remover uma pasta tira o catálogo dela do app (nada muda no Drive); o progresso fica e volta se a pasta for cadastrada de novo. "Zerar dados" zera o progresso dos cursos e mantém o catálogo.

## Visualização

O visualizador é escolhido pelo **MIME real** informado pelo Drive:

| Tipo | Visualização |
|---|---|
| PDF, vídeo, áudio, imagem, Word, PowerPoint, Excel, texto, CSV | `drive.google.com/file/d/<id>/preview` |
| Documentos, Planilhas e Apresentações Google | `docs.google.com/.../<id>/preview` |
| Outros (ZIP, HTML, JSON, Markdown, formulários…) | Sem visualizador: item no catálogo com **Abrir no Drive** |

Os endereços são montados pelo app a partir de IDs validados, só para `drive.google.com` e `docs.google.com` (nunca HTML/embed colado pelo usuário). O iframe usa `sandbox` (scripts, popups e apresentação) e `referrerpolicy="strict-origin-when-cross-origin"`.

**Limites honestos:** o iframe é de outro domínio, então o app não sabe se o conteúdo abriu, quanto foi assistido ou lido. A conclusão é **manual** (Concluir / Desmarcar conclusão); a retomada é da **última aula aberta**, não do segundo exato do vídeo nem da página do PDF. "O material não abriu?" lista as causas comuns (sem permissão, vídeo em processamento, cookies de terceiros bloqueados, arquivo removido) e "Abrir no Drive" fica sempre disponível.

A sala reaproveita o temporizador de foco (sessão ativa única e confirmação no Cronômetro), modo cinema e tela cheia da sala de vídeos. Com matéria/tópico vinculado (no item, módulo ou curso), o estudo é registrado nela.

## Sala do curso (player)

- **Aula como unidade:** uma pasta só com arquivos e no máximo um vídeo vira **uma aula**. O vídeo (ou, sem vídeo, o primeiro documento) é o conteúdo principal; os demais arquivos aparecem em **Materiais da aula** e nas abas acima do player. Pastas com vários vídeos viram uma aula por vídeo. O progresso conta aulas (conclusão do conteúdo principal).
- **Palco:** abas Videoaula/materiais, **material ao lado do vídeo** (tela dividida, no computador), recarregar e "Abrir no Drive".
- **Ações:** Anterior, Concluir/Desmarcar conclusão e **Concluir e avançar**; aviso ao concluir um módulo e o curso. No celular, barra fixa com Anterior / Concluir / Próxima.
- **Conteúdo do curso:** módulos com progresso e duração (dos vídeos, informada pelo Drive), check clicável em cada aula, busca, "Só pendentes", rolagem até a aula atual e Organizar (renomear, ocultar, reordenar, vincular).
- **Modo foco** (esconde o menu do app) e **tela cheia** (a sala inteira, com o player ocupando a altura), com cronômetro opcional (pode ser ocultado).
- **Atalhos:** N próxima, P anterior, C concluir, M modo foco, F tela cheia, S conteúdo, Esc sai do modo foco — com o foco na página (se o player do Google estiver selecionado, as teclas vão para ele).
- O player do Google não informa ao app quando o vídeo termina, então não há avanço automático no fim do vídeo nem retomada no minuto exato; velocidade, legenda e tela cheia do vídeo ficam nos controles do próprio player.

## Testes

- `src/lib/__tests__/courses.test.ts`: links/IDs/domínios, tipos, ordem natural, leitura com paginação, novas tentativas, falhas parciais, atalhos e ciclos, limite; plano e reimportação (sem duplicar, renomear, mover, ordem e pasta manuais, removidos e restaurados, leitura parcial, exclusão no mapeamento, mesmo arquivo em dois lugares); progresso e retomada; cliente HTTP só de metadados.
- `src/services/__tests__/courses.test.ts`: importação real no backend local, reimportação preservando progresso, falha fatal e parcial, prévia sem gravar, remoção da fonte, "zerar dados" e exclusão de matéria vinculada.
- `src/pages/courses/__tests__/Courses.test.tsx`: catálogo, busca, visualizador, concluir/desmarcar, anterior/próximo, persistência após recarregar, formato sem visualizador, item não encontrado e organização.
- `supabase/tests/rls.test.ts`: isolamento entre usuários (leitura, alteração, exclusão, FKs compostas), unicidade, validação de IDs, cascata e reset.
- `npm run test:e2e:cursos` (servidor Vite em modo local): fluxo completo no navegador com a **API do Google simulada** — conectar, validar link, prévia, importar com paginação, aula, concluir, recarregar, reimportar sem duplicar, cinema, tela cheia, formato sem visualizador, celular e regressão de Vídeos/Biblioteca/Cronômetro.

Os testes automatizados não acessam o Drive real. A incorporação foi validada à parte, com arquivos reais (PDF, MP4, DOCX e PPTX) num navegador sem login Google, porque as pastas testadas estavam compartilhadas por link; com pastas restritas, o visualizador depende do login Google no navegador.
