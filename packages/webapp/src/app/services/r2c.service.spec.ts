import { TestBed } from '@angular/core/testing';

import { R2CService } from './r2c.service';

describe('R2CService', () => {
  let service: R2CService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(R2CService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
