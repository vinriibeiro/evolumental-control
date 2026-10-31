# Prompts das sessões do Claude — banco CGU 2026 (questões autorais)

Cada linha é **uma sessão na nuvem** (Claude Code na web, repositório evolumental-control, branch base `banco-questoes-claude`). As faixas não se sobrepõem: dá para rodar várias ao mesmo tempo. Antes de disparar muitas, rode uma e veja o consumo de crédito.

Situação de partida (gerada automaticamente a partir de `oficiais/relatorio-importacao.json` e das 100 autorais já feitas por tema, ids 5001–5100):

| Tema | Alvo | Oficiais importadas | Autorais feitas | Faltam (autorais) | Sessões |
|---|---:|---:|---:|---:|---:|
| CGU P1 · Estado, democracia, direitos e ciência política | 750 | 86 | 100 | 564 | 2 |
| CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento | 750 | 97 | 100 | 553 | 2 |
| CGU P1 · Ética pública e responsabilidade profissional | 750 | 59 | 100 | 591 | 2 |
| CGU P1 · Administração pública e políticas públicas | 750 | 139 | 100 | 511 | 2 |
| CGU P2 · Governança, riscos e integridade | 600 | 30 | 100 | 470 | 1 |
| CGU P2 · Transparência, ouvidoria e participação social | 600 | 58 | 100 | 442 | 1 |
| CGU P2 · Direito público, controle e responsabilização | 600 | 138 | 100 | 362 | 1 |
| CGU P2 · Evidências, dados e inteligência artificial | 600 | 6 | 100 | 494 | 1 |
| CGU P2 · Auditoria governamental e atuação integrada da CGU | 600 | 13 | 100 | 487 | 1 |
| CGU P3 · Estatística, programação e análise de dados | 3500 | 294 | 100 | 3106 | 7 |
| CGU P3 · Engenharia, arquitetura e governança de dados | 3500 | 1284 | 100 | 2116 | 5 |
| CGU P3 · Aprendizado de máquina e inteligência artificial | 3500 | 253 | 100 | 3147 | 7 |
| CGU P3 · Operação, governança e gestão de soluções de dados e IA | 3500 | 710 | 100 | 2690 | 6 |
| **Total** | 20000 | 3167 | 1300 | 15533 | 38 |

## Sessões (38; cada uma com até 500 questões = 10 lotes de 50)

