import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TtlFormComponent } from './ttl-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('TtlFormComponent', () => {
  let component: TtlFormComponent;
  let fixture: ComponentFixture<TtlFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TtlFormComponent],
    })
      .overrideComponent(TtlFormComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TtlFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
