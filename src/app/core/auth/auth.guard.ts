import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseAuthService } from './supabase-auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(SupabaseAuthService);
  const router = inject(Router);

  await authService.waitForAuth();

  if (authService.isAuthenticated) return true;
  return router.createUrlTree(['/login']);
};

export const noAuthGuard: CanActivateFn = async () => {
  const authService = inject(SupabaseAuthService);
  const router = inject(Router);

  await authService.waitForAuth();

  if (!authService.isAuthenticated) return true;
  return router.createUrlTree(['/app']);
};