| # | Tema | Faixa | Qtd | Primeiro arquivo |
|---|---|---|---:|---|
| 1 | CGU P1 · Estado, democracia, direitos e ciência política | cgudem-5101 a cgudem-5600 | 500 | cgudem-103.jsonl |
| 2 | CGU P1 · Estado, democracia, direitos e ciência política | cgudem-5601 a cgudem-5664 | 64 | cgudem-113.jsonl |
| 3 | CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento | cgusoc-5101 a cgusoc-5600 | 500 | cgusoc-103.jsonl |
| 4 | CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento | cgusoc-5601 a cgusoc-5653 | 53 | cgusoc-113.jsonl |
| 5 | CGU P1 · Ética pública e responsabilidade profissional | cgueti-5101 a cgueti-5600 | 500 | cgueti-103.jsonl |
| 6 | CGU P1 · Ética pública e responsabilidade profissional | cgueti-5601 a cgueti-5691 | 91 | cgueti-113.jsonl |
| 7 | CGU P1 · Administração pública e políticas públicas | cguadm-5101 a cguadm-5600 | 500 | cguadm-103.jsonl |
| 8 | CGU P1 · Administração pública e políticas públicas | cguadm-5601 a cguadm-5611 | 11 | cguadm-113.jsonl |
| 9 | CGU P2 · Governança, riscos e integridade | cgugov-5101 a cgugov-5570 | 470 | cgugov-103.jsonl |
| 10 | CGU P2 · Transparência, ouvidoria e participação social | cgutra-5101 a cgutra-5542 | 442 | cgutra-103.jsonl |
| 11 | CGU P2 · Direito público, controle e responsabilização | cgudir-5101 a cgudir-5462 | 362 | cgudir-103.jsonl |
| 12 | CGU P2 · Evidências, dados e inteligência artificial | cguevi-5101 a cguevi-5594 | 494 | cguevi-103.jsonl |
| 13 | CGU P2 · Auditoria governamental e atuação integrada da CGU | cguaud-5101 a cguaud-5587 | 487 | cguaud-103.jsonl |
| 14 | CGU P3 · Estatística, programação e análise de dados | cgusta-5101 a cgusta-5600 | 500 | cgusta-103.jsonl |
| 15 | CGU P3 · Estatística, programação e análise de dados | cgusta-5601 a cgusta-6100 | 500 | cgusta-113.jsonl |
| 16 | CGU P3 · Estatística, programação e análise de dados | cgusta-6101 a cgusta-6600 | 500 | cgusta-123.jsonl |
| 17 | CGU P3 · Estatística, programação e análise de dados | cgusta-6601 a cgusta-7100 | 500 | cgusta-133.jsonl |
| 18 | CGU P3 · Estatística, programação e análise de dados | cgusta-7101 a cgusta-7600 | 500 | cgusta-143.jsonl |
| 19 | CGU P3 · Estatística, programação e análise de dados | cgusta-7601 a cgusta-8100 | 500 | cgusta-153.jsonl |
| 20 | CGU P3 · Estatística, programação e análise de dados | cgusta-8101 a cgusta-8206 | 106 | cgusta-163.jsonl |
| 21 | CGU P3 · Engenharia, arquitetura e governança de dados | cgueng-5101 a cgueng-5600 | 500 | cgueng-103.jsonl |
| 22 | CGU P3 · Engenharia, arquitetura e governança de dados | cgueng-5601 a cgueng-6100 | 500 | cgueng-113.jsonl |
| 23 | CGU P3 · Engenharia, arquitetura e governança de dados | cgueng-6101 a cgueng-6600 | 500 | cgueng-123.jsonl |
| 24 | CGU P3 · Engenharia, arquitetura e governança de dados | cgueng-6601 a cgueng-7100 | 500 | cgueng-133.jsonl |
| 25 | CGU P3 · Engenharia, arquitetura e governança de dados | cgueng-7101 a cgueng-7216 | 116 | cgueng-143.jsonl |
| 26 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-5101 a cguml-5600 | 500 | cguml-103.jsonl |
| 27 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-5601 a cguml-6100 | 500 | cguml-113.jsonl |
| 28 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-6101 a cguml-6600 | 500 | cguml-123.jsonl |
| 29 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-6601 a cguml-7100 | 500 | cguml-133.jsonl |
| 30 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-7101 a cguml-7600 | 500 | cguml-143.jsonl |
| 31 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-7601 a cguml-8100 | 500 | cguml-153.jsonl |
| 32 | CGU P3 · Aprendizado de máquina e inteligência artificial | cguml-8101 a cguml-8247 | 147 | cguml-163.jsonl |
| 33 | CGU P3 · Operação, governança e gestão de soluções de dados e IA | cguops-5101 a cguops-5600 | 500 | cguops-103.jsonl |
| 34 | CGU P3 · Operação, governança e gestão de soluções de dados e IA | cguops-5601 a cguops-6100 | 500 | cguops-113.jsonl |
| 35 | CGU P3 · Operação, governança e gestão de soluções de dados e IA | cguops-6101 a cguops-6600 | 500 | cguops-123.jsonl |
| 36 | CGU P3 · Operação, governança e gestão de soluções de dados e IA | cguops-6601 a cguops-7100 | 500 | cguops-133.jsonl |
| 37 | CGU P3 · Operação, governança e gestão de soluções de dados e IA | cguops-7101 a cguops-7600 | 500 | cguops-143.jsonl |
| 38 | CGU P3 · Operação, governança e gestão de soluções de dados e IA | cguops-7601 a cguops-7790 | 190 | cguops-153.jsonl |

## Prompt de cada sessão

Troque só o tema, o prefixo e a faixa. O texto entre crases é o prompt completo.

