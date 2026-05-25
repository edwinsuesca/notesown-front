import {
  Component, ChangeDetectionStrategy, inject, signal, computed, OnInit,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { BooksStateService } from '../books/books-state.service';
import { NotesRepository } from '../notes/notes.repository';
import { SupabaseAuthService } from '../core/auth/supabase-auth.service';
import { ResponsiveService } from '../core/responsive/responsive.service';
import { ShellActionsService } from '../core/shell-actions/shell-actions.service';
import { NoteItemComponent } from '../shared/components/note-item/note-item.component';
import type { Note } from '../core/supabase/database.types';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonModule, SkeletonModule, NoteItemComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly notesRepo = inject(NotesRepository);
  private readonly router = inject(Router);
  private readonly shellActions = inject(ShellActionsService);
  protected readonly booksState = inject(BooksStateService);
  protected readonly auth = inject(SupabaseAuthService);
  protected readonly responsive = inject(ResponsiveService);

  protected readonly isLoadingStats = signal(true);
  protected readonly totalNotes = signal(0);
  protected readonly recentRead = signal<Note[]>([]);
  protected readonly recentModified = signal<Note[]>([]);

  protected readonly booksCount = computed(() => this.booksState.books().length);

  protected readonly modifiedTodayCount = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.recentModified().filter(n => new Date(n.updated_at) >= today).length;
  });

  protected readonly userFirstName = computed(() => {
    const email = this.auth.currentUser()?.email ?? '';
    return email.split('@')[0];
  });

  ngOnInit(): void {
    this.loadStats();
  }

  private async loadStats(): Promise<void> {
    this.isLoadingStats.set(true);
    try {
      const [total, read, modified] = await Promise.all([
        this.notesRepo.countAll(),
        this.notesRepo.getRecentlyRead(5),
        this.notesRepo.getRecentlyModified(5),
      ]);
      this.totalNotes.set(total);
      this.recentRead.set(read);
      this.recentModified.set(modified);
    } finally {
      this.isLoadingStats.set(false);
    }
  }

  protected openNote(note: Note): void {
    this.router.navigate(['/app', note.book_id, note.id]);
  }

  protected createNote(): void {
    if (this.booksState.books().length === 0) {
      this.shellActions.openCreateBook.set(true);
    } else {
      this.shellActions.openCreateNote.set(true);
    }
  }

  protected createBook(): void {
    this.shellActions.openCreateBook.set(true);
  }
}
