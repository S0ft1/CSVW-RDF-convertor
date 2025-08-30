import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TableSchema } from '@csvw-rdf-convertor/core';
import {
  MatMenu,
  MatMenuContent,
  MatMenuItem,
  MatMenuTrigger,
} from '@angular/material/menu';

@Component({
  selector: 'app-table-schema',
  imports: [
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuTrigger,
    MatMenuItem,
    MatMenuContent,
  ],
  templateUrl: './table-schema.component.html',
  styleUrl: './table-schema.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableSchemaComponent {
  data = input<TableSchema>();
  allTables = input<TableSchema[]>();
  public el = inject<ElementRef<HTMLElement>>(ElementRef);

  deleteCol = output<{ name: string; titles: string }>();
  deleteTable = output<void>();
  renameCol = output<{ name: string; titles: string }>();
  renameTable = output<void>();
  moveCol = output<{ column: string; toTable: string; columnTitles: string }>();
  cdRef = inject(ChangeDetectorRef);

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
