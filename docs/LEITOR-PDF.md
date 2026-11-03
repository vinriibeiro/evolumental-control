# Leitor PDF com marcações

## Onde abrir

- **Cursos:** abra uma aula ou anexo PDF e clique em **Ler e marcar PDF**. O visualizador padrão continua disponível.
- **Biblioteca → Seus PDFs:** use **Adicionar PDF** para arquivos do computador, até 100 MiB por arquivo.

O leitor oferece texto selecionável, quatro cores de destaque, desenho livre por mouse/caneta/toque, notas editáveis, marcadores de página, busca por texto, zoom, modo foco, desfazer alterações recentes e retomada da página.

## PDFs dos cursos no Drive

O original continua no Drive. Os bytes são solicitados pela API oficial, apenas para a memória da aba, sem upload, proxy, tabela de arquivos ou cache persistente da aplicação. O download respeita a permissão `capabilities.canDownload` do proprietário.

O catálogo continua usando `drive.metadata.readonly`. O leitor solicita separadamente `drive.readonly`, com consentimento explícito por botão. Esse escopo concede leitura dos arquivos da conta Google; não permite edição ou exclusão. O token temporário fica somente em memória. Login Supabase e autorização Google são independentes.

Use o mesmo ID público OAuth dos cursos (`VITE_GOOGLE_CLIENT_ID` ou configurado na interface). No Google Cloud, habilite a API Drive e declare também `https://www.googleapis.com/auth/drive.readonly` na tela de consentimento. Cadastre a origem da aplicação, inclusive a porta da prévia local. Contas em modo de teste precisam constar como usuários de teste. Aplicações distribuídas podem depender da verificação do Google para esse escopo restrito. Nenhum client secret deve ir para o frontend.

As referências e marcas são armazenadas no navegador, isoladas por conta da plataforma. Um hash do conteúdo separa as versões: se o PDF mudar no Drive, as marcas antigas não são aplicadas em posições incorretas na nova versão. Reabrir uma versão anterior recupera as marcas daquela versão. Os arquivos e permissões no Drive não são alterados.

## PDFs importados do computador

O arquivo original é copiado para o IndexedDB deste navegador, em um espaço separado por conta. O conteúdo é deduplicado por SHA256; adicionar o mesmo arquivo preserva as marcas. PDFs e marcas não sincronizam com Supabase ou outros aparelhos.

## Salvar e exportar

As alterações são salvas automaticamente; o estado de gravação aparece no cabeçalho. Falhas de armazenamento são informadas e permitem tentar novamente. **Exportar PDF** gera uma cópia: destaques e desenhos são incorporados às páginas e notas viram comentários nativos. O original permanece intacto.

Exporte antes de remover um PDF ou limpar os dados do navegador. O backup global de tabelas em Configurações ainda não inclui os arquivos e as marcações deste leitor. A exportação de cada PDF é a forma de guardar uma cópia das marcas.

## Limites

- A seleção e a busca exigem texto no documento. PDFs digitalizados continuam aceitando desenho e notas; não há OCR automático.
- PDFs protegidos podem ser lidos com senha, sem guardá-la. A exportação com pdf-lib exige um arquivo sem criptografia; uma mensagem explica a limitação quando necessário.
- O leitor do Drive precisa de internet, autorização válida e permissão no arquivo. Se a autorização expirar, use **Autorizar novamente**.
- A conclusão da aula continua manual e independente de abrir, marcar ou percorrer páginas.
- O leitor renderiza uma página por vez e limita o tamanho do canvas para controlar o uso de memória.

## Validação

Testes unitários cobrem armazenamento, isolamento, deduplicação, erros, exportação, coordenadas/rotação, transferência do Drive apenas em memória, permissões e consentimento. A inspeção no navegador usa um PDF sintético; testes com mocks do Google não comprovam acesso aos arquivos reais de uma conta.

Referências: [PDF.js](https://mozilla.github.io/pdf.js/examples/), [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfpage), [conteúdo de arquivos do Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads), [escopos OAuth do Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
