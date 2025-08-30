import { ComponentFixture, TestBed } from '@angular/core/testing';
import { C2rResultsPageComponent } from './c2r-results-page.component';
import { Router } from '@angular/router';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('C2rResultsPageComponent', () => {
  let component: C2rResultsPageComponent;
  let fixture: ComponentFixture<C2rResultsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [C2rResultsPageComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            lastSuccessfulNavigation: {
              initialUrl: 'c2r',
            },
          },
        },
      ],
    })
      .overrideComponent(C2rResultsPageComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(C2rResultsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
