import {
  Component, ChangeDetectionStrategy, inject, signal, computed, ViewChild, effect,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { DividerModule } from 'primeng/divider';
import { DrawerModule } from 'primeng/drawer';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TieredMenuModule } from 'primeng/tieredmenu';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { ConfirmationService, MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { TieredMenu } from 'primeng/tieredmenu';
import { FormsModule } from '@angular/forms';
import { ThemeToggleComponent } from '../shared/components/theme-toggle/theme-toggle.component';
import { NoteEditorComponent } from '../books/note-editor/note-editor.component';
import { NoteItemComponent } from '../shared/components/note-item/note-item.component';
import { EmptyStateComponent } from '../shared/components/empty-state/empty-state.component';
import { EditorStateService } from '../core/editor-state/editor-state.service';
import { SupabaseAuthService } from '../core/auth/supabase-auth.service';
import { BooksRepository } from '../books/books.repository';
import { NotesRepository } from '../notes/notes.repository';
import { BooksStateService } from '../books/books-state.service';
import { ResponsiveService } from '../core/responsive/responsive.service';
import { PrivBookService, PRIV_BOOK_TITLE } from '../core/private/priv-book.service';
import { ShellActionsService } from '../core/shell-actions/shell-actions.service';
import type { Book, Note } from '../core/supabase/database.types';

const SECONDARY_ROUTES = ['search', 'recent-read', 'recent-modified', 'settings'];

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet,
    ButtonModule, TooltipModule, DialogModule, DividerModule, DrawerModule,
    BreadcrumbModule, TieredMenuModule, MenuModule,
    InputTextModule, ConfirmDialogModule, ToastModule, SelectModule,
    FormsModule, ThemeToggleComponent, NoteEditorComponent, NoteItemComponent, EmptyStateComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly authService = inject(SupabaseAuthService);
  private readonly booksRepo = inject(BooksRepository);
  private readonly notesRepo = inject(NotesRepository);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly responsive = inject(ResponsiveService);
  private readonly confirmationService = inject(ConfirmationService);
  protected readonly messageService = inject(MessageService);
  protected readonly editorState = inject(EditorStateService);
  protected readonly booksState = inject(BooksStateService);
  private readonly privBookService = inject(PrivBookService);
  private readonly shellActions = inject(ShellActionsService);

  @ViewChild('notesMenu') notesMenu!: TieredMenu;
  protected readonly bookMenuItems = signal<MenuItem[]>([]);

  protected readonly books = this.booksState.books;
  protected readonly isLoadingBooks = signal(true);

  protected readonly showBookDialog = signal(false);
  protected readonly bookDialogMode = signal<'create' | 'rename'>('create');
  protected readonly bookTitle = signal('');
  protected readonly bookIcon = signal('pi pi-book');
  protected readonly renamingBook = signal<Book | null>(null);
  protected readonly isSavingBook = signal(false);
  protected readonly drawerVisible = signal(false);

  protected readonly showCreateNoteDialog = signal(false);
  protected readonly newNoteTitle = signal('');
  protected readonly newNoteBookId = signal<string | null>(null);
  protected readonly isSavingNewNote = signal(false);

  protected readonly currentBookId = signal<string | null>(null);
  protected readonly currentNoteId = signal<string | null>(null);
  protected readonly currentBook = signal<Book | null>(null);
  protected readonly bookNotes = signal<Note[]>([]);
  protected readonly isLoadingNotes = signal(false);
  protected readonly isCreatingNote = signal(false);
  protected readonly bookNotFound = signal(false);
  protected readonly noteNotFound = signal(false);
  protected readonly routeSegment = signal<string>('');

  protected readonly availableIcons = [
    'pi pi-book', 'pi pi-bookmark', 'pi pi-star', 'pi pi-heart',
    'pi pi-briefcase', 'pi pi-home', 'pi pi-code', 'pi pi-lightbulb',
    'pi pi-pencil', 'pi pi-folder', 'pi pi-tag', 'pi pi-globe', 'pi pi-key',
  ];

  protected readonly homeItem: MenuItem = {
    icon: 'pi pi-home',
    command: () => this.router.navigate(['/app']),
  };

  protected readonly breadcrumbItems = computed<MenuItem[]>(() => {
    const note = this.editorState.selectedNote();
    const book = this.currentBook();
    if (!note || !book) return [];
    return [
      {
        label: book.title,
        command: () => this.router.navigate(['/app', book.id]),
      },
      { label: note.title || 'Sin título' },
    ];
  });

  protected readonly notesMenuItems = computed<MenuItem[]>(() => {
    const book = this.currentBook();
    return [{
      label: book?.title ?? 'Notas',
      items: this.bookNotes().map(n => ({
        label: n.title || 'Sin título',
        icon: this.editorState.selectedNote()?.id === n.id ? 'pi pi-check' : 'pi pi-file',
        command: () => this.router.navigate(['/app', n.book_id, n.id]),
      })),
    }];
  });

  constructor() {
    this.loadBooks();

    effect(() => {
      if (this.shellActions.openCreateBook()) {
        this.shellActions.openCreateBook.set(false);
        this.openCreateBookDialog();
      }
    });

    effect(() => {
      if (this.shellActions.openCreateNote()) {
        this.shellActions.openCreateNote.set(false);
        this.openCreateNoteDialog();
      }
    });

    effect(() => {
      if (this.shellActions.reloadData()) {
        this.shellActions.reloadData.set(false);
        this.reloadAll();
      }
    });

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => {
      this.drawerVisible.set(false);
      this.routeSegment.set(this.route.firstChild?.snapshot.url[0]?.path ?? '');
      if (!this.isLoadingBooks()) {
        this.refreshRouteParams();
      }
    });

    effect(() => {
      const deletedId = this.editorState.deletedNoteId();
      if (!deletedId) return;
      const remaining = this.bookNotes().filter(n => n.id !== deletedId);
      this.bookNotes.set(remaining);
      const bookId = this.currentBookId();
      if (!bookId) return;
      if (remaining.length > 0) {
        this.router.navigate(['/app', bookId, remaining[0].id], { replaceUrl: true });
      } else {
        this.router.navigate(['/app', bookId], { replaceUrl: true });
      }
    });

    effect(() => {
      const saved = this.editorState.savedNote();
      if (!saved) return;
      this.bookNotes.update(list => list.map(n => n.id === saved.id ? saved : n));
    });
  }

  private refreshRouteParams(): void {
    const firstChild = this.route.firstChild;
    const bookId = firstChild?.snapshot.paramMap.get('bookId') ?? null;
    const noteId = firstChild?.snapshot.paramMap.get('noteId') ?? null;

    const prevBookId = this.currentBookId();
    const prevNoteId = this.currentNoteId();

    this.currentBookId.set(bookId);
    this.currentNoteId.set(noteId);

    if (bookId) {
      if (bookId !== prevBookId) {
        this.loadNotesForBook(bookId);
      }
      if (noteId && noteId !== prevNoteId) {
        this.loadNoteForEditor(noteId);
      }
      if (!noteId && prevNoteId) {
        this.editorState.clearSelection();
        this.noteNotFound.set(false);
      }
    } else {
      if (prevBookId) {
        this.currentBook.set(null);
        this.bookNotes.set([]);
        this.bookNotFound.set(false);
        this.noteNotFound.set(false);
        this.editorState.clearSelection();
      }
    }
  }

  private async reloadAll(): Promise<void> {
    const currentBookId = this.currentBookId();
    await this.loadBooks();
    if (currentBookId) {
      await this.loadNotesForBook(currentBookId);
    }
  }

  private async loadBooks(): Promise<void> {
    try {
      const books = await this.booksRepo.getAll();
      this.booksState.setBooks(books);
      await this.privBookService.load();
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los libros' });
    } finally {
      this.isLoadingBooks.set(false);
      this.routeSegment.set(this.route.firstChild?.snapshot.url[0]?.path ?? '');
      this.refreshRouteParams();
    }
  }

  private async loadNotesForBook(bookId: string): Promise<void> {
    this.bookNotFound.set(false);
    this.noteNotFound.set(false);
    this.isLoadingNotes.set(true);
    this.bookNotes.set([]);
    this.editorState.clearSelection();

    const book = this.booksState.getBookById(bookId) ?? null;
    this.currentBook.set(book);

    if (!book) {
      this.bookNotFound.set(true);
      this.isLoadingNotes.set(false);
      return;
    }

    try {
      const notes = await this.notesRepo.getByBook(bookId);
      this.bookNotes.set(notes);
      const noteId = this.currentNoteId();
      if (!noteId && notes.length > 0 && !this.responsive.isMobile()) {
        this.router.navigate(['/app', bookId, notes[0].id], { replaceUrl: true });
      }
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las notas' });
    } finally {
      this.isLoadingNotes.set(false);
    }
  }

  private async loadNoteForEditor(noteId: string): Promise<void> {
    this.noteNotFound.set(false);
    try {
      const note = await this.notesRepo.getById(noteId);
      if (note.book_id === this.privBookService.privBookId() && !this.privBookService.privUnlocked()) {
        this.noteNotFound.set(true);
        this.editorState.clearSelection();
        return;
      }
      this.editorState.selectNote(note);
    } catch {
      this.noteNotFound.set(true);
      this.editorState.clearSelection();
    }
  }

  protected selectNote(note: Note): void {
    if (this.responsive.isMobile()) {
      this.router.navigate(['/app', note.book_id, note.id]);
    } else {
      this.router.navigate(['/app', note.book_id, note.id], { replaceUrl: true });
    }
  }

  protected async createNote(): Promise<void> {
    const bookId = this.currentBookId();
    if (!bookId) return;
    this.isCreatingNote.set(true);
    try {
      const note = await this.notesRepo.create(bookId);
      this.bookNotes.update(list => [note, ...list]);
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
    const bookId = this.currentBookId();
    try {
      await this.notesRepo.delete(note.id);
      const remaining = this.bookNotes().filter(n => n.id !== note.id);
      this.bookNotes.set(remaining);
      this.messageService.add({ severity: 'success', summary: 'Nota eliminada' });
      if (this.currentNoteId() === note.id) {
        if (remaining.length > 0 && bookId) {
          this.router.navigate(['/app', bookId, remaining[0].id], { replaceUrl: true });
        } else if (bookId) {
          this.router.navigate(['/app', bookId], { replaceUrl: true });
        }
      }
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la nota' });
    }
  }

  protected openCreateBookDialog(): void {
    this.bookDialogMode.set('create');
    this.bookTitle.set('');
    this.bookIcon.set('pi pi-book');
    this.showBookDialog.set(true);
  }

  protected openRenameBookDialog(book: Book): void {
    this.bookDialogMode.set('rename');
    this.bookTitle.set(book.title);
    this.bookIcon.set(book.icon);
    this.renamingBook.set(book);
    this.showBookDialog.set(true);
  }

  protected async saveBook(): Promise<void> {
    const title = this.bookTitle().trim();
    if (!title) return;
    if (title === PRIV_BOOK_TITLE) {
      this.messageService.add({ severity: 'error', summary: 'Nombre reservado', detail: `El nombre "${PRIV_BOOK_TITLE}" está reservado por el sistema` });
      return;
    }
    this.isSavingBook.set(true);
    try {
      if (this.bookDialogMode() === 'create') {
        const book = await this.booksRepo.create(title, this.bookIcon());
        this.booksState.addBook(book);
        this.router.navigate(['/app', book.id]);
        this.messageService.add({ severity: 'success', summary: 'Libro creado', detail: title });
      } else {
        const book = this.renamingBook()!;
        const updated = await this.booksRepo.update(book.id, { title, icon: this.bookIcon() });
        this.booksState.updateBook(updated);
        if (this.currentBook()?.id === updated.id) this.currentBook.set(updated);
        this.messageService.add({ severity: 'success', summary: 'Libro actualizado', detail: title });
      }
      this.showBookDialog.set(false);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el libro' });
    } finally {
      this.isSavingBook.set(false);
    }
  }

  protected confirmDeleteBook(book: Book, event: Event): void {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `¿Eliminar el libro "${book.title}" y todas sus notas?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.deleteBook(book),
    });
  }

  private async deleteBook(book: Book): Promise<void> {
    try {
      await this.booksRepo.delete(book.id);
      this.booksState.removeBook(book.id);
      this.messageService.add({ severity: 'success', summary: 'Libro eliminado', detail: book.title });
      this.router.navigate(['/app']);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar el libro' });
    }
  }

  protected toggleNotesMenu(event: Event): void {
    this.notesMenu.toggle(event);
  }

  protected openBookMenu(book: Book, event: MouseEvent, menu: Menu): void {
    event.preventDefault();
    event.stopPropagation();
    console.log(book);
    this.bookMenuItems.set([
      {
        label: 'Renombrar',
        icon: 'pi pi-pencil',
        command: () => this.openRenameBookDialog(book),
      },
      {
        label: 'Eliminar',
        icon: 'pi pi-trash',
        styleClass: 'nw-menu-danger',
        command: (e) => this.confirmDeleteBook(book, e.originalEvent as MouseEvent),
      },
    ]);
    menu.toggle(event);
  }

  protected userEmail(): string {
    return this.authService.currentUser()?.email ?? '';
  }

  protected readonly isSecondaryRoute = computed(() => SECONDARY_ROUTES.includes(this.routeSegment()));
  protected readonly isSettingsRoute = computed(() => this.routeSegment() === 'settings');
  protected readonly isDashboardRoute = computed(() => this.routeSegment() === '' && !this.currentBookId());
  protected readonly showEditorPanel = computed(() => !this.isSettingsRoute() && !this.isDashboardRoute());
  protected readonly showOutlet = computed(() => this.isSecondaryRoute() || this.isDashboardRoute());

  protected readonly secondaryBreadcrumb = computed<MenuItem[]>(() => {
    const labels: Record<string, string> = {
      'search': 'Buscar',
      'recent-read': 'Recientes leídos',
      'recent-modified': 'Recientes modificados',
      'settings': 'Ajustes',
    };
    const label = labels[this.routeSegment()];
    return label ? [{ label }] : [];
  });

  protected readonly mobileTopbarTitle = computed(() => {
    const labels: Record<string, string> = {
      'search': 'Buscar',
      'recent-read': 'Recientes leídos',
      'recent-modified': 'Recientes modificados',
      'settings': 'Ajustes',
    };
    if (this.isSecondaryRoute()) return labels[this.routeSegment()] ?? '';
    return this.currentBook()?.title ?? '';
  });

  protected isBookActive(bookId: string): boolean {
    return this.currentBookId() === bookId;
  }

  protected navigateBack(): void {
    this.router.navigate(['/app']);
  }

  protected openCreateNoteDialog(): void {
    const books = this.booksState.books();
    const preselected = this.currentBookId()
      ?? this.booksState.books()[0]?.id
      ?? null;
    this.newNoteTitle.set('');
    this.newNoteBookId.set(preselected);
    this.showCreateNoteDialog.set(true);
  }

  protected async saveNewNote(): Promise<void> {
    const bookId = this.newNoteBookId();
    if (!bookId) return;
    this.isSavingNewNote.set(true);
    try {
      const title = this.newNoteTitle().trim() || 'Sin título';
      const note = await this.notesRepo.create(bookId, title);
      if (this.currentBookId() === bookId) {
        this.bookNotes.update(list => [note, ...list]);
      }
      this.selectNote(note);
      this.showCreateNoteDialog.set(false);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear la nota' });
    } finally {
      this.isSavingNewNote.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cerrar sesión' });
    }
  }
}
