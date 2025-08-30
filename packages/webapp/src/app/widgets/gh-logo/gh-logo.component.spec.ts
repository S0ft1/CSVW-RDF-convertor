import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GhLogoComponent } from './gh-logo.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('GhLogoComponent', () => {
  let component: GhLogoComponent;
  let fixture: ComponentFixture<GhLogoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GhLogoComponent],
    })
      .overrideComponent(GhLogoComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(GhLogoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
