import { ComponentFixture, TestBed } from '@angular/core/testing';
import { R2cSchemaPageComponent } from './r2c-schema-page.component';

describe('R2cSchemaPageComponent', () => {
  let component: R2cSchemaPageComponent;
  let fixture: ComponentFixture<R2cSchemaPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [R2cSchemaPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(R2cSchemaPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
