import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FileHandleComponent } from './file-handle.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('FileHandleComponent', () => {
  let component: FileHandleComponent;
  let fixture: ComponentFixture<FileHandleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileHandleComponent],
    })
      .overrideComponent(FileHandleComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(FileHandleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
