import { TestBed } from '@angular/core/testing';

import { GlobalEventService } from './global-event.service';

describe('GlobalEventService', () => {
  let service: GlobalEventService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GlobalEventService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
