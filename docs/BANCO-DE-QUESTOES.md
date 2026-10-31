# Banco de questões

Aba **Biblioteca → Banco de questões**. Questões técnicas de TI (múltipla escolha e certo/errado, estilo concurso e entrevista), com gabarito comentado.

## Como usar
- Escolha o **tema**, marque **subtemas** (nenhum marcado = todos) e filtre por **nível** (básico, intermediário, avançado, extremo), **tipo**, **estilo**, **situação** (todas, não respondidas, que errei, favoritas) e **busca** no enunciado.
- Clique numa alternativa: o app corrige na hora e mostra a explicação. A questão fica travada depois de respondida; use **Embaralhar** ou mude os filtros para recomeçar a lista.
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
- Os demais temas (Python, Pandas, Estatística, Machine Learning etc.) entram quando as entregas chegarem: basta rodar os comandos acima com todas as pastas.
