import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cFormPageComponent } from './r2c-form-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('R2cFormPageComponent', () => {
  let component: R2cFormPageComponent;
  let fixture: ComponentFixture<R2cFormPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cFormPageComponent],
    })
      .overrideComponent(R2cFormPageComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(R2cFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
