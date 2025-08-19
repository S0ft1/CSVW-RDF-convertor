import { TestBed } from '@angular/core/testing';

import { LoadingOverlayService } from './loading-overlay.service';

describe('LoadingOverlayService', () => {
  let service: LoadingOverlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingOverlayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
