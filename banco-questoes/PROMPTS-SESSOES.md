# Prompts das sessões do Claude (banco de questões)

Cada linha da tabela é **uma sessão na nuvem** (Claude Code na web, repositório evolumental-control, **branch base `banco-questoes-claude`**). Cole o prompt da linha. As faixas não se sobrepõem: dá para rodar várias ao mesmo tempo.

**Comece pelo PILOTO (abaixo)**, veja quanto crédito ele gastou e só então dispare as demais.

## Piloto (100 questões)

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Machine Learning" (prefixo ml), ids de ml-0001 a ml-0100 (100 questões, 2 lotes de 50; o primeiro arquivo é ml-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

## Sessões (total 36, 17900 questões, fora as 100 do piloto, que já ocupam ml-0001 a ml-0100)

| # | Tema | Faixa | Qtd |
|---|---|---|---:|
| 1 | SQL | sql-2001 a sql-2500 | 500 |
| 2 | Python | py-0001 a py-0500 | 500 |
| 3 | Python | py-0501 a py-1000 | 500 |
| 4 | Python | py-1001 a py-1500 | 500 |
| 5 | Python | py-1501 a py-2000 | 500 |
| 6 | Python | py-2001 a py-2500 | 500 |
| 7 | Pandas e NumPy | pd-0001 a pd-0500 | 500 |
| 8 | Pandas e NumPy | pd-0501 a pd-1000 | 500 |
| 9 | Pandas e NumPy | pd-1001 a pd-1500 | 500 |
| 10 | Estatística | est-0001 a est-0500 | 500 |
| 11 | Estatística | est-0501 a est-1000 | 500 |
| 12 | Estatística | est-1001 a est-1500 | 500 |
| 13 | Estatística | est-1501 a est-2000 | 500 |
| 14 | Machine Learning | ml-0101 a ml-0600 | 500 |
| 15 | Machine Learning | ml-0601 a ml-1100 | 500 |
| 16 | Machine Learning | ml-1101 a ml-1600 | 500 |
| 17 | Machine Learning | ml-1601 a ml-2100 | 500 |
| 18 | Machine Learning | ml-2101 a ml-2500 | 400 |
| 19 | Git e GitHub | git-0001 a git-0350 | 350 |
| 20 | Git e GitHub | git-0351 a git-0700 | 350 |
| 21 | Modelagem de Dados e Bancos de Dados | bd-0001 a bd-0500 | 500 |
| 22 | Modelagem de Dados e Bancos de Dados | bd-0501 a bd-1000 | 500 |
| 23 | Modelagem de Dados e Bancos de Dados | bd-1001 a bd-1500 | 500 |
| 24 | BI e Visualização | bi-0001 a bi-0600 | 600 |
| 25 | BI e Visualização | bi-0601 a bi-1200 | 600 |
| 26 | Engenharia de Dados | ed-0001 a ed-0600 | 600 |
| 27 | Engenharia de Dados | ed-0601 a ed-1200 | 600 |
| 28 | Algoritmos e Estruturas de Dados | alg-0001 a alg-0450 | 450 |
| 29 | Algoritmos e Estruturas de Dados | alg-0451 a alg-0900 | 450 |
| 30 | Lógica de Programação | log-0001 a log-0500 | 500 |
| 31 | Redes de Computadores | rede-0001 a rede-0350 | 350 |
| 32 | Redes de Computadores | rede-0351 a rede-0700 | 350 |
| 33 | Sistemas Operacionais e Linux | so-0001 a so-0600 | 600 |
| 34 | Segurança da Informação | seg-0001 a seg-0600 | 600 |
| 35 | Engenharia de Software | es-0001 a es-0600 | 600 |
| 36 | Cloud e DevOps | cloud-0001 a cloud-0500 | 500 |

## Prompt de cada sessão

