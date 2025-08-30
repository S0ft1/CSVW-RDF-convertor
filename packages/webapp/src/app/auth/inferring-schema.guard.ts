import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { R2CService } from '../services/r2c.service';

export function inferringSchemaGuard(defaultRoute: string): CanActivateFn {
  return () => {
    const conversionService = inject(R2CService);
    const router = inject(Router);
    if (
      !conversionService.converting() &&
      conversionService.detectedSchema() === null &&
      !conversionService.issues().length
    ) {
      if (router.lastSuccessfulNavigation) {
        return router.lastSuccessfulNavigation.finalUrl;
      }
      return router.createUrlTree([defaultRoute]);
    }
    return true;
  };
}
