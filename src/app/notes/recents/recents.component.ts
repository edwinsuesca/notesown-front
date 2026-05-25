import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NotesRepository } from '../notes.repository';
import { ResponsiveService } from '../../core/responsive/responsive.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { NoteItemComponent } from '../../shared/components/note-item/note-item.component';
import { EditorStateService } from '../../core/editor-state/editor-state.service';
import type { Note } from '../../core/supabase/database.types';

@Component({
  selector: 'app-recents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, NoteItemComponent],
  templateUrl: './recents.component.html',
  styleUrl: './recents.component.css',
})
export class RecentsComponent implements OnInit {
  private readonly notesRepo = inject(NotesRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly responsive = inject(ResponsiveService);
  protected readonly editorState = inject(EditorStateService);

  protected readonly notes = signal<Note[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly mode = signal<'read' | 'modified'>('read');

  ngOnInit(): void {
    const mode = this.route.snapshot.data['mode'] as 'read' | 'modified';
    this.mode.set(mode ?? 'read');
    this.loadNotes();
  }

  private async loadNotes(): Promise<void> {
    this.isLoading.set(true);
    try {
      const notes = this.mode() === 'read'
        ? await this.notesRepo.getRecentlyRead()
        : await this.notesRepo.getRecentlyModified();
      this.notes.set(notes);
    } finally {
      this.isLoading.set(false);
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
