import { TestBed } from '@angular/core/testing';

import { C2RService } from './c2r.service';

describe('C2RService', () => {
  let service: C2RService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(C2RService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
