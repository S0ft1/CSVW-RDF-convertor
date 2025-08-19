import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidateSimpleFormPageComponent } from './validate-simple-form-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ValidateSimpleFormPageComponent', () => {
  let component: ValidateSimpleFormPageComponent;
  let fixture: ComponentFixture<ValidateSimpleFormPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidateSimpleFormPageComponent],
    })
      .overrideComponent(ValidateSimpleFormPageComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ValidateSimpleFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
