import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cFilesFormComponent } from './r2c-files-form.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('R2cFilesFormComponent', () => {
  let component: R2cFilesFormComponent;
  let fixture: ComponentFixture<R2cFilesFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cFilesFormComponent],
    })
      .overrideComponent(R2cFilesFormComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(R2cFilesFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
