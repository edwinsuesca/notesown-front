import { Injectable, inject, signal } from '@angular/core';
import { NotesRepository } from '../../notes/notes.repository';
import type { Note } from '../supabase/database.types';

@Injectable({ providedIn: 'root' })
export class EditorStateService {
  private readonly notesRepo = inject(NotesRepository);

  readonly selectedNote = signal<Note | null>(null);
  readonly noteTitle = signal('');
  readonly noteContent = signal('');
  readonly saveIndicator = signal<'idle' | 'saving' | 'saved'>('idle');

  readonly deletedNoteId = signal<string | null>(null);
  readonly savedNote = signal<Note | null>(null);

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private _loadedTitle = '';
  private _loadedContent = '';

  selectNote(note: Note): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this._loadedTitle = note.title;
    this._loadedContent = note.content;
    this.selectedNote.set(note);
    this.noteTitle.set(note.title);
    this.noteContent.set(note.content);
    this.saveIndicator.set('idle');
    this.notesRepo.markAsRead(note.id).catch(() => {});
  }

  clearSelection(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this._loadedTitle = '';
    this._loadedContent = '';
    this.selectedNote.set(null);
    this.noteTitle.set('');
    this.noteContent.set('');
    this.saveIndicator.set('idle');
  }

  onTitleChange(title: string): void {
    this.noteTitle.set(title);
    this.scheduleAutosave();
  }

  onContentChange(content: string): void {
    this.noteContent.set(content);
    this.scheduleAutosave();
  }

  private scheduleAutosave(): void {
    const isDirty = this.noteTitle() !== this._loadedTitle || this.noteContent() !== this._loadedContent;
    if (!isDirty) return;
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.saveIndicator.set('saving');
    this.autosaveTimer = setTimeout(() => this.save(), 1000);
  }

  async save(): Promise<void> {
    const note = this.selectedNote();
    if (!note) return;
    try {
      const updated = await this.notesRepo.update(note.id, {
        title: this.noteTitle() || 'Sin título',
        content: this.noteContent(),
      });
      if (this.selectedNote()?.id !== note.id) return;
      this._loadedTitle = updated.title;
      this._loadedContent = updated.content;
      this.selectedNote.set(updated);
      this.savedNote.set(updated);
      setTimeout(() => this.savedNote.set(null), 0);
      this.saveIndicator.set('saved');
      setTimeout(() => this.saveIndicator.set('idle'), 2000);
    } catch {
      if (this.selectedNote()?.id === note.id) {
        this.saveIndicator.set('idle');
      }
    }
  }

  signalDeleted(noteId: string): void {
    this.deletedNoteId.set(noteId);
    setTimeout(() => this.deletedNoteId.set(null), 0);
  }
}
