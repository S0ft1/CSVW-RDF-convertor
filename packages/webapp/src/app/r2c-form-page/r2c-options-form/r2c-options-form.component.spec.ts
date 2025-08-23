import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cOptionsFormComponent } from './r2c-options-form.component';

describe('R2cOptionsFormComponent', () => {
  let component: R2cOptionsFormComponent;
  let fixture: ComponentFixture<R2cOptionsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cOptionsFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(R2cOptionsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
