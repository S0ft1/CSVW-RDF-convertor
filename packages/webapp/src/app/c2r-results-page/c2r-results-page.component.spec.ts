import { ComponentFixture, TestBed } from '@angular/core/testing';
import { C2rResultsPageComponent } from './c2r-results-page.component';

describe('C2rResultsPageComponent', () => {
  let component: C2rResultsPageComponent;
  let fixture: ComponentFixture<C2rResultsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [C2rResultsPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(C2rResultsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
