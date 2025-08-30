import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidationOptionsFormComponent } from './validation-options-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { setInput } from '../../testing/set-input';

describe('ValidationOptionsFormComponent', () => {
  let component: ValidationOptionsFormComponent;
  let fixture: ComponentFixture<ValidationOptionsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidationOptionsFormComponent],
    })
      .overrideComponent(ValidationOptionsFormComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ValidationOptionsFormComponent);
    component = fixture.componentInstance;
    setInput(fixture, 'form', {
      get: vi.fn().mockReturnValue({ controls: [] }),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
