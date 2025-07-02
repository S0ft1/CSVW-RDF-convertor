import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormatFormComponent } from './format-form.component';

describe('FormatFormComponent', () => {
  let component: FormatFormComponent;
  let fixture: ComponentFixture<FormatFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormatFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FormatFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
