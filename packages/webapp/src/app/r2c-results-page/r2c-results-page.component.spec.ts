import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cResultsPageComponent } from './r2c-results-page.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';

describe('R2cResultsPageComponent', () => {
  let component: R2cResultsPageComponent;
  let fixture: ComponentFixture<R2cResultsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cResultsPageComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            lastSuccessfulNavigation: {
              initialUrl: 'r2c',
            },
          },
        },
      ],
    })
      .overrideComponent(R2cResultsPageComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(R2cResultsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
