import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptionsFormComponent } from './options-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

describe('OptionsFormComponent', () => {
  let component: OptionsFormComponent;
  let fixture: ComponentFixture<OptionsFormComponent>;
  let form: FormGroup;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionsFormComponent],
    })
      .overrideComponent(OptionsFormComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OptionsFormComponent);
    component = fixture.componentInstance;
    form = new FormGroup({
      baseIri: new FormControl(''),
      pathOverrides: new FormControl([]),
      templateIris: new FormControl(false),
      minimal: new FormControl(false),
    });
    fixture.componentRef.setInput('form', form);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
