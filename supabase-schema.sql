-- ============================================================
-- Notesown - Esquema SQL para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- -----------------------------------------------
-- TABLA: books
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.books (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL CHECK (char_length(title) > 0 AND char_length(title) <= 100),
  icon       TEXT NOT NULL DEFAULT 'pi pi-book',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- TABLA: notes
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id      UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL DEFAULT 'Sin título' CHECK (char_length(title) <= 200),
  content      TEXT NOT NULL DEFAULT '',
  blind_index  TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- TABLA: user_keys (E2EE - Wrapped Key)
-- Almacena la CEK cifrada con la KEK derivada de la contraseña.
-- Una fila por usuario. Nunca contiene claves en texto plano.
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_keys (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_cek TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- ÍNDICES
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS books_user_id_idx ON public.books(user_id);
CREATE INDEX IF NOT EXISTS notes_book_id_idx ON public.notes(book_id);
CREATE INDEX IF NOT EXISTS notes_user_id_idx ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON public.notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS notes_last_read_idx ON public.notes(user_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS notes_blind_idx ON public.notes USING GIN(blind_index);

-- -----------------------------------------------
-- FUNCIÓN: actualizar updated_at automáticamente
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Solo actualiza updated_at en notes cuando title o content cambian (no last_read_at)
CREATE OR REPLACE FUNCTION public.handle_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title OR NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------
-- TRIGGERS: updated_at
-- -----------------------------------------------
DROP TRIGGER IF EXISTS books_updated_at ON public.books;
CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS notes_updated_at ON public.notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_notes_updated_at();

-- -----------------------------------------------
-- FUNCIÓN: insertar user_id automáticamente
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS books_user_id ON public.books;
CREATE TRIGGER books_user_id
  BEFORE INSERT ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_id();

DROP TRIGGER IF EXISTS notes_user_id ON public.notes;
CREATE TRIGGER notes_user_id
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_id();

-- -----------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Políticas para books
CREATE POLICY "users can select own books"
  ON public.books FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own books"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own books"
  ON public.books FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own books"
  ON public.books FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para notes
CREATE POLICY "users can select own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- -----------------------------------------------
-- RLS: user_keys
-- -----------------------------------------------
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can select own key"
  ON public.user_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own key"
  ON public.user_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own key"
  ON public.user_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------
-- MIGRACIÓN E2EE: ejecutar en BD existente
-- -----------------------------------------------
-- Agregar blind_index si la tabla ya existe
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS blind_index TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS notes_blind_idx ON public.notes USING GIN(blind_index);

-- Eliminar FTS (incompatible con contenido cifrado)
ALTER TABLE public.notes DROP COLUMN IF EXISTS fts;
DROP INDEX IF EXISTS notes_fts_idx;
