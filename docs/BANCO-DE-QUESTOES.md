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

Para atualizar o banco:

```
node Estudos/Banco-Questoes/validar-questoes.mjs <pasta-com-os-.jsonl> --saida consolidado.json
node scripts/gerar-banco-questoes.mjs consolidado.json
```

O validador confere formato, ids, gabarito, alternativas repetidas e duplicatas. Depois de regerar, aumente o `VERSION` em `public/sw.js` para o cache do navegador buscar os arquivos novos.

## Estado atual
- 2.000 questões de **SQL** (10 subtemas, 200 por subtema), geradas com os resultados verificados pela execução real das consultas.
- 100 questões de **Machine Learning** (10 subtemas, 10 por subtema), do piloto das sessões do Claude na nuvem (branch `banco-questoes-claude`, pasta `banco-questoes/`, que guarda o briefing, o validador e os prompts das sessões).
- Os demais temas entram conforme as sessões entregarem: juntar os `.jsonl` de todas as entregas numa pasta e rodar os comandos acima.