### 1. SQL · sql-2001 a sql-2500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "SQL" (prefixo sql), ids de sql-2001 a sql-2500 (500 questões, 10 lotes de 50; o primeiro arquivo é sql-041.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 2. Python · py-0001 a py-0500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Python" (prefixo py), ids de py-0001 a py-0500 (500 questões, 10 lotes de 50; o primeiro arquivo é py-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 3. Python · py-0501 a py-1000

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Python" (prefixo py), ids de py-0501 a py-1000 (500 questões, 10 lotes de 50; o primeiro arquivo é py-011.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 4. Python · py-1001 a py-1500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Python" (prefixo py), ids de py-1001 a py-1500 (500 questões, 10 lotes de 50; o primeiro arquivo é py-021.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 5. Python · py-1501 a py-2000

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Python" (prefixo py), ids de py-1501 a py-2000 (500 questões, 10 lotes de 50; o primeiro arquivo é py-031.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 6. Python · py-2001 a py-2500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Python" (prefixo py), ids de py-2001 a py-2500 (500 questões, 10 lotes de 50; o primeiro arquivo é py-041.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 7. Pandas e NumPy · pd-0001 a pd-0500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Pandas e NumPy" (prefixo pd), ids de pd-0001 a pd-0500 (500 questões, 10 lotes de 50; o primeiro arquivo é pd-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 8. Pandas e NumPy · pd-0501 a pd-1000

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Pandas e NumPy" (prefixo pd), ids de pd-0501 a pd-1000 (500 questões, 10 lotes de 50; o primeiro arquivo é pd-011.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 9. Pandas e NumPy · pd-1001 a pd-1500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Pandas e NumPy" (prefixo pd), ids de pd-1001 a pd-1500 (500 questões, 10 lotes de 50; o primeiro arquivo é pd-021.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 10. Estatística · est-0001 a est-0500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Estatística" (prefixo est), ids de est-0001 a est-0500 (500 questões, 10 lotes de 50; o primeiro arquivo é est-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 11. Estatística · est-0501 a est-1000

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Estatística" (prefixo est), ids de est-0501 a est-1000 (500 questões, 10 lotes de 50; o primeiro arquivo é est-011.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 12. Estatística · est-1001 a est-1500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Estatística" (prefixo est), ids de est-1001 a est-1500 (500 questões, 10 lotes de 50; o primeiro arquivo é est-021.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 13. Estatística · est-1501 a est-2000

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Estatística" (prefixo est), ids de est-1501 a est-2000 (500 questões, 10 lotes de 50; o primeiro arquivo é est-031.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 14. Machine Learning · ml-0101 a ml-0600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Machine Learning" (prefixo ml), ids de ml-0101 a ml-0600 (500 questões, 10 lotes de 50; o primeiro arquivo é ml-003.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 15. Machine Learning · ml-0601 a ml-1100

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Machine Learning" (prefixo ml), ids de ml-0601 a ml-1100 (500 questões, 10 lotes de 50; o primeiro arquivo é ml-013.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 16. Machine Learning · ml-1101 a ml-1600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Machine Learning" (prefixo ml), ids de ml-1101 a ml-1600 (500 questões, 10 lotes de 50; o primeiro arquivo é ml-023.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 17. Machine Learning · ml-1601 a ml-2100

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Machine Learning" (prefixo ml), ids de ml-1601 a ml-2100 (500 questões, 10 lotes de 50; o primeiro arquivo é ml-033.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 18. Machine Learning · ml-2101 a ml-2500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Machine Learning" (prefixo ml), ids de ml-2101 a ml-2500 (400 questões, 8 lotes de 50; o primeiro arquivo é ml-043.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 19. Git e GitHub · git-0001 a git-0350

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Git e GitHub" (prefixo git), ids de git-0001 a git-0350 (350 questões, 7 lotes de 50; o primeiro arquivo é git-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 20. Git e GitHub · git-0351 a git-0700

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Git e GitHub" (prefixo git), ids de git-0351 a git-0700 (350 questões, 7 lotes de 50; o primeiro arquivo é git-008.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 21. Modelagem de Dados e Bancos de Dados · bd-0001 a bd-0500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Modelagem de Dados e Bancos de Dados" (prefixo bd), ids de bd-0001 a bd-0500 (500 questões, 10 lotes de 50; o primeiro arquivo é bd-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 22. Modelagem de Dados e Bancos de Dados · bd-0501 a bd-1000

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Modelagem de Dados e Bancos de Dados" (prefixo bd), ids de bd-0501 a bd-1000 (500 questões, 10 lotes de 50; o primeiro arquivo é bd-011.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 23. Modelagem de Dados e Bancos de Dados · bd-1001 a bd-1500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Modelagem de Dados e Bancos de Dados" (prefixo bd), ids de bd-1001 a bd-1500 (500 questões, 10 lotes de 50; o primeiro arquivo é bd-021.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 24. BI e Visualização · bi-0001 a bi-0600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "BI e Visualização" (prefixo bi), ids de bi-0001 a bi-0600 (600 questões, 12 lotes de 50; o primeiro arquivo é bi-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 25. BI e Visualização · bi-0601 a bi-1200

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "BI e Visualização" (prefixo bi), ids de bi-0601 a bi-1200 (600 questões, 12 lotes de 50; o primeiro arquivo é bi-013.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 26. Engenharia de Dados · ed-0001 a ed-0600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Engenharia de Dados" (prefixo ed), ids de ed-0001 a ed-0600 (600 questões, 12 lotes de 50; o primeiro arquivo é ed-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 27. Engenharia de Dados · ed-0601 a ed-1200

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Engenharia de Dados" (prefixo ed), ids de ed-0601 a ed-1200 (600 questões, 12 lotes de 50; o primeiro arquivo é ed-013.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 28. Algoritmos e Estruturas de Dados · alg-0001 a alg-0450

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Algoritmos e Estruturas de Dados" (prefixo alg), ids de alg-0001 a alg-0450 (450 questões, 9 lotes de 50; o primeiro arquivo é alg-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 29. Algoritmos e Estruturas de Dados · alg-0451 a alg-0900

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Algoritmos e Estruturas de Dados" (prefixo alg), ids de alg-0451 a alg-0900 (450 questões, 9 lotes de 50; o primeiro arquivo é alg-010.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 30. Lógica de Programação · log-0001 a log-0500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Lógica de Programação" (prefixo log), ids de log-0001 a log-0500 (500 questões, 10 lotes de 50; o primeiro arquivo é log-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 31. Redes de Computadores · rede-0001 a rede-0350

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Redes de Computadores" (prefixo rede), ids de rede-0001 a rede-0350 (350 questões, 7 lotes de 50; o primeiro arquivo é rede-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 32. Redes de Computadores · rede-0351 a rede-0700

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Redes de Computadores" (prefixo rede), ids de rede-0351 a rede-0700 (350 questões, 7 lotes de 50; o primeiro arquivo é rede-008.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 33. Sistemas Operacionais e Linux · so-0001 a so-0600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Sistemas Operacionais e Linux" (prefixo so), ids de so-0001 a so-0600 (600 questões, 12 lotes de 50; o primeiro arquivo é so-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 34. Segurança da Informação · seg-0001 a seg-0600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Segurança da Informação" (prefixo seg), ids de seg-0001 a seg-0600 (600 questões, 12 lotes de 50; o primeiro arquivo é seg-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 35. Engenharia de Software · es-0001 a es-0600

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Engenharia de Software" (prefixo es), ids de es-0001 a es-0600 (600 questões, 12 lotes de 50; o primeiro arquivo é es-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 36. Cloud e DevOps · cloud-0001 a cloud-0500

```
Leia banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e siga o protocolo à risca.

Sua faixa: tema "Cloud e DevOps" (prefixo cloud), ids de cloud-0001 a cloud-0500 (500 questões, 10 lotes de 50; o primeiro arquivo é cloud-001.jsonl).

Escreva somente em banco-questoes/entregas/. Verifique cada questão executando o código quando possível, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

