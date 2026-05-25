import {
  Component,
  ChangeDetectionStrategy,
  inject,
  ViewChild,
  signal,
  effect,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { TooltipModule } from 'primeng/tooltip';
import { MenuItem } from 'primeng/api';
import { ThemeService, type ThemeMode } from '../../../core/theme/theme.service';
import { Menu } from 'primeng/menu';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [ButtonModule, MenuModule, TooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button
      type="button"
      [icon]="getIcon()"
      [rounded]="true"
      severity="secondary"
      [text]="true"
      (onClick)="onToggleClick($event)"
      [pTooltip]="getTooltip()"
      tooltipPosition="left"
      ariaLabel="Cambiar tema"
    />
    <p-menu
      #menuEl
      [model]="menuItems()"
      [popup]="true"
      appendTo="body"
      styleClass="theme-menu-options"
    >
      <ng-template pTemplate="item" let-item>
        <div class="flex items-center gap-3 px-3 py-2">
          <i [class]="getItemIcon(item)"></i>
          <span>{{ item.label }}</span>
          @if (isSelected(item)) {
            <i class="pi pi-check ml-auto text-green-500"></i>
          }
        </div>
      </ng-template>
    </p-menu>
  `,
})
export class ThemeToggleComponent {
  protected readonly themeService = inject(ThemeService);

  @ViewChild('menuEl') menuEl!: Menu;

  readonly menuItems = signal<MenuItem[]>(this.buildMenuItems());

  constructor() {
    effect(() => {
      this.menuItems.set(this.buildMenuItems());
    });
  }

  private buildMenuItems(): MenuItem[] {
    return [
      { label: 'Claro', icon: 'pi pi-sun', command: () => this.handleSelect('light') },
      { label: 'Oscuro', icon: 'pi pi-moon', command: () => this.handleSelect('dark') },
      { label: 'Sistema', icon: 'pi pi-desktop', command: () => this.handleSelect('system') },
    ];
  }

  isSelected(item: MenuItem): boolean {
    const mode = this.themeService.mode();
    return (
      (item.label === 'Claro' && mode === 'light') ||
      (item.label === 'Oscuro' && mode === 'dark') ||
      (item.label === 'Sistema' && mode === 'system')
    );
  }

  getIcon(): string {
    const mode = this.themeService.mode();
    return mode === 'system' ? 'pi pi-desktop' : mode === 'dark' ? 'pi pi-moon' : 'pi pi-sun';
  }

  getTooltip(): string {
    const mode = this.themeService.mode();
    if (mode === 'system') return 'Tema: Sistema';
    if (mode === 'dark') return 'Tema: Oscuro';
    return 'Tema: Claro';
  }

  getItemIcon(item: MenuItem): string {
    return item.icon || '';
  }

  onToggleClick(event: Event): void {
    if (this.menuEl) {
      this.menuEl.toggle(event);
    }
  }

  private handleSelect(mode: ThemeMode): void {
    this.themeService.setMode(mode);
  }
}
