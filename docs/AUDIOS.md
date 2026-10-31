# Áudios dos tópicos

Cada tópico pode ter faixas de áudio (por exemplo, as faixas de uma lição de idiomas). O player fica no painel do tópico, em **Matérias e tópicos → abrir o tópico → Áudios**.

## Como funciona

- **Adicionar áudios:** escolha os arquivos (mp3, m4a, wav, ogg); dá para escolher vários de uma vez, e eles entram em ordem natural de nome (Track 2 antes de Track 10).
- **Player:** tocar tudo, pausar, faixa anterior/próxima, barra de posição e velocidade (0,75x a 1,5x).
- **Repetição para o ciclo de estudo de idiomas:** escolha **Lição inteira** (toca todas as faixas e volta ao começo) ou **Cada faixa** (repete cada faixa antes de ir para a próxima), e quantas vezes (1 a 20; o padrão é 5). O painel mostra "Volta 2 de 5 · faixa 3 de 5" e quanto tempo leva ouvir tudo N vezes.
- **Modo local** (sem Supabase): os áudios ficam só neste navegador (IndexedDB). Em outro aparelho é preciso adicionar de novo.
- **Modo Supabase:** cada faixa também vai para um espaço **privado** da conta (bucket `audios` + tabela `topic_audios`, com RLS por usuário). Em outro aparelho a faixa aparece na lista, baixa na primeira vez que é tocada e depois toca do cache do aparelho, sem internet.
- Limite do plano gratuito do Supabase: **50 MiB por arquivo** (cada faixa de lição tem bem menos) e **1 GB** de armazenamento no total. Para economizar, recomprima os mp3 para voz (mono, 64 kbps): costuma ficar com menos da metade do tamanho.

## Ativar a nuvem (uma vez)

1. Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `supabase/migrations/20261031010000_audios.sql` e clique em **Run**.
3. Confira em **Storage** o bucket **audios** (privado).

Sem a migração, o player funciona só no aparelho e avisa que a nuvem não está ativada.

## Observações

- Apagar um tópico apaga os metadados das faixas, mas os arquivos já enviados ao bucket `audios` só saem pelo app (remover a faixa) ou pelo painel de Storage.
- O áudio de cursos pagos é material de uso pessoal: use só cópias suas e nunca o publique.
