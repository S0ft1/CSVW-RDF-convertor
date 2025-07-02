import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LightToggleComponent } from './light-toggle.component';

describe('LightToggleComponent', () => {
  let component: LightToggleComponent;
  let fixture: ComponentFixture<LightToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LightToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LightToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
