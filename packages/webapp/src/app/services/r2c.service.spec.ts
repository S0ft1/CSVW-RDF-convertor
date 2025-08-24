import { TestBed } from '@angular/core/testing';

import { R2cService } from './r2c.service';

describe('R2cService', () => {
  let service: R2cService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(R2cService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
