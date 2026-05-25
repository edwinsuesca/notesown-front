import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <i [class]="icon()" class="empty-state__icon"></i>
      <p class="empty-state__message">{{ message() }}</p>
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 2rem;
      color: var(--p-text-muted-color);
      text-align: center;
    }
    .empty-state__icon {
      font-size: 2.5rem;
      opacity: 0.4;
    }
    .empty-state__message {
      font-size: 0.9rem;
      margin: 0;
    }
  `],
})
export class EmptyStateComponent {
  readonly icon = input<string>('pi pi-inbox');
  readonly message = input<string>('Sin contenido');
}
