import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cResultsPageComponent } from './r2c-results-page.component';

describe('R2cResultsPageComponent', () => {
  let component: R2cResultsPageComponent;
  let fixture: ComponentFixture<R2cResultsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cResultsPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(R2cResultsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
