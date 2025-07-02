import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptionsFormComponent } from './options-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('OptionsFormComponent', () => {
  let component: OptionsFormComponent;
  let fixture: ComponentFixture<OptionsFormComponent>;

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
