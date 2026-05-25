import { Component, ChangeDetectionStrategy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AccordionModule } from 'primeng/accordion';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { SupabaseAuthService } from '../core/auth/supabase-auth.service';
import { ExportImportService } from '../core/export-import/export-import.service';
import { ShellActionsService } from '../core/shell-actions/shell-actions.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    ButtonModule,
    PasswordModule,
    MessageModule,
    AccordionModule,
    DividerModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly authService = inject(SupabaseAuthService);
  private readonly messageService = inject(MessageService);
  private readonly exportImport = inject(ExportImportService);
  private readonly shellActions = inject(ShellActionsService);

  @ViewChild('fileInput') private readonly fileInputRef!: ElementRef<HTMLInputElement>;

  protected readonly oldPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly isChangingPassword = signal(false);
  protected readonly changePasswordError = signal('');
  protected readonly changePasswordSuccess = signal(false);

  protected readonly isExporting = signal(false);
  protected readonly isImporting = signal(false);

  protected async exportNotes(): Promise<void> {
    this.isExporting.set(true);
    try {
      await this.exportImport.exportAll();
      this.messageService.add({
        severity: 'success',
        summary: 'Exportación completada',
        detail: 'El archivo JSON se ha descargado correctamente',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al exportar';
      this.messageService.add({ severity: 'error', summary: 'Error al exportar', detail: msg });
    } finally {
      this.isExporting.set(false);
    }
  }

  protected async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.isImporting.set(true);
    try {
      const result = await this.exportImport.importFromFile(file);
      const parts: string[] = [];
      if (result.booksCreated > 0) parts.push(`${result.booksCreated} libro${result.booksCreated > 1 ? 's' : ''} creado${result.booksCreated > 1 ? 's' : ''}`);
      if (result.notesCreated > 0) parts.push(`${result.notesCreated} nota${result.notesCreated > 1 ? 's' : ''} creada${result.notesCreated > 1 ? 's' : ''}`);
      if (result.notesUpdated > 0) parts.push(`${result.notesUpdated} nota${result.notesUpdated > 1 ? 's' : ''} actualizada${result.notesUpdated > 1 ? 's' : ''}`);
      const detail = parts.length > 0 ? parts.join(', ') : 'Sin cambios';

      this.shellActions.reloadData.set(true);

      if (result.errors.length > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Importación con errores',
          detail: `${detail}. ${result.errors.length} error${result.errors.length > 1 ? 'es' : ''}.`,
          life: 6000,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Importación completada',
          detail,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al importar';
      this.messageService.add({ severity: 'error', summary: 'Error al importar', detail: msg });
    } finally {
      this.isImporting.set(false);
    }
  }

  protected async changePassword(): Promise<void> {
    const oldPwd = this.oldPassword();
    const newPwd = this.newPassword();
    const confirmPwd = this.confirmPassword();

    if (!oldPwd || !newPwd || !confirmPwd) {
      this.changePasswordError.set('Completa todos los campos');
      return;
    }
    if (newPwd.length < 6) {
      this.changePasswordError.set('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPwd !== confirmPwd) {
      this.changePasswordError.set('Las contraseñas no coinciden');
      return;
    }

    this.isChangingPassword.set(true);
    this.changePasswordError.set('');
    try {
      await this.authService.changePassword(oldPwd, newPwd);
      this.oldPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.messageService.add({
        severity: 'success',
        summary: 'Contraseña actualizada',
        detail: 'Tu contraseña y la clave de cifrado han sido actualizadas',
      });
    } catch (err: unknown) {
      const isWrongPassword =
        (err instanceof DOMException && err.name === 'OperationError') ||
        (err instanceof Error && (err.message.includes('Invalid') || err.message.includes('invalid')));
      const msg = err instanceof Error ? err.message : 'No se pudo cambiar la contraseña';
      this.changePasswordError.set(isWrongPassword ? 'Contraseña actual incorrecta' : msg);
    } finally {
      this.isChangingPassword.set(false);
    }
  }
}
