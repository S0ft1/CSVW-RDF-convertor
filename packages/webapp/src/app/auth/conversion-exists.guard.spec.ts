import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { conversionExistsGuard } from './conversion-exists.guard';

describe('conversionExistsGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => conversionExistsGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
