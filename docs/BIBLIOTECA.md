# Biblioteca (leitor de EPUB)

Aba **Biblioteca**: estante com capas e leitor em tela cheia (estilo Kindle) para livros em EPUB.

## Como funciona

- Os livros sempre ficam guardados também no navegador do aparelho (IndexedDB `evolumental-library…`), para ler sem internet.
- **Modo Supabase** (variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configuradas): cada livro também vai para um espaço **privado** da conta. Só o dono acessa, depois do login (RLS). Os livros aparecem em qualquer aparelho em que a pessoa entrar; o arquivo é baixado na primeira vez que o livro é aberto naquele aparelho.
- **Modo local** (sem Supabase): nada sai do navegador. Em outro aparelho é preciso adicionar os arquivos de novo.
- A posição de leitura e os marcadores sincronizam entre aparelhos; vale a alteração mais recente.
- Limite do plano gratuito do Supabase: **50 MiB por arquivo**. Livros maiores ficam só no aparelho em que foram adicionados (a estante mostra "Só neste aparelho"). Para levá-los à nuvem, reduza as imagens do EPUB.
- Só EPUB. PDFs precisam ser convertidos antes.

## Ativar a nuvem no Supabase (uma vez)

1. Abra o projeto no Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `supabase/migrations/20261031000000_library.sql` e execute (**Run**).
3. Confira em **Storage** se existe o bucket **livros** com o selo de privado, e em **Table Editor** a tabela `library_books`.
4. Abra a aba Biblioteca no app, já logado. Se a migração não foi aplicada, a estante mostra um aviso explicando o que falta e continua funcionando só localmente.

A migração cria a tabela `library_books` e o bucket `livros` (privado, 50 MiB por arquivo), com políticas que limitam cada usuário à própria pasta `<user_id>/`.

## Observações

- Excluir a conta apaga as linhas de `library_books`, mas os arquivos já enviados ao bucket `livros` precisam ser removidos pelo painel do Supabase (Storage), pois o banco não apaga arquivos de armazenamento.
- "Zerar meus dados" não mexe nos livros.
- Material protegido por direitos autorais: use só cópias suas, para uso pessoal.
