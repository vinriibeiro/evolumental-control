-- =====================================================================
-- VLM Control 2.0 — Biblioteca (estante v2)
-- Migração 20261121010000_v2_library
--
-- Aditiva: acrescenta à tabela public.library_books os dados da estante
-- unificada, sem tocar em nenhuma linha, posição de leitura ou marcador:
--   * subject      -> assunto livre definido pelo usuário (filtro da estante);
--   * favorite     -> livro favorito;
--   * shelf_state  -> 'active' (na estante), 'archived' (arquivado) ou
--                     'hidden' (removido da estante). Nos três casos o arquivo
--                     e os dados de leitura continuam guardados; só a exclusão
--                     permanente apaga a linha e os arquivos do bucket;
--   * notes        -> anotações simples do leitor (lista JSON);
--   * isbn, identifier -> ISBN (13 dígitos) e identificador persistente lidos
--                     do EPUB, usados para avisar sobre livros duplicados.
--
-- Nenhuma política nova: as políticas RLS de 20261031000000_library.sql já
-- limitam a tabela inteira (todas as colunas) ao próprio dono, user_id = auth.uid().
-- Os livros existentes ficam com os valores padrão (na estante, sem assunto).
--
-- Enquanto esta migração não for aplicada o app continua funcionando: esses
-- dados ficam só no aparelho e sobem na primeira sincronização depois dela.
-- =====================================================================

alter table public.library_books
  add column if not exists subject text check (subject is null or char_length(subject) <= 120),
  add column if not exists favorite boolean not null default false,
  add column if not exists shelf_state text not null default 'active' check (shelf_state in ('active', 'archived', 'hidden')),
  add column if not exists notes jsonb not null default '[]'::jsonb check (jsonb_typeof(notes) = 'array' and jsonb_array_length(notes) <= 2000),
  add column if not exists isbn text check (isbn is null or isbn ~ '^[0-9]{13}$'),
  add column if not exists identifier text check (identifier is null or char_length(identifier) <= 500);

-- =====================================================================
-- REVERSÃO (execute manualmente, se precisar voltar ao esquema anterior;
-- apaga assuntos, favoritos, situação na estante e anotações guardados na nuvem):
--
--   alter table public.library_books
--     drop column if exists identifier,
--     drop column if exists isbn,
--     drop column if exists notes,
--     drop column if exists shelf_state,
--     drop column if exists favorite,
--     drop column if exists subject;
-- =====================================================================
