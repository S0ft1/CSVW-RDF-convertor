import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PathOverrideComponent } from './path-override.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('PathOverrideComponent', () => {
  let component: PathOverrideComponent;
  let fixture: ComponentFixture<PathOverrideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathOverrideComponent],
    })
      .overrideComponent(PathOverrideComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PathOverrideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
