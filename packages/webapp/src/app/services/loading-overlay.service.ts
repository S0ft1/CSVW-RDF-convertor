import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
} from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class LoadingOverlayService {
  private state = signal(0);
  public isLoading = computed(() => this.state() > 0);

  private router = inject(Router);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.increment();
      } else if (
        [
          NavigationEnd,
          NavigationSkipped,
          NavigationError,
          NavigationCancel,
        ].some((cls) => e instanceof cls)
      ) {
        this.decrement();
      }
    });
  }

  public increment() {
    this.state.update((s) => s + 1);
  }

  public decrement() {
    this.state.update((s) => Math.max(0, s - 1));
  }
}
