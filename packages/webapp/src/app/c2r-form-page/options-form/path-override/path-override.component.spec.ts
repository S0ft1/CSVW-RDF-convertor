import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PathOverrideComponent } from './path-override.component';

describe('PathOverrideComponent', () => {
  let component: PathOverrideComponent;
  let fixture: ComponentFixture<PathOverrideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PathOverrideComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PathOverrideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
