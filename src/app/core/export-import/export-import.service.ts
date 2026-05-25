import { Injectable, inject } from '@angular/core';
import { BooksRepository } from '../../books/books.repository';
import { NotesRepository } from '../../notes/notes.repository';

export interface NotesownExportNote {
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NotesownExportBook {
  title: string;
  icon: string;
  notes: NotesownExportNote[];
}

export interface NotesownExport {
  version: string;
  exportedAt: string;
  books: NotesownExportBook[];
}

export interface ImportResult {
  booksCreated: number;
  notesCreated: number;
  notesUpdated: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class ExportImportService {
  private readonly booksRepo = inject(BooksRepository);
  private readonly notesRepo = inject(NotesRepository);

  async exportAll(): Promise<void> {
    const books = await this.booksRepo.getAll();

    const exportBooks: NotesownExportBook[] = await Promise.all(
      books.map(async book => {
        const notes = await this.notesRepo.getByBook(book.id);
        return {
          title: book.title,
          icon: book.icon,
          notes: notes.map(n => ({
            title: n.title,
            content: n.content,
            created_at: n.created_at,
            updated_at: n.updated_at,
          })),
        };
      }),
    );

    const payload: NotesownExport = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      books: exportBooks,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `notesown-export-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(file: File): Promise<ImportResult> {
    const text = await file.text();
    const payload = this.parseAndValidate(text);

    const result: ImportResult = {
      booksCreated: 0,
      notesCreated: 0,
      notesUpdated: 0,
      errors: [],
    };

    const existingBooks = await this.booksRepo.getAll();
    const booksByName = new Map(existingBooks.map(b => [b.title, b]));

    for (const exportBook of payload.books) {
      let book = booksByName.get(exportBook.title) ?? null;

      if (!book) {
        try {
          book = await this.booksRepo.create(exportBook.title, exportBook.icon ?? 'pi pi-book');
          booksByName.set(book.title, book);
          result.booksCreated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Libro "${exportBook.title}": ${msg}`);
          continue;
        }
      }

      const existingNotes = await this.notesRepo.getByBook(book.id);
      const notesByTitle = new Map(existingNotes.map(n => [n.title, n]));

      for (const exportNote of exportBook.notes) {
        const existing = notesByTitle.get(exportNote.title) ?? null;
        try {
          if (existing) {
            await this.notesRepo.update(existing.id, {
              title: exportNote.title,
              content: exportNote.content,
            });
            result.notesUpdated++;
          } else {
            const created = await this.notesRepo.create(book.id, exportNote.title);
            await this.notesRepo.update(created.id, { content: exportNote.content });
            result.notesCreated++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.errors.push(`Nota "${exportNote.title}" en "${exportBook.title}": ${msg}`);
        }
      }
    }

    return result;
  }

  private parseAndValidate(text: string): NotesownExport {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('El archivo no es un JSON válido');
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      typeof (parsed as Record<string, unknown>)['version'] !== 'string' ||
      !('books' in parsed) ||
      !Array.isArray((parsed as Record<string, unknown>)['books'])
    ) {
      throw new Error('Formato de archivo inválido: se esperaba { version, books[] }');
    }

    const data = parsed as NotesownExport;

    for (const book of data.books) {
      if (typeof book.title !== 'string' || !Array.isArray(book.notes)) {
        throw new Error('Formato inválido: cada libro debe tener title (string) y notes (array)');
      }
      for (const note of book.notes) {
        if (typeof note.title !== 'string' || typeof note.content !== 'string') {
          throw new Error(
            `Formato inválido: cada nota debe tener title y content (strings). Fallo en libro "${book.title}"`,
          );
        }
      }
    }

    return data;
  }
}
