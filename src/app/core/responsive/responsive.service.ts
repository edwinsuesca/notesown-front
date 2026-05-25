import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ResponsiveService {
  readonly isMobile = signal<boolean>(false);

  constructor() {
    const mq = window.matchMedia('(max-width: 767px)');
    this.isMobile.set(mq.matches);
    mq.addEventListener('change', (e) => this.isMobile.set(e.matches));
  }
}
