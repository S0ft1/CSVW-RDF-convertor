import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { TableSchema } from '@csvw-rdf-convertor/core';

@Component({
  selector: 'app-table-schema',
  imports: [],
  templateUrl: './table-schema.component.html',
  styleUrl: './table-schema.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableSchemaComponent {
  data = input<TableSchema>();
  public el = inject<ElementRef<HTMLElement>>(ElementRef);

  foreignKeys = computed(() => {
    const result: Record<string, string> = {};
    for (const fk of this.data().tableSchema.foreignKeys) {
      const arr = Array.isArray(fk.columnReference)
        ? fk.columnReference
        : [fk.columnReference];
      for (const col of arr) {
        result[col] = fk.reference.resource;
      }
    }
    return result;
  });
}
