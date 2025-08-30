import { Injectable, signal } from '@angular/core';
import { ConversionService } from './conversion.service';
import {
  AnyCsvwDescriptor,
  Issue,
  TableGroupSchema,
} from '@csvw-rdf-convertor/core';

export interface InitR2CParams {
  files: {
    mainFile?: File;
    mainFileUrl?: string;
    otherFiles: File[];
  };
  options: {
    baseIri?: string;
    pathOverrides: [string | RegExp, string][];
    useVocabMetadata?: boolean;
    interactiveSchema?: boolean;
  };
  descriptor?: AnyCsvwDescriptor;
}

export interface ResultFile {
  filename: string;
  content: string;
}

export interface ResultMessage {
  type: 'result';
  data: ResultFile[];
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
export class R2CService extends ConversionService<InitR2CParams, ResultFile[]> {
  public detectedSchema = signal<TableGroupSchema>(null);

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
      descriptor: params.descriptor,
    };
  }

  public override configToParams(
    config: Record<string, any>,
  ): Partial<InitR2CParams> {
    if (!('@context' in config) && 'options' in config) {
      return {
        options: {
          baseIri: config.options.baseIri,
          pathOverrides: config.options.pathOverrides ?? [],
          useVocabMetadata: config.options.useVocabMetadata ?? true,
          interactiveSchema: !config.descriptor,
        },
        descriptor: config.descriptor,
      };
    }
    return {
      descriptor: config as any,
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
        this.detectedSchema.set(TableGroupSchema.fromDescriptor(data.data));
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
}
