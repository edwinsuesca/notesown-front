import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase.service';
import { CryptoService } from '../crypto/crypto.service';
import { EditorStateService } from '../editor-state/editor-state.service';
import { BooksStateService } from '../../books/books-state.service';
import { PrivBookService } from '../private/priv-book.service';
import type { User } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class SupabaseAuthService {
  private readonly supabase = inject(SupabaseService).client;
  private readonly router = inject(Router);
  private readonly cryptoService = inject(CryptoService);
  private readonly editorState = inject(EditorStateService);
  private readonly booksState = inject(BooksStateService);
  private readonly privBookService = inject(PrivBookService);

  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(true);

  private readonly authReadyPromise: Promise<void>;

  constructor() {
    this.authReadyPromise = this.supabase.auth.getSession()
      .then(async ({ data }) => {
        this.currentUser.set(data.session?.user ?? null);
        if (data.session?.user) {
          await this.cryptoService.tryRestoreFromSession();
        }
      })
      .catch(() => {
        this.currentUser.set(null);
      })
      .finally(() => {
        this.isLoading.set(false);
      });

    this.supabase.auth.onAuthStateChange((_, session) => {
      this.currentUser.set(session?.user ?? null);
      if (!session?.user) {
        this.cryptoService.clearKeys();
        this.editorState.clearSelection();
        this.booksState.clear();
        this.privBookService.clear();
      }
    });
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error, data } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) {
      await this.cryptoService.initialize(password, data.user.id);
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error, data } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      await this.cryptoService.initialize(password, data.user.id);
    }
  }

  async signOut(): Promise<void> {
    this.cryptoService.clearKeys();
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this.router.navigate(['/login']);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const userId = this.currentUser()?.id;
    if (!userId) throw new Error('No hay sesión activa');

    const prepared = await this.cryptoService.preparePasswordChange(oldPassword, newPassword, userId);

    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    await this.cryptoService.commitPasswordChange(userId, prepared.encryptedCek, prepared.rawCek);
  }

  waitForAuth(): Promise<void> {
    return this.authReadyPromise;
  }

  get isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }
}
