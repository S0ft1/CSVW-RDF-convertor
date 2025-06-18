import { TestBed } from '@angular/core/testing';

import { C2rService } from './c2r.service';

describe('C2rService', () => {
  let service: C2rService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(C2rService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
