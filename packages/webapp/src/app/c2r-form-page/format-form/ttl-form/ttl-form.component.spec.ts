import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TtlFormComponent } from './ttl-form.component';

describe('TtlFormComponent', () => {
  let component: TtlFormComponent;
  let fixture: ComponentFixture<TtlFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TtlFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TtlFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
