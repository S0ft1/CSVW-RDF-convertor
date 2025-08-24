import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cFilesFormComponent } from './r2c-files-form.component';

describe('R2cFilesFormComponent', () => {
  let component: R2cFilesFormComponent;
  let fixture: ComponentFixture<R2cFilesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cFilesFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(R2cFilesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
