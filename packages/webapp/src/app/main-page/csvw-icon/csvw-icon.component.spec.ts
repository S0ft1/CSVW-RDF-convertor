import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CsvwIconComponent } from './csvw-icon.component';

describe('CsvwIconComponent', () => {
  let component: CsvwIconComponent;
  let fixture: ComponentFixture<CsvwIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvwIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CsvwIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
