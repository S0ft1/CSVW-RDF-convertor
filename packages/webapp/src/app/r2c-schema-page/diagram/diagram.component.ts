import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TableGroupSchema } from '@csvw-rdf-convertor/core';
import * as d3 from 'd3';
import { GraphEdge, graphlib, layout } from '@dagrejs/dagre';
import { TableSchemaComponent } from './table-schema/table-schema.component';

@Component({
  selector: 'app-diagram',
  imports: [TableSchemaComponent],
  templateUrl: './diagram.component.html',
  styleUrl: './diagram.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagramComponent implements AfterViewInit {
  schema = input<TableGroupSchema>();
  private svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private tableNodes = viewChildren<TableSchemaComponent>(TableSchemaComponent);
  private zoomContainer = computed(() =>
    d3.select(this.svg().nativeElement.parentElement.parentElement as Element),
  );
  private svgContainer = computed(() =>
    d3.select(this.svg().nativeElement.parentElement as Element),
  );
  private static instances = 0;
  readonly id = DiagramComponent.instances++;
  private zoom: d3.ZoomBehavior<Element, unknown>;
  layout = signal<graphlib.Graph>(null);

  constructor() {
    effect(() => {
      if (this.schema() && this.svgContainer()) {
        this.render();
      }
    });
  }

  private resetZoom() {
    this.zoom.transform(this.zoomContainer(), d3.zoomIdentity);
  }

  ngAfterViewInit(): void {
    this.zoom = this.initZoom();
    if (this.schema()) {
      this.render();
    }
  }

  private initZoom() {
    const zoom = d3
      .zoom()
      .scaleExtent([1, Infinity])
      .on('zoom', (e: d3.D3ZoomEvent<Element, unknown>) => {
        this.svgContainer().style(
          'transform',
          `translate(${e.transform.x}px, ${e.transform.y}px) scale(${e.transform.k})`,
        );
      });
    this.zoomContainer().call(zoom);
    return zoom;
  }

  render() {
    this.resetZoom();
    this.layout.set(this.renderLayout());
  }

  private renderLayout() {
    const g = new graphlib.Graph();
    g.setGraph({});
    g.setDefaultEdgeLabel(() => ({}));

    for (const table of this.tableNodes()) {
      const data = table.data();
      const el = table.el.nativeElement;
      g.setNode(data.url, {
        label: data.url,
        width: el.clientWidth,
        height: el.clientHeight,
      });
    }

    this.mockEdges(g);
    this.foreignKeyEdges(g);

    layout(g, {
      width: this.svgContainer().node().clientWidth,
    });
    return g;
  }

  /**
   * invisible edges for tables without any connections
   */
  private mockEdges(g: graphlib.Graph) {
    const allTables = this.schema().tables;
    const loneTables = new Set(allTables.map((table) => table.url));

    for (const table of allTables) {
      if (table.tableSchema.foreignKeys?.length) {
        loneTables.delete(table.url);
        for (const fk of table.tableSchema.foreignKeys) {
          loneTables.delete(fk.reference.resource);
        }
      }
    }

    const grid: string[][] = [];
    const gridSize = Math.ceil(Math.sqrt(loneTables.size));
    const loneTablesArr = Array.from(loneTables);
    for (let i = 0; i < gridSize; i++) {
      grid.push(loneTablesArr.slice(i * gridSize, (i + 1) * gridSize));
    }

    for (let x = 1; x < grid.length; x++) {
      for (let y = 1; y < grid[x].length; y++) {
        const table = grid[x][y];
        if (table) {
          g.setEdge(grid[x - 1][y], table, { invisible: true });
          g.setEdge(grid[x][y - 1], table, { invisible: true });
          g.setEdge(grid[x - 1][y - 1], table, { invisible: true });
        }
      }
    }
  }

  private foreignKeyEdges(g: graphlib.Graph) {
    for (const table of this.schema().tables) {
      for (const fk of table.tableSchema.foreignKeys || []) {
        g.setEdge(table.url, fk.reference.resource);
      }
    }
  }

  getEdgePath(e: GraphEdge) {
    return 'M ' + e.points.map((p) => `${p.x},${p.y}`).join(' L ');
  }
}
