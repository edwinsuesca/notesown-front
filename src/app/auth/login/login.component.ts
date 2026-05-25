import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { FloatLabelModule } from 'primeng/floatlabel';
import { MessageModule } from 'primeng/message';
import { SupabaseAuthService } from '../../core/auth/supabase-auth.service';
import { ThemeToggleComponent } from '../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    FloatLabelModule,
    MessageModule,
    ThemeToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly authService = inject(SupabaseAuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal('');
  protected readonly mode = signal<'login' | 'register'>('login');

  protected async submit(): Promise<void> {
    const email = this.email().trim();
    const password = this.password();

    if (!email || !password) {
      this.errorMessage.set('Por favor completa todos los campos');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      if (this.mode() === 'login') {
        await this.authService.signIn(email, password);
      } else {
        await this.authService.signUp(email, password);
      }
      this.router.navigate(['/app']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error inesperado';
      this.errorMessage.set(this.translateError(msg));
    } finally {
      this.isLoading.set(false);
    }
  }

  protected toggleMode(): void {
    this.mode.update((m) => (m === 'login' ? 'register' : 'login'));
    this.errorMessage.set('');
  }

  private translateError(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Credenciales incorrectas';
    if (msg.includes('Email not confirmed')) return 'Confirma tu email antes de iniciar sesión';
    if (msg.includes('User already registered')) return 'Este email ya está registrado';
    if (msg.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch'))
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    return msg;
  }
}
