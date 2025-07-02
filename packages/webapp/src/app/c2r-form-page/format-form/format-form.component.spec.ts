import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormatFormComponent } from './format-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('FormatFormComponent', () => {
  let component: FormatFormComponent;
  let fixture: ComponentFixture<FormatFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormatFormComponent],
    })
      .overrideComponent(FormatFormComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FormatFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
