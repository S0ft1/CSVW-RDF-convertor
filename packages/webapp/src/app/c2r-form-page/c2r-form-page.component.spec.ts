import { ComponentFixture, TestBed } from '@angular/core/testing';
import { C2rFormPageComponent } from './c2r-form-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('C2rFormPageComponent', () => {
  let component: C2rFormPageComponent;
  let fixture: ComponentFixture<C2rFormPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [C2rFormPageComponent],
    })
      .overrideComponent(C2rFormPageComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(C2rFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
