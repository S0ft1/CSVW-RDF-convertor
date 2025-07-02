import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LightToggleComponent } from './light-toggle.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('LightToggleComponent', () => {
  let component: LightToggleComponent;
  let fixture: ComponentFixture<LightToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightToggleComponent],
    })
      .overrideComponent(LightToggleComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(LightToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
