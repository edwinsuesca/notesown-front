import { Injectable, inject, signal } from '@angular/core';
import { BooksRepository } from '../../books/books.repository';

export const PRIV_BOOK_TITLE = '__priv__';

@Injectable({ providedIn: 'root' })
export class PrivBookService {
  private readonly booksRepo = inject(BooksRepository);

  readonly privBookId = signal<string | null>(null);
  readonly privUnlocked = signal(false);

  async load(): Promise<void> {
    const book = await this.booksRepo.findPrivBook();
    if (book) {
      this.privBookId.set(book.id);
    }
  }

  async getOrCreate(): Promise<string> {
    const existing = await this.booksRepo.findPrivBook();
    if (existing) {
      this.privBookId.set(existing.id);
      return existing.id;
    }
    const created = await this.booksRepo.create(PRIV_BOOK_TITLE, 'pi pi-lock');
    this.privBookId.set(created.id);
    return created.id;
  }

  clear(): void {
    this.privBookId.set(null);
    this.privUnlocked.set(false);
  }
}