### 1. CGU P1 · Estado, democracia, direitos e ciência política · cgudem-5101 a cgudem-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Estado, democracia, direitos e ciência política" (prefixo cgudem), ids de cgudem-5101 a cgudem-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgudem-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 2. CGU P1 · Estado, democracia, direitos e ciência política · cgudem-5601 a cgudem-5664

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Estado, democracia, direitos e ciência política" (prefixo cgudem), ids de cgudem-5601 a cgudem-5664 (64 questões certo/errado, 2 lotes de 50; o primeiro arquivo é cgudem-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 3. CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento · cgusoc-5101 a cgusoc-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento" (prefixo cgusoc), ids de cgusoc-5101 a cgusoc-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusoc-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 4. CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento · cgusoc-5601 a cgusoc-5653

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Sociedade brasileira, desigualdades e desenvolvimento" (prefixo cgusoc), ids de cgusoc-5601 a cgusoc-5653 (53 questões certo/errado, 2 lotes de 50; o primeiro arquivo é cgusoc-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 5. CGU P1 · Ética pública e responsabilidade profissional · cgueti-5101 a cgueti-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Ética pública e responsabilidade profissional" (prefixo cgueti), ids de cgueti-5101 a cgueti-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgueti-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 6. CGU P1 · Ética pública e responsabilidade profissional · cgueti-5601 a cgueti-5691

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Ética pública e responsabilidade profissional" (prefixo cgueti), ids de cgueti-5601 a cgueti-5691 (91 questões certo/errado, 2 lotes de 50; o primeiro arquivo é cgueti-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 7. CGU P1 · Administração pública e políticas públicas · cguadm-5101 a cguadm-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Administração pública e políticas públicas" (prefixo cguadm), ids de cguadm-5101 a cguadm-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguadm-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 8. CGU P1 · Administração pública e políticas públicas · cguadm-5601 a cguadm-5611

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P1 · Administração pública e políticas públicas" (prefixo cguadm), ids de cguadm-5601 a cguadm-5611 (11 questões certo/errado, 1 lotes de 50; o primeiro arquivo é cguadm-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 9. CGU P2 · Governança, riscos e integridade · cgugov-5101 a cgugov-5570

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P2 · Governança, riscos e integridade" (prefixo cgugov), ids de cgugov-5101 a cgugov-5570 (470 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgugov-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 10. CGU P2 · Transparência, ouvidoria e participação social · cgutra-5101 a cgutra-5542

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P2 · Transparência, ouvidoria e participação social" (prefixo cgutra), ids de cgutra-5101 a cgutra-5542 (442 questões certo/errado, 9 lotes de 50; o primeiro arquivo é cgutra-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 11. CGU P2 · Direito público, controle e responsabilização · cgudir-5101 a cgudir-5462

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P2 · Direito público, controle e responsabilização" (prefixo cgudir), ids de cgudir-5101 a cgudir-5462 (362 questões certo/errado, 8 lotes de 50; o primeiro arquivo é cgudir-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 12. CGU P2 · Evidências, dados e inteligência artificial · cguevi-5101 a cguevi-5594

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P2 · Evidências, dados e inteligência artificial" (prefixo cguevi), ids de cguevi-5101 a cguevi-5594 (494 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguevi-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 13. CGU P2 · Auditoria governamental e atuação integrada da CGU · cguaud-5101 a cguaud-5587

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P2 · Auditoria governamental e atuação integrada da CGU" (prefixo cguaud), ids de cguaud-5101 a cguaud-5587 (487 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguaud-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 14. CGU P3 · Estatística, programação e análise de dados · cgusta-5101 a cgusta-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-5101 a cgusta-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusta-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 15. CGU P3 · Estatística, programação e análise de dados · cgusta-5601 a cgusta-6100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-5601 a cgusta-6100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusta-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 16. CGU P3 · Estatística, programação e análise de dados · cgusta-6101 a cgusta-6600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-6101 a cgusta-6600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusta-123.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 17. CGU P3 · Estatística, programação e análise de dados · cgusta-6601 a cgusta-7100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-6601 a cgusta-7100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusta-133.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 18. CGU P3 · Estatística, programação e análise de dados · cgusta-7101 a cgusta-7600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-7101 a cgusta-7600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusta-143.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 19. CGU P3 · Estatística, programação e análise de dados · cgusta-7601 a cgusta-8100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-7601 a cgusta-8100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgusta-153.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 20. CGU P3 · Estatística, programação e análise de dados · cgusta-8101 a cgusta-8206

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Estatística, programação e análise de dados" (prefixo cgusta), ids de cgusta-8101 a cgusta-8206 (106 questões certo/errado, 3 lotes de 50; o primeiro arquivo é cgusta-163.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 21. CGU P3 · Engenharia, arquitetura e governança de dados · cgueng-5101 a cgueng-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Engenharia, arquitetura e governança de dados" (prefixo cgueng), ids de cgueng-5101 a cgueng-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgueng-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 22. CGU P3 · Engenharia, arquitetura e governança de dados · cgueng-5601 a cgueng-6100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Engenharia, arquitetura e governança de dados" (prefixo cgueng), ids de cgueng-5601 a cgueng-6100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgueng-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 23. CGU P3 · Engenharia, arquitetura e governança de dados · cgueng-6101 a cgueng-6600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Engenharia, arquitetura e governança de dados" (prefixo cgueng), ids de cgueng-6101 a cgueng-6600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgueng-123.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 24. CGU P3 · Engenharia, arquitetura e governança de dados · cgueng-6601 a cgueng-7100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Engenharia, arquitetura e governança de dados" (prefixo cgueng), ids de cgueng-6601 a cgueng-7100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cgueng-133.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 25. CGU P3 · Engenharia, arquitetura e governança de dados · cgueng-7101 a cgueng-7216

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Engenharia, arquitetura e governança de dados" (prefixo cgueng), ids de cgueng-7101 a cgueng-7216 (116 questões certo/errado, 3 lotes de 50; o primeiro arquivo é cgueng-143.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 26. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-5101 a cguml-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-5101 a cguml-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguml-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 27. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-5601 a cguml-6100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-5601 a cguml-6100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguml-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 28. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-6101 a cguml-6600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-6101 a cguml-6600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguml-123.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 29. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-6601 a cguml-7100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-6601 a cguml-7100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguml-133.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 30. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-7101 a cguml-7600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-7101 a cguml-7600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguml-143.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 31. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-7601 a cguml-8100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-7601 a cguml-8100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguml-153.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 32. CGU P3 · Aprendizado de máquina e inteligência artificial · cguml-8101 a cguml-8247

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Aprendizado de máquina e inteligência artificial" (prefixo cguml), ids de cguml-8101 a cguml-8247 (147 questões certo/errado, 3 lotes de 50; o primeiro arquivo é cguml-163.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 33. CGU P3 · Operação, governança e gestão de soluções de dados e IA · cguops-5101 a cguops-5600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Operação, governança e gestão de soluções de dados e IA" (prefixo cguops), ids de cguops-5101 a cguops-5600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguops-103.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 34. CGU P3 · Operação, governança e gestão de soluções de dados e IA · cguops-5601 a cguops-6100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Operação, governança e gestão de soluções de dados e IA" (prefixo cguops), ids de cguops-5601 a cguops-6100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguops-113.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 35. CGU P3 · Operação, governança e gestão de soluções de dados e IA · cguops-6101 a cguops-6600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Operação, governança e gestão de soluções de dados e IA" (prefixo cguops), ids de cguops-6101 a cguops-6600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguops-123.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 36. CGU P3 · Operação, governança e gestão de soluções de dados e IA · cguops-6601 a cguops-7100

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Operação, governança e gestão de soluções de dados e IA" (prefixo cguops), ids de cguops-6601 a cguops-7100 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguops-133.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 37. CGU P3 · Operação, governança e gestão de soluções de dados e IA · cguops-7101 a cguops-7600

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Operação, governança e gestão de soluções de dados e IA" (prefixo cguops), ids de cguops-7101 a cguops-7600 (500 questões certo/errado, 10 lotes de 50; o primeiro arquivo é cguops-143.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```

### 38. CGU P3 · Operação, governança e gestão de soluções de dados e IA · cguops-7601 a cguops-7790

```
Leia banco-questoes/cgu/LEIA-ME-CGU.md, banco-questoes/LEIA-ME.md e banco-questoes/exemplos.jsonl e, em banco-questoes/cgu/programa-cgu-2026.md, só a seção do seu tema. Siga o protocolo à risca.

Sua faixa: tema "CGU P3 · Operação, governança e gestão de soluções de dados e IA" (prefixo cguops), ids de cguops-7601 a cguops-7790 (190 questões certo/errado, 4 lotes de 50; o primeiro arquivo é cguops-153.jsonl). Subtemas: os itens do edital desse tema, em rodízio.

Escreva somente em banco-questoes/cgu/entregas/. Não repita ideias das questões já existentes em banco-questoes/cgu/entregas/ e banco-questoes/cgu/oficiais/ do seu tema (leia uma amostra antes de começar). Execute o código quando houver, rode o validador a cada lote, faça um commit por lote e push a cada 3 lotes e no final. No fim, mande o resumo curto pedido no protocolo.
```
