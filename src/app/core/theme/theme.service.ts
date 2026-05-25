import { Injectable, signal, effect, computed, OnDestroy, untracked } from '@angular/core';

export type ThemeMode = 'dark' | 'light' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService implements OnDestroy {
  private readonly STORAGE_KEY = 'notesown-theme';
  private mediaQuery: MediaQueryList;
  private systemThemeSignal = signal<boolean>(this.getSystemDark());

  readonly mode = signal<ThemeMode>(this.loadPreference());

  // Opciones para el menú
  readonly options = [
    { label: 'Claro', value: 'light' as ThemeMode },
    { label: 'Oscuro', value: 'dark' as ThemeMode },
    { label: 'Sistema', value: 'system' as ThemeMode },
  ];

  // Computed: devuelve true si estamos en dark mode (considerando system)
  // Depende de mode Y de systemThemeSignal para que se re-evalúe cuando cambia el sistema
  readonly isDark = computed(() => {
    const mode = this.mode();
    if (mode === 'system') {
      return this.systemThemeSignal();
    }
    return mode === 'dark';
  });

  constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Escuchar cambios del tema del sistema operativo
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);

    // Aplicar tema inicial
    this.applyTheme(this.isDark());

    // Effect que reacciona a cambios de modo o tema del sistema
    effect(() => {
      const dark = this.isDark();
      const mode = this.mode();
      this.applyTheme(dark);
      localStorage.setItem(this.STORAGE_KEY, mode);
    });
  }

  ngOnDestroy(): void {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
  }

  private getSystemDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  private handleSystemThemeChange = (): void => {
    // Cuando cambia el tema del sistema, actualizamos la señal
    // Esto trigger la re-evaluación del computed isDark
    this.systemThemeSignal.set(this.getSystemDark());
  };

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  private loadPreference(): ThemeMode {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'system') {
      return stored;
    }
    return 'system';
  }

  private applyTheme(dark: boolean): void {
    if (dark) {
      document.documentElement.classList.add('app-dark');
    } else {
      document.documentElement.classList.remove('app-dark');
    }
  }
}
