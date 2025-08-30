import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddTableDialogComponent } from './add-table-dialog.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

describe('AddTableDialogComponent', () => {
  let component: AddTableDialogComponent;
  let fixture: ComponentFixture<AddTableDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddTableDialogComponent],
      providers: [{ provide: MatDialogRef, useValue: {} }],
    })
      .overrideComponent(AddTableDialogComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AddTableDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
