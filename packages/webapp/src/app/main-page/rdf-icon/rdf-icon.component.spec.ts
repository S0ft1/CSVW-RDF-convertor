import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RdfIconComponent } from './rdf-icon.component';

describe('RdfIconComponent', () => {
  let component: RdfIconComponent;
  let fixture: ComponentFixture<RdfIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RdfIconComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RdfIconComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
