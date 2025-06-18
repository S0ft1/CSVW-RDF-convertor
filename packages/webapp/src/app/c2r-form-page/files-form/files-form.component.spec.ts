import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilesFormComponent } from './files-form.component';

describe('FilesFormComponent', () => {
  let component: FilesFormComponent;
  let fixture: ComponentFixture<FilesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilesFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FilesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
