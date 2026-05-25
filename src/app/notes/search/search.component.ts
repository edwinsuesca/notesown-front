import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { NotesRepository } from '../notes.repository';
import { ResponsiveService } from '../../core/responsive/responsive.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { NoteItemComponent } from '../../shared/components/note-item/note-item.component';
import { EditorStateService } from '../../core/editor-state/editor-state.service';
import { CryptoService } from '../../core/crypto/crypto.service';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { PrivBookService } from '../../core/private/priv-book.service';
import type { Note } from '../../core/supabase/database.types';

const PRIV_RE = /^priv:(.+)$/;
const DEBOUNCE_NORMAL = 400;
const DEBOUNCE_PRIV = 1500;

@Component({
  selector: 'app-search',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ButtonModule, InputTextModule, SkeletonModule, EmptyStateComponent, NoteItemComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.css',
})
export class SearchComponent {
  private readonly notesRepo = inject(NotesRepository);
  private readonly router = inject(Router);
  private readonly responsive = inject(ResponsiveService);
  private readonly crypto = inject(CryptoService);
  private readonly auth = inject(SupabaseAuthService);
  private readonly privBook = inject(PrivBookService);
  protected readonly editorState = inject(EditorStateService);

  protected readonly query = signal('');
  protected readonly results = signal<Note[]>([]);
  protected readonly isSearching = signal(false);
  protected readonly hasSearched = signal(false);
  protected readonly isPrivMode = signal(false);
  protected readonly privError = signal('');

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private privVerifyVersion = 0;

  protected onQueryChange(value: string): void {
    this.query.set(value);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (!value.trim()) {
      this.results.set([]);
      this.hasSearched.set(false);
      this.isPrivMode.set(false);
      this.privError.set('');
      return;
    }
    const privMatch = PRIV_RE.exec(value.trim());
    if (privMatch) {
      this.isPrivMode.set(true);
      this.privError.set('');
      const password = privMatch[1];
      this.debounceTimer = setTimeout(() => this.searchPrivate(password), DEBOUNCE_PRIV);
    } else {
      this.isPrivMode.set(false);
      this.privError.set('');
      this.debounceTimer = setTimeout(() => this.searchNormal(), DEBOUNCE_NORMAL);
    }
  }

  private async searchNormal(): Promise<void> {
    this.isSearching.set(true);
    try {
      const results = await this.notesRepo.search(this.query().trim());
      this.results.set(results);
      this.hasSearched.set(true);
    } finally {
      this.isSearching.set(false);
    }
  }

  private async searchPrivate(password: string): Promise<void> {
    const version = ++this.privVerifyVersion;
    this.isSearching.set(true);
    this.privError.set('');

    try {
      const userId = this.auth.currentUser()?.id;
      if (!userId) return;

      const ok = await this.crypto.verifyPassword(password, userId);
      if (version !== this.privVerifyVersion) return;

      if (!ok) {
        this.privBook.privUnlocked.set(false);
        this.privError.set('Contraseña incorrecta');
        this.results.set([]);
        this.hasSearched.set(true);
        return;
      }

      this.privBook.privUnlocked.set(true);
      const privId = this.privBook.privBookId();
      if (!privId) {
        this.results.set([]);
        this.hasSearched.set(true);
        return;
      }

      const notes = await this.notesRepo.getByBook(privId);
      if (version !== this.privVerifyVersion) return;

      this.results.set(notes);
      this.hasSearched.set(true);
    } finally {
      if (version === this.privVerifyVersion) {
        this.isSearching.set(false);
      }
    }
  }

  protected openNote(note: Note): void {
    if (this.responsive.isMobile()) {
      this.router.navigate(['/app', note.book_id, note.id]);
    } else {
      this.editorState.selectNote(note);
    }
  }

}
