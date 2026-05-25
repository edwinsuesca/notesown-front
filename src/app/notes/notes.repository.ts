import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import { CryptoService } from '../core/crypto/crypto.service';
import { PrivBookService } from '../core/private/priv-book.service';
import type { Note } from '../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class NotesRepository {
  private readonly db = inject(SupabaseService).client;
  private readonly crypto = inject(CryptoService);
  private readonly privBook = inject(PrivBookService);

  async getById(id: string): Promise<Note> {
    const { data, error } = await this.db
      .from('notes')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return this.decryptNote(data);
  }

  async getByBook(bookId: string): Promise<Note[]> {
    const { data, error } = await this.db
      .from('notes')
      .select('*')
      .eq('book_id', bookId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return Promise.all(data.map(n => this.decryptNote(n)));
  }

  async getRecentlyRead(limit = 8): Promise<Note[]> {
    const privId = this.privBook.privBookId();
    let q = this.db
      .from('notes')
      .select('*')
      .order('last_read_at', { ascending: false })
      .limit(limit);
    if (privId) q = q.neq('book_id', privId);
    const { data, error } = await q;
    if (error) throw error;
    return Promise.all(data.map(n => this.decryptNote(n)));
  }

  async getRecentlyModified(limit = 8): Promise<Note[]> {
    const privId = this.privBook.privBookId();
    let q = this.db
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (privId) q = q.neq('book_id', privId);
    const { data, error } = await q;
    if (error) throw error;
    return Promise.all(data.map(n => this.decryptNote(n)));
  }

  async search(query: string): Promise<Note[]> {
    const trimmed = query.trim();
    const privId = this.privBook.privBookId();

    let titleQ = this.db
      .from('notes')
      .select('*')
      .ilike('title', `%${trimmed}%`)
      .order('updated_at', { ascending: false });
    if (privId) titleQ = titleQ.neq('book_id', privId);
    const { data: titleData, error: titleError } = await titleQ;
    if (titleError) throw titleError;

    const tokens = this.crypto.tokenize(trimmed);
    let contentData: Note[] = [];

    if (tokens.length > 0) {
      const hashes = await Promise.all(tokens.map(t => this.crypto.hashToken(t)));
      let contentQ = this.db
        .from('notes')
        .select('*')
        .contains('blind_index', hashes)
        .order('updated_at', { ascending: false });
      if (privId) contentQ = contentQ.neq('book_id', privId);
      const { data, error } = await contentQ;
      if (error) throw error;
      contentData = data;
    }

    const seen = new Set<string>();
    const merged = [...titleData, ...contentData].filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    return Promise.all(merged.map(n => this.decryptNote(n)));
  }

  async moveToBook(noteId: string, bookId: string): Promise<void> {
    const { error } = await this.db
      .from('notes')
      .update({ book_id: bookId })
      .eq('id', noteId);
    if (error) throw error;
  }

  async create(bookId: string, title = 'Sin título'): Promise<Note> {
    const { data, error } = await this.db
      .from('notes')
      .insert({ book_id: bookId, title, content: '' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, changes: Partial<Pick<Note, 'title' | 'content'>>): Promise<Note> {
    const dbChanges: Record<string, unknown> = {};
    if (changes.title !== undefined) dbChanges['title'] = changes.title;

    const plainContent = changes.content;
    if (plainContent !== undefined) {
      dbChanges['content'] = await this.crypto.encrypt(plainContent);
      dbChanges['blind_index'] = await this.crypto.buildBlindIndex(plainContent);
    }

    const { data, error } = await this.db
      .from('notes')
      .update(dbChanges)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    return { ...data, content: plainContent ?? await this.crypto.decrypt(data.content) };
  }

  private async decryptNote(note: Note): Promise<Note> {
    if (!this.crypto.isReady()) return note;
    try {
      const content = await this.crypto.decrypt(note.content);
      return { ...note, content };
    } catch {
      return note;
    }
  }

  async markAsRead(id: string): Promise<void> {
    const { error } = await this.db
      .from('notes')
      .update({ last_read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async countAll(): Promise<number> {
    const privId = this.privBook.privBookId();
    let q = this.db.from('notes').select('id', { count: 'exact', head: true });
    if (privId) q = q.neq('book_id', privId);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('notes').delete().eq('id', id);
    if (error) throw error;
  }
}
