import { Injectable } from '@angular/core';
import { Issue, RDFSerialization } from '@csvw-rdf-convertor/core';
import { ConversionService } from './conversion.service';

export interface InitC2RParams {
  files: {
    mainFile?: File;
    mainFileUrl?: string;
    otherFiles: File[];
    configFile?: File;
  };
  options: {
    baseIri?: string;
    pathOverrides: [string | RegExp, string][];
    templateIris: boolean;
    minimal: boolean;
  };
  format: {
    format: RDFSerialization;
    ttl: {
      prefixes: Record<string, string>;
      lookupPrefixes: boolean;
      baseIri?: string;
    };
  };
}

export interface DataMessage {
  type: 'result';
  data: string;
}
export interface ErrorMessage {
  type: 'error' | 'warning';
  data: Issue;
}
export type WorkerMessage = DataMessage | ErrorMessage;

@Injectable({
  providedIn: 'root',
})
export class C2RService extends ConversionService<InitC2RParams> {
  public override initConversion(params: InitC2RParams): boolean {
    if (!super.initConversion(params)) return false;

    const worker = new Worker(new URL('./c2r.worker', import.meta.url));
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
    worker.postMessage(params);
    return true;
  }

  protected override buildConfigFile(
    params: InitC2RParams,
  ): Record<string, any> {
    return {
      options: params.options,
      format: params.format,
    };
  }

  public override configToParams(
    config: Record<string, any>,
  ): Partial<InitC2RParams> {
    return {
      options: {
        baseIri: config.options.baseIri,
        pathOverrides: config.options.pathOverrides || [],
        templateIris: config.options.templateIris || false,
        minimal: config.options.minimal || false,
      },
      format: {
        format: config.format.format as RDFSerialization,
        ttl: {
          prefixes: config.format.ttl.prefixes || {},
          lookupPrefixes: config.format.ttl.lookupPrefixes || false,
          baseIri: config.format.ttl.baseIri,
        },
      },
    };
  }
}
