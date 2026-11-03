# Renovação do Evolumental / VLM Control

Entrega local de 03/11/2026, na branch `design/evolumental-professional`, a partir de `86d537d`. Projeto original preservado em `Documents/Projetos/evolumental-control-repo`. Nenhum commit, push, merge ou deploy foi realizado.

## Entregue

- Identidade em verde floresta e tons claros, navegação lateral, menu móvel com foco acessível, barra de navegação no celular, tema claro/escuro e componentes compartilhados refinados.
- Dashboard com saudação por fuso, próxima ação contextual, meta diária e atalhos. Cronômetro, cursos e biblioteca com hierarquia e estados mais claros.
- Leitor de PDF com destaque de texto, desenho, notas editáveis, marcadores, busca, zoom, retomada, modo foco e exportação. Funciona com importação local e por **Ler e marcar PDF** nos cursos e anexos do Drive.
- Arquivos dos cursos continuam no Drive; o leitor carrega conteúdo somente em memória. As marcas ficam no navegador, separadas por conta e versão do arquivo.
- 60 desafios de Python, SQL e Git em quatro níveis, com os cinco exemplos iniciais pedidos, dicas, solução comentada, editor de rascunho, autoavaliação e exportação de progresso.
- Proteções contra sobrescrita entre abas: marcas de PDF usam revisão otimista e desafios persistem alterações por item/propriedade.

## Verificação executada

`npm run check` terminou com sucesso: TypeScript, ESLint sem erros/avisos, **49 arquivos e 431 testes aprovados**, build de produção concluído. A concorrência do Vitest foi limitada a dois processos para evitar timeouts por pressão de recursos.

No navegador integrado foram verificados: importação de PDF sintético; destaque real de texto; criação de nota e marcador; persistência após recarregar; exportação do PDF; preservação de três páginas, rotação e nota acentuada na cópia exportada; rascunho e conclusão de desafio após recarregar; layouts desktop/celular sem rolagem lateral; alternância de tema. Nenhum erro de console foi registrado na aba de validação.

`git diff --check` passou. Capturas em `qa/painel-desktop.jpg`, `qa/leitor-pdf-desktop.jpg` e `qa/desafios-desktop.jpg`. Os scripts E2E existentes não foram executados nesta entrega; a validação de navegador foi feita pelos fluxos descritos acima.

## Limites e validação pendente

- **Google Drive real:** a autorização OAuth e o acesso aos arquivos da conta do usuário ainda precisam de validação. Os testes da API usam respostas simuladas e cobrem acesso negado, expiração, transferência, limites, isolamento e consentimento. Configuração em [LEITOR-PDF.md](LEITOR-PDF.md).
- Marcas de PDF e desafios são locais por conta/navegador; não sincronizam com Supabase. Exporte PDFs e progresso para backup. Não entram no backup global de tabelas.
- Desafios são um catálogo determinístico, com conclusão por autoavaliação. A plataforma não executa Python, SQL ou Git.
- Destaque e busca exigem texto no PDF; documentos digitalizados aceitam desenho e notas, sem OCR. Exportação de PDFs criptografados exige uma cópia sem criptografia.
- Node.js mínimo atualizado para 22.13, conforme PDF.js 6.

## Recomendação

**APROVAR para avaliação local.** Validar o acesso aos PDFs reais do Drive antes de autorizar publicação. Não foram identificados problemas críticos ou altos pendentes no escopo verificado; as limitações acima permanecem explícitas.
