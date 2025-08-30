import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cSimpleFormPageComponent } from './r2c-simple-form-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('R2cSimpleFormPageComponent', () => {
  let component: R2cSimpleFormPageComponent;
  let fixture: ComponentFixture<R2cSimpleFormPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cSimpleFormPageComponent],
    })
      .overrideComponent(R2cSimpleFormPageComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(R2cSimpleFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
