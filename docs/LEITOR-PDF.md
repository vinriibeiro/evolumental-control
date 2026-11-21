# Leitor PDF com marcações

## Onde abrir

- **Cursos:** abra uma aula ou anexo PDF e clique em **Ler e marcar PDF**. O visualizador padrão continua disponível.
- **Biblioteca** (`/biblioteca`): use **Adicionar livros** para PDFs do computador, até 100 MiB por arquivo. Eles ficam na mesma estante dos EPUBs (ver `docs/BIBLIOTECA.md`) e abrem em `/livros/pdf/:id`.

## Recursos do leitor

- **Navegação:** página anterior/próxima, ir para uma página, setas do teclado. **Rolagem contínua** (padrão) ou uma página por vez; a escolha fica guardada no navegador.
- **Zoom:** aumentar, diminuir, **ajustar à largura** e **ajustar à página**. **Tela cheia** (onde o navegador permite; nos demais, o leitor ocupa a janela toda). Esc sai.
- **Busca no documento** pelo texto do PDF, sem diferenciar acentos, com contador e botões de trecho anterior/próximo.
- **Retomada automática:** a posição é salva sozinha e o PDF reabre na última página lida.
- **Progresso de navegação:** parcela das páginas já abertas (uma página conta depois de ficar aberta por um instante). É uma estimativa automática, não uma confirmação de leitura; não existe "marcar página como lida".
- **Iniciar/Continuar estudo:** liga o cronômetro do app com o PDF como origem da sessão; com a sessão em andamento, o botão vira o atalho para a Sala de Estudos.
- **Anotações:** painel com notas do documento ou de uma página (adicionar, editar, excluir, clicar para ir à página), além da lista de destaques, desenhos e páginas marcadas.
- **Marcações na página:** texto selecionável, quatro cores de destaque, desenho livre por mouse/caneta/toque, nota presa a um ponto, marcadores de página e desfazer.

## PDFs dos cursos no Drive

O original continua no Drive. Os bytes são solicitados pela API oficial, apenas para a memória da aba, sem upload, proxy, tabela de arquivos ou cache persistente da aplicação. O download respeita a permissão `capabilities.canDownload` do proprietário.

O catálogo continua usando `drive.metadata.readonly`. O leitor solicita separadamente `drive.readonly`, com consentimento explícito por botão. Esse escopo concede leitura dos arquivos da conta Google; não permite edição ou exclusão. O token temporário fica somente em memória. Login Supabase e autorização Google são independentes.

Use o mesmo ID público OAuth dos cursos (`VITE_GOOGLE_CLIENT_ID` ou configurado na interface). No Google Cloud, habilite a API Drive e declare também `https://www.googleapis.com/auth/drive.readonly` na tela de consentimento. Cadastre a origem da aplicação, inclusive a porta da prévia local. Contas em modo de teste precisam constar como usuários de teste. Aplicações distribuídas podem depender da verificação do Google para esse escopo restrito. Nenhum client secret deve ir para o frontend.

As referências e marcas são armazenadas no navegador, isoladas por conta da plataforma. Um hash do conteúdo separa as versões: se o PDF mudar no Drive, as marcas antigas não são aplicadas em posições incorretas na nova versão. Reabrir uma versão anterior recupera as marcas daquela versão. Os arquivos e permissões no Drive não são alterados.

## PDFs importados do computador

O arquivo original é copiado para o IndexedDB deste navegador, em um espaço separado por conta. O id do PDF é o SHA-256 do conteúdo: adicionar o mesmo arquivo, mesmo com outro nome, não duplica e preserva as marcas. Na importação o app lê a contagem de páginas e o autor e guarda uma miniatura da primeira página como capa (PDFs antigos ganham a capa na primeira vez que forem abertos). PDFs e marcas não sincronizam com Supabase ou outros aparelhos.

## Salvar e exportar

As alterações são salvas automaticamente; o estado de gravação aparece no cabeçalho. Falhas de armazenamento são informadas e permitem tentar novamente. **Exportar PDF** gera uma cópia: destaques e desenhos são incorporados às páginas e notas viram comentários nativos. O original permanece intacto.

Exporte antes de **excluir permanentemente** um PDF ou limpar os dados do navegador (remover da estante e arquivar não apagam nada). O backup global de tabelas em Configurações ainda não inclui os arquivos e as marcações deste leitor. A exportação de cada PDF é a forma de guardar uma cópia das marcas.

## Limites

- A seleção e a busca exigem texto no documento. PDFs digitalizados continuam aceitando desenho e notas; não há OCR automático.
- PDFs protegidos podem ser lidos com senha, sem guardá-la. A exportação com pdf-lib exige um arquivo sem criptografia; uma mensagem explica a limitação quando necessário.
- O leitor do Drive precisa de internet, autorização válida e permissão no arquivo. Se a autorização expirar, use **Autorizar novamente**.
- A conclusão da aula continua manual e independente de abrir, marcar ou percorrer páginas.
- Na rolagem contínua só as páginas próximas da área visível são desenhadas (as demais são espaços reservados), e o tamanho do canvas é limitado, para controlar o uso de memória.
- Nos PDFs dos cursos (Drive) o leitor é o mesmo, sem o atalho de estudo e sem registro de páginas visitadas.

## Validação

Testes unitários cobrem armazenamento, isolamento, deduplicação, erros, exportação, coordenadas/rotação, transferência do Drive apenas em memória, permissões e consentimento. A inspeção no navegador usa um PDF sintético; testes com mocks do Google não comprovam acesso aos arquivos reais de uma conta.

Referências: [PDF.js](https://mozilla.github.io/pdf.js/examples/), [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfpage), [conteúdo de arquivos do Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads), [escopos OAuth do Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
