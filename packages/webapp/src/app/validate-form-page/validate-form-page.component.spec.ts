import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidateFormPageComponent } from './validate-form-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ValidateFormPageComponent', () => {
  let component: ValidateFormPageComponent;
  let fixture: ComponentFixture<ValidateFormPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidateFormPageComponent],
    })
      .overrideComponent(ValidateFormPageComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ValidateFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
