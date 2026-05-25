import { Component, ChangeDetectionStrategy, input, output, inject, computed } from '@angular/core';
import type { Note } from '../../../core/supabase/database.types';
import { BooksStateService } from '../../../books/books-state.service';

@Component({
  selector: 'app-note-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './note-item.component.html',
  styleUrl: './note-item.component.css',
})
export class NoteItemComponent {
  readonly note = input.required<Note>();
  readonly isActive = input(false);
  readonly metaDate = input.required<string>();
  readonly canDelete = input(false);
  readonly testId = input('');
  readonly showBook = input(false);

  private readonly booksState = inject(BooksStateService);

  protected readonly bookTitle = computed(() => {
    if (!this.showBook()) return '';
    const bookId = this.note().book_id;
    return this.booksState.getBookById(bookId)?.title ?? '';
  });

  readonly noteClick = output<Note>();
  readonly deleteClick = output<{ note: Note; event: MouseEvent }>();

  protected onNoteClick(): void {
    this.noteClick.emit(this.note());
  }

  protected onDeleteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.deleteClick.emit({ note: this.note(), event });
  }

  protected stripHtml(html: string): string {
    const spaced = html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|li|h[1-6]|div|blockquote|tr|td|th)>/gi, ' ');
    const div = document.createElement('div');
    div.innerHTML = spaced;
    return (div.textContent ?? div.innerText ?? '').replace(/\s+/g, ' ').trim();
  }

  protected formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'hace menos de un minuto';
    if (mins < 60) return `hace ${mins} minuto${mins > 1 ? 's' : ''}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `hace ${days} día${days > 1 ? 's' : ''}`;
  }
}
