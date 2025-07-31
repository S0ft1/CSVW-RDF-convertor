import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilesFormComponent } from './files-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('FilesFormComponent', () => {
  let component: FilesFormComponent;
  let fixture: ComponentFixture<FilesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilesFormComponent],
    })
      .overrideComponent(FilesFormComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FilesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
