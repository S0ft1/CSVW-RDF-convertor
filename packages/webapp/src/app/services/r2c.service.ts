import { Injectable, signal } from '@angular/core';
import { ConversionService } from './conversion.service';
import {
  ColumnSchema,
  Issue,
  TableGroupSchema,
  TableSchema,
} from '@csvw-rdf-convertor/core';
import { dataTtl } from './data.ttl';

export interface InitR2CParams {
  files: {
    mainFile?: File;
    mainFileUrl?: string;
    otherFiles: File[];
    configFile?: File;
  };
  options: {
    baseIri?: string;
    pathOverrides: [string | RegExp, string][];
    useVocabMetadata?: boolean;
  };
}

export interface ResultMessage {
  type: 'result';
  data: string;
}
export interface SchemaMessage {
  type: 'schema';
  data: TableGroupSchema;
}
export interface ErrorMessage {
  type: 'error' | 'warning';
  data: Issue;
}
export type WorkerMessage = SchemaMessage | ErrorMessage | ResultMessage;

export interface ConvertRequest {
  params: InitR2CParams;
  type: 'convert';
}

export interface SchemaRequest {
  params: InitR2CParams;
  type: 'schema';
}

export type WorkerRequest = ConvertRequest | SchemaRequest;

@Injectable({
  providedIn: 'root',
})
export class R2CService extends ConversionService<InitR2CParams> {
  public detectedSchema = signal<TableGroupSchema>(null);

  constructor() {
    super();
    const file = new File([dataTtl], 'data.ttl', { type: 'text/turtle' });
    this.inferSchema({
      files: { mainFile: file, otherFiles: [] },
      options: { pathOverrides: [], useVocabMetadata: true },
    });
  }

  public override initConversion(params: InitR2CParams): boolean {
    if (!super.initConversion(params)) return false;

    const worker = new Worker(new URL('./r2c.worker', import.meta.url));
    worker.onmessage = ({ data }: { data: WorkerMessage }) => {
      if (data.type === 'error' || data.type === 'warning') {
        if (data.type === 'error') this.converting.set(false);
        this.issues.update((issues) => {
          issues.push(data.data);
          return issues;
        });
      } else if (data.type === 'result') {
        this.converting.set(false);
        this.result.set(data.data);
      }
    };
    worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.converting.set(false);
      this.issues.update((issues) => {
        issues.push({
          type: 'error',
          message: error.message,
        });
        return issues;
      });
    };
    worker.postMessage({ params, type: 'convert' });
    return true;
  }

  protected override buildConfigFile(
    params: InitR2CParams,
  ): Record<string, any> {
    return {
      options: params.options,
    };
  }

  public override configToParams(
    config: Record<string, any>,
  ): Partial<InitR2CParams> {
    return {
      options: {
        baseIri: config.options.baseIri,
        pathOverrides: config.options.pathOverrides ?? [],
        useVocabMetadata: config.options.useVocabMetadata ?? true,
      },
    };
  }

  public override reset(): void {
    super.reset();
    this.detectedSchema.set(null);
  }

  public inferSchema(params: InitR2CParams): boolean {
    if (!super.initConversion(params)) return false;

    const worker = new Worker(new URL('./r2c.worker', import.meta.url));
    worker.onmessage = ({ data }: { data: WorkerMessage }) => {
      if (data.type === 'error' || data.type === 'warning') {
        if (data.type === 'error') this.converting.set(false);
        this.issues.update((issues) => {
          issues.push(data.data);
          return issues;
        });
      } else if (data.type === 'schema') {
        this.converting.set(false);
        this.detectedSchema.set(this.toSchemaClasses(data.data));
      }
    };
    worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.converting.set(false);
      this.issues.update((issues) => {
        issues.push({
          type: 'error',
          message: error.message,
        });
        return issues;
      });
    };
    worker.postMessage({ params, type: 'schema' });
    return true;
  }

  /**
   * The object that comes back from the worker is stripped of the class prototypes.
   */
  private toSchemaClasses(schema: TableGroupSchema): TableGroupSchema {
    const newSchema = new TableGroupSchema();
    Object.assign(newSchema, schema);
    newSchema.tables = schema.tables.map((table) => {
      const newTable = new TableSchema(table.url);
      Object.assign(newTable, table);
      newTable.tableSchema.columns = table.tableSchema.columns.map((column) => {
        const newColumn = new ColumnSchema(column.name);
        Object.assign(newColumn, column);
        return newColumn;
      });
      return newTable;
    }) as [TableSchema, ...TableSchema[]];
    return newSchema;
  }
}
