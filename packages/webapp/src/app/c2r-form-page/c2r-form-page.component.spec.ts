import { ComponentFixture, TestBed } from '@angular/core/testing';
import { C2rFormPageComponent } from './c2r-form-page.component';

describe('C2rFormPageComponent', () => {
  let component: C2rFormPageComponent;
  let fixture: ComponentFixture<C2rFormPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [C2rFormPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(C2rFormPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
