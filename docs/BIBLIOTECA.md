# Biblioteca (estante de EPUB e PDF)

**Biblioteca** (`/biblioteca`, `src/pages/library/LibraryPage.tsx`): uma estante única para livros em EPUB e PDF, com leitor dentro do app. O endereço antigo `/livros` leva para a mesma estante; os leitores ficam em `/livros/:id` (EPUB) e `/livros/pdf/:id` (PDF, ver `docs/LEITOR-PDF.md`).

## Estante

- **Grade ou lista** (a escolha fica guardada no navegador). Capa do EPUB ou miniatura da primeira página do PDF; sem imagem, uma capa tipográfica com título e autor.
- **Busca** por título ou autor, sem diferenciar maiúsculas nem acentos. **Assunto**: texto livre definido em *Editar detalhes* (junto de título e autor); assim que existe um assunto, aparece o filtro por assunto.
- **Situação**: Todos, Em andamento, Favoritos (estrela), Arquivados e Removidos.
- **Último livro acessado** em destaque, com o botão **Continuar**. O mesmo dado alimenta a tela inicial (`useLastRead()` em `src/pages/library/lastRead.ts`).
- **Progresso**: no EPUB é a posição no livro ("42% lido"). No PDF é o **progresso de navegação**: a parcela das páginas já abertas no leitor. É uma estimativa automática, não uma confirmação de leitura; ninguém precisa marcar página como lida.

## Antiduplicidade

Antes de adicionar, cada arquivo é comparado com tudo o que já está guardado (inclusive arquivados e removidos). A regra está em `findDuplicate` (`src/lib/library.ts`), nesta ordem:

1. **Mesmo conteúdo** (SHA-256 do arquivo, que também é o id do livro): é o mesmo livro, ainda que o nome do arquivo seja outro. Não duplica; se o livro estava arquivado ou removido, volta para a estante com a leitura de onde parou.
2. **Mesmo ISBN** (lido do EPUB; ISBN-10 e ISBN-13 equivalem), **mesmo identificador** do livro ou **mesmo título e autor** (ignorando acentos, caixa, pontuação e marcas como "(1)" e "- Cópia"): os arquivos são diferentes, então é só uma suspeita. O app pergunta "Parece que este livro já está na estante… Adicionar mesmo assim?" e respeita a resposta. Nada é removido sozinho.
3. Mesmo título com autores conhecidos e diferentes não é tratado como duplicata.

No modo Supabase vale o mesmo: a estante local é sincronizada antes da comparação e a chave primária `(user_id, id)` impede o mesmo conteúdo duas vezes na conta.

## Remover, arquivar e excluir

| Ação | O que faz | Reversível |
| --- | --- | --- |
| **Remover da estante** | Some da estante e vai para *Removidos*. Arquivo, posição, marcadores e anotações ficam guardados. | Sim (*Voltar para a estante*) |
| **Arquivar** | Some da estante e vai para *Arquivados*, com tudo guardado. | Sim |
| **Excluir permanentemente** | Apaga o arquivo guardado e os dados de leitura daquele livro (se sincronizado, da conta e de todos os aparelhos). Pede confirmação com o nome do livro. Os outros livros e o arquivo original no computador não são tocados. | Não |

## Leitor de EPUB (tela inteira)

- A página do livro ocupa a tela toda. As barras de cima e de baixo flutuam sobre o texto e somem sozinhas alguns segundos depois de abrir.
- **Toque:** laterais viram a página, o meio mostra ou esconde os controles. Deslizar para os lados também vira a página. No teclado: setas, PageUp/PageDown, Tab mostra os controles, Esc fecha.
- **Tela cheia de verdade**: no celular o leitor entra sozinho ao abrir o livro, quando o navegador permite (Android/Chrome). O iPhone não oferece esse recurso a páginas da web: lá, instale o app na tela de início.
- **Iniciar/Continuar estudo** (ícone de play no topo): liga o cronômetro do app com o livro como origem da sessão. Com a sessão em andamento, o mesmo botão leva à Sala de Estudos. Só existe uma sessão ativa por vez.
- **Marcadores e anotações**: um painel só. Anotações simples, do livro todo ou presas ao trecho aberto (clicar leva até ele); dá para editar e excluir.
- **Iluminação e aparência**: fundos Claro, Papel, Sépia, Cinza, Escuro e Noite; brilho; luz quente; tamanho, fonte, entrelinha, margens e texto justificado. As preferências ficam no navegador (`localStorage`, chave `evolumental.leitor`).

## Onde os dados ficam

- Os livros sempre ficam guardados no navegador do aparelho (IndexedDB `evolumental-library…`), para ler sem internet.
- **Modo Supabase**: cada EPUB também vai para um espaço **privado** da conta (bucket `livros` + tabela `library_books`, com RLS). Posição, marcadores, assunto, favorito, situação na estante e anotações sincronizam entre aparelhos; vale a alteração mais recente. Limite do plano gratuito: 50 MiB por arquivo (acima disso o livro fica só no aparelho).
- **PDFs importados na Biblioteca** de até 50 MiB sincronizam no mesmo bucket privado após a migração de PDFs. O arquivo baixa ao abrir. Detalhes, posição, páginas visitadas, marcadores e anotações acompanham a conta. Entre alterações simultâneas no mesmo PDF, vale a mais recente. PDFs maiores e as marcações dos PDFs de cursos do Drive ficam no navegador.
- **Modo local**: nada sai do navegador.

## Ativar no Supabase (uma vez por migração)

1. Projeto no Supabase → **SQL Editor** → **New query**.
2. Execute `supabase/migrations/20261031000000_library.sql` (cria `library_books` e o bucket privado `livros`).
3. Execute `supabase/migrations/20261121010000_v2_library.sql` (aditiva: colunas `subject`, `favorite`, `shelf_state`, `notes`, `isbn`, `identifier`; não altera nenhuma linha existente e traz o bloco de reversão comentado no fim).
4. Execute `supabase/migrations/20261124000000_library_pdfs.sql` para ativar a sincronização privada dos PDFs. Após publicar a versão do app com suporte, abra a Biblioteca no navegador em que os PDFs foram importados, com a mesma conta usada no celular. Os PDFs existentes são enviados automaticamente.

Sem a segunda migração o app continua funcionando: livros e posição de leitura sincronizam como antes, a estante mostra um aviso, e assunto, favoritos, arquivamento e anotações dos EPUBs ficam só no aparelho. Quando a migração é aplicada, esses dados sobem na sincronização seguinte.

## Observações

- Excluir a conta apaga as linhas de `library_books` e `library_pdfs`, mas os arquivos já enviados ao bucket `livros` precisam ser removidos pelo painel do Supabase (Storage).
- "Zerar meus dados" não mexe nos livros.
- Material protegido por direitos autorais: use só cópias suas, para uso pessoal.
