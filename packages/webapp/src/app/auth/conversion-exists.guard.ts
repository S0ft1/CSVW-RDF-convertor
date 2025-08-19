import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ConversionService } from '../services/conversion.service';

export function conversionExistsGuard(
  service: new (...args: any[]) => ConversionService<any>,
  defaultRoute: string,
): CanActivateFn {
  return () => {
    const conversionService = inject(service);
    const router = inject(Router);
    if (
      !conversionService.converting() &&
      conversionService.result() === null &&
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
