import { Injectable, signal } from '@angular/core';
import type { Book } from '../core/supabase/database.types';

@Injectable({ providedIn: 'root' })
export class BooksStateService {
  private readonly _books = signal<Book[]>([]);
  readonly books = this._books.asReadonly();

  setBooks(books: Book[]): void {
    this._books.set(books);
  }

  updateBook(updated: Book): void {
    this._books.update(list => list.map(b => b.id === updated.id ? updated : b));
  }

  addBook(book: Book): void {
    this._books.update(list => [...list, book]);
  }

  removeBook(bookId: string): void {
    this._books.update(list => list.filter(b => b.id !== bookId));
  }

  getBookById(id: string): Book | null {
    return this._books().find(b => b.id === id) ?? null;
  }

  clear(): void {
    this._books.set([]);
  }
}
