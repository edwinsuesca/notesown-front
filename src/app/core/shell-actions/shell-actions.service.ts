import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ShellActionsService {
  readonly openCreateBook = signal(false);
  readonly openCreateNote = signal(false);
  readonly reloadData = signal(false);
}
