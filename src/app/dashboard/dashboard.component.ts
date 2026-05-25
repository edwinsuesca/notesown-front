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
  protected readonly recentNotes = signal<Note[]>([]);
  protected readonly modifiedTodayCount = signal(0);

  protected readonly booksCount = computed(() => this.booksState.books().length);

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
        this.notesRepo.getRecentlyRead(10),
        this.notesRepo.getRecentlyModified(10),
      ]);
      this.totalNotes.set(total);

      // Calcular modificadas hoy a partir del listado completo
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayCount = modified.filter(n => new Date(n.updated_at) >= today).length;
      this.modifiedTodayCount.set(todayCount);

      // Obtener recencia máxima: max(last_read_at, updated_at)
      const getRecentTime = (n: Note) => Math.max(
        new Date(n.last_read_at || 0).getTime(),
        new Date(n.updated_at).getTime()
      );

      // Combinar listas y remover duplicados
      const seen = new Set<string>();
      const combined = [...read, ...modified].filter(n => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

      // Ordenar por fecha de recencia descendente
      combined.sort((a, b) => getRecentTime(b) - getRecentTime(a));

      // Asignar el top 5
      this.recentNotes.set(combined.slice(0, 5));
    } finally {
      this.isLoadingStats.set(false);
    }
  }

  protected getRecentDate(note: Note): string {
    const readTime = new Date(note.last_read_at || 0).getTime();
    const modTime = new Date(note.updated_at).getTime();
    return readTime > modTime ? (note.last_read_at || note.updated_at) : note.updated_at;
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
