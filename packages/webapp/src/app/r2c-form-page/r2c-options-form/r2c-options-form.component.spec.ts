import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cOptionsFormComponent } from './r2c-options-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { setInput } from '../../testing/set-input';

describe('R2cOptionsFormComponent', () => {
  let component: R2cOptionsFormComponent;
  let fixture: ComponentFixture<R2cOptionsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cOptionsFormComponent],
    })
      .overrideComponent(R2cOptionsFormComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(R2cOptionsFormComponent);
    component = fixture.componentInstance;
    setInput(fixture, 'form', {
      get: vi.fn().mockReturnValue({ enable: vi.fn(), disable: vi.fn() }),
    });
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
