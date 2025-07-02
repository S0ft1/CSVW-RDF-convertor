import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormatFormComponent } from './format-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';

describe('FormatFormComponent', () => {
  let component: FormatFormComponent;
  let fixture: ComponentFixture<FormatFormComponent>;
  let form: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormatFormComponent],
      providers: [provideNoopAnimations()],
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
    form = new FormGroup({
      format: new FormControl(),
      ttl: new FormGroup({
        prefixes: new FormControl({}),
        lookupPrefixes: new FormControl(false),
        baseIri: new FormControl(''),
      }),
    });
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
