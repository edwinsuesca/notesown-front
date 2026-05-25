import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { EditorModule } from 'primeng/editor';
import { DialogModule } from 'primeng/dialog';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { MessageModule } from 'primeng/message';
import { TooltipModule } from 'primeng/tooltip';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import type { MenuItem } from 'primeng/api';
import { ConfirmationService, MessageService } from 'primeng/api';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { EditorStateService } from '../../core/editor-state/editor-state.service';
import { NotesRepository } from '../../notes/notes.repository';
import { PrivBookService } from '../../core/private/priv-book.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { BooksStateService } from '../../books/books-state.service';
import type { Note } from '../../core/supabase/database.types';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, ButtonModule, EditorModule, EmptyStateComponent,
    DialogModule, PasswordModule, SelectModule, MessageModule, TooltipModule,
    MenuModule,
  ],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.css',
})
export class NoteEditorComponent {
  private readonly notesRepo = inject(NotesRepository);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly privBook = inject(PrivBookService);
  private readonly crypto = inject(CryptoService);
  private readonly auth = inject(SupabaseAuthService);
  private readonly router = inject(Router);
  protected readonly messageService = inject(MessageService);
  protected readonly state = inject(EditorStateService);
  protected readonly booksState = inject(BooksStateService);

  protected readonly editorModules = {};

  protected readonly isPrivNote = computed(() =>
    !!this.state.selectedNote() &&
    this.state.selectedNote()!.book_id === this.privBook.privBookId()
  );

  protected readonly showPrivatizeDialog = signal(false);
  protected readonly showUnprivatizeDialog = signal(false);
  protected readonly privPassword = signal('');
  protected readonly privError = signal('');
  protected readonly privLoading = signal(false);
  protected readonly targetBookId = signal<string | null>(null);

  protected readonly noteMenuItems = computed<MenuItem[]>(() => {
    const items: MenuItem[] = [];
    
    if (this.isPrivNote()) {
      items.push({
        label: 'Quitar privacidad',
        icon: 'pi pi-lock-open',
        command: () => this.openUnprivatizeDialog(),
      });
    } else {
      items.push({
        label: 'Hacer privada',
        icon: 'pi pi-lock',
        command: () => this.openPrivatizeDialog(),
      });
    }
    
    items.push({
      label: 'Eliminar nota',
      icon: 'pi pi-trash',
      styleClass: 'nw-menu-danger',
      command: (e) => this.confirmDeleteNote(e.originalEvent as Event),
    });
    
    return items;
  });

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

  protected confirmDeleteNote(event: Event): void {
    const note = this.state.selectedNote();
    if (!note) return;
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
      this.state.clearSelection();
      this.router.navigate(['/app']);
      this.messageService.add({ severity: 'success', summary: 'Nota eliminada' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar la nota' });
    }
  }

  protected openPrivatizeDialog(): void {
    this.privPassword.set('');
    this.privError.set('');
    this.showPrivatizeDialog.set(true);
  }

  protected async confirmPrivatize(): Promise<void> {
    const note = this.state.selectedNote();
    if (!note) return;
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;

    this.privLoading.set(true);
    this.privError.set('');
    try {
      const ok = await this.crypto.verifyPassword(this.privPassword(), userId);
      if (!ok) {
        this.privError.set('Contraseña incorrecta');
        return;
      }
      const privBookId = await this.privBook.getOrCreate();
      await this.notesRepo.moveToBook(note.id, privBookId);
      this.showPrivatizeDialog.set(false);
      this.state.clearSelection();
      this.router.navigate(['/app']);
      this.messageService.add({ severity: 'success', summary: 'Nota privada', detail: 'La nota ahora es privada' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo privatizar la nota' });
    } finally {
      this.privLoading.set(false);
    }
  }

  protected openUnprivatizeDialog(): void {
    this.privPassword.set('');
    this.privError.set('');
    this.targetBookId.set(null);
    this.showUnprivatizeDialog.set(true);
  }

  protected openNoteMenu(event: Event, menu: Menu): void {
    event.preventDefault();
    event.stopPropagation();
    menu.toggle(event);
  }

  protected async confirmUnprivatize(): Promise<void> {
    const note = this.state.selectedNote();
    if (!note) return;
    const userId = this.auth.currentUser()?.id;
    if (!userId) return;
    const targetId = this.targetBookId();
    if (!targetId) {
      this.privError.set('Selecciona un libro destino');
      return;
    }

    this.privLoading.set(true);
    this.privError.set('');
    try {
      const ok = await this.crypto.verifyPassword(this.privPassword(), userId);
      if (!ok) {
        this.privError.set('Contraseña incorrecta');
        return;
      }
      await this.notesRepo.moveToBook(note.id, targetId);
      this.showUnprivatizeDialog.set(false);
      this.state.clearSelection();
      this.router.navigate(['/app']);
      this.messageService.add({ severity: 'success', summary: 'Nota movida', detail: 'La nota ya no es privada' });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo quitar la privacidad' });
    } finally {
      this.privLoading.set(false);
    }
  }
}
