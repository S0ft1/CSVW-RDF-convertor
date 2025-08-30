import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableSchemaComponent } from './table-schema.component';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { setInput } from '../../../testing/set-input';

describe('TableSchemaComponent', () => {
  let component: TableSchemaComponent;
  let fixture: ComponentFixture<TableSchemaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableSchemaComponent],
    })
      .overrideComponent(TableSchemaComponent, {
        set: { imports: [], schemas: [NO_ERRORS_SCHEMA] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TableSchemaComponent);
    component = fixture.componentInstance;
    setInput(fixture, 'data', { tableSchema: { columns: [] } });
    setInput(fixture, 'allTables', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
