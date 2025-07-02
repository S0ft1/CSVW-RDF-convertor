import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrefixesComponent } from './prefixes.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('PrefixesComponent', () => {
  let component: PrefixesComponent;
  let fixture: ComponentFixture<PrefixesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrefixesComponent],
    })
      .overrideComponent(PrefixesComponent, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PrefixesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
