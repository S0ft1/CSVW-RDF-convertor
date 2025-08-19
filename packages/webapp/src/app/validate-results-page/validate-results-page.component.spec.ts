import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidateResultsPageComponent } from './validate-results-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ValidateResultsPageComponent', () => {
  let component: ValidateResultsPageComponent;
  let fixture: ComponentFixture<ValidateResultsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidateResultsPageComponent],
    })
      .overrideComponent(ValidateResultsPageComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ValidateResultsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
