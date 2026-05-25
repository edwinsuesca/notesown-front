import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../core/supabase/supabase.service';
import type { Book } from '../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class BooksRepository {
  private readonly db = inject(SupabaseService).client;

  async getAll(): Promise<Book[]> {
    const { data, error } = await this.db
      .from('books')
      .select('*')
      .neq('title', '__priv__')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async findPrivBook(): Promise<Book | null> {
    const { data } = await this.db
      .from('books')
      .select('*')
      .eq('title', '__priv__')
      .single();
    return data ?? null;
  }

  async create(title: string, icon = 'pi pi-book'): Promise<Book> {
    const { data, error } = await this.db
      .from('books')
      .insert({ title, icon })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(id: string, changes: Partial<Pick<Book, 'title' | 'icon'>>): Promise<Book> {
    const { data, error } = await this.db
      .from('books')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('books').delete().eq('id', id);
    if (error) throw error;
  }
}
