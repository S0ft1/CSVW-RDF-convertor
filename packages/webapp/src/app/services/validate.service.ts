import { Injectable } from '@angular/core';
import { Issue } from '@csvw-rdf-convertor/core';
import { ConversionService } from './conversion.service';

export interface InitValidationParams {
  files: {
    mainFile?: File;
    mainFileUrl?: string;
    otherFiles: File[];
    configFile?: File;
  };
  options: {
    baseIri?: string;
    pathOverrides: [string | RegExp, string][];
  };
}

export interface ErrorMessage {
  type: 'error' | 'warning';
  data: Issue;
}
export interface EndMessage {
  type: 'end';
}
export type WorkerMessage = ErrorMessage | EndMessage;

@Injectable({
  providedIn: 'root',
})
export class ValidateService extends ConversionService<InitValidationParams> {
  public override initConversion(params: InitValidationParams): boolean {
    if (!super.initConversion(params)) return false;

    const worker = new Worker(new URL('./validate.worker', import.meta.url));
    worker.onmessage = ({ data }: { data: WorkerMessage }) => {
      if (data.type === 'error' || data.type === 'warning') {
        if (data.type === 'error') this.converting.set(false);
        this.issues.update((issues) => {
          issues.push(data.data);
          return issues;
        });
      } else if (data.type === 'end') {
        this.converting.set(false);
        this.result.set('');
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
    params: InitValidationParams,
  ): Record<string, any> {
    return {
      options: params.options,
    };
  }

  public override configToParams(
    config: Record<string, any>,
  ): Partial<InitValidationParams> {
    return {
      options: {
        baseIri: config.options.baseIri,
        pathOverrides: config.options.pathOverrides || [],
      },
    };
  }
}
