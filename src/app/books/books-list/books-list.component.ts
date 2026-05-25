import {
  Component, ChangeDetectionStrategy, inject, signal,
  OnInit, effect
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ResponsiveService } from '../../core/responsive/responsive.service';
import { ButtonModule } from 'primeng/button';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SkeletonModule } from 'primeng/skeleton';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { NoteItemComponent } from '../../shared/components/note-item/note-item.component';
import { BooksRepository } from '../books.repository';
import { BooksStateService } from '../books-state.service';
import { NotesRepository } from '../../notes/notes.repository';
import { EditorStateService } from '../../core/editor-state/editor-state.service';
import type { Book, Note } from '../../core/supabase/database.types';

@Component({
  selector: 'app-books-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonModule, SkeletonModule, EmptyStateComponent, NoteItemComponent,
  ],
  templateUrl: './books-list.component.html',
  styleUrl: './books-list.component.css',
})
export class BooksListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly booksRepo = inject(BooksRepository);
  private readonly booksState = inject(BooksStateService);
  private readonly notesRepo = inject(NotesRepository);
  protected readonly messageService = inject(MessageService);
  private readonly responsive = inject(ResponsiveService);
  private readonly confirmationService = inject(ConfirmationService);
  protected readonly editorState = inject(EditorStateService);

  protected readonly book = signal<Book | null>(null);
  protected readonly notes = signal<Note[]>([]);
  protected readonly isLoadingNotes = signal(false);
  protected readonly isCreatingNote = signal(false);

  constructor() {
    effect(() => {
      const deletedId = this.editorState.deletedNoteId();
      if (!deletedId) return;
      const remaining = this.notes().filter(n => n.id !== deletedId);
      this.notes.set(remaining);
      if (remaining.length > 0) {
        this.editorState.selectNote(remaining[0]);
      }
    });

    effect(() => {
      const saved = this.editorState.savedNote();
      if (!saved) return;
      this.notes.update(list => list.map(n => n.id === saved.id ? saved : n));
    });

    effect(() => {
      const currentBookId = this.book()?.id;
      if (!currentBookId) return;
      const updatedBook = this.booksState.getBookById(currentBookId);
      if (updatedBook && updatedBook.id === currentBookId) {
        this.book.set(updatedBook);
      }
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(async params => {
      const bookId = params['bookId'];
      if (bookId) {
        await this.loadBook(bookId);
        await this.loadNotes(bookId);
        if (this.notes().length > 0 && !this.responsive.isMobile()) {
          this.editorState.selectNote(this.notes()[0]);
        } else {
          this.editorState.clearSelection();
        }
      }
    });

    this.route.queryParams.subscribe(async params => {
      if (params['newNote']) {
        const bookId = this.route.snapshot.params['bookId'];
        if (bookId) await this.createNote(bookId);
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
  }

  private async loadBook(bookId: string): Promise<void> {
    try {
      const book = this.booksState.getBookById(bookId);
      this.book.set(book);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el libro' });
    }
  }

  private async loadNotes(bookId: string): Promise<void> {
    this.isLoadingNotes.set(true);
    try {
      const notes = await this.notesRepo.getByBook(bookId);
      this.notes.set(notes);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las notas' });
    } finally {
      this.isLoadingNotes.set(false);
    }
  }

  protected selectNote(note: Note): void {
    if (this.responsive.isMobile()) {
      this.router.navigate(['/app/notes', note.id]);
    } else {
      this.editorState.selectNote(note);
      this.router.navigate(['/app/books', note.book_id], { replaceUrl: true });
    }
  }

  protected async createNote(bookId: string): Promise<void> {
    this.isCreatingNote.set(true);
    try {
      const note = await this.notesRepo.create(bookId);
      this.notes.update(list => [note, ...list]);
      this.selectNote(note);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la nota' });
    } finally {
      this.isCreatingNote.set(false);
    }
  }

  protected confirmDeleteNote(note: Note, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `¿Eliminar la nota "${note.title || 'Sin título'}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteNote(note),
    });
  }

  private async deleteNote(note: Note): Promise<void> {
    try {
      await this.notesRepo.delete(note.id);
      const remaining = this.notes().filter(n => n.id !== note.id);
      this.notes.set(remaining);
      if (this.editorState.selectedNote()?.id === note.id) {
        if (remaining.length > 0) {
          this.editorState.selectNote(remaining[0]);
        } else {
          this.editorState.clearSelection();
        }
      }
      this.messageService.add({ severity: 'success', summary: 'Nota eliminada' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la nota' });
    }
  }

}
