import { signal } from '@angular/core';
import { Issue } from '@csvw-rdf-convertor/core';

export abstract class ConversionService<Params> {
  converting = signal(false);
  result = signal<string>(null);
  issues = signal<Issue[]>([], {
    equal: (a, b) => a === b && a.length === b.length,
  });
  /** JSON config */
  config: Record<string, any> = null;
  params: Params = null;

  public initConversion(params: Params): boolean {
    if (this.converting()) {
      console.warn('Conversion already in progress');
      return false;
    }
    this.reset();
    this.converting.set(true);
    this.config = this.buildConfigFile(params);
    this.params = params;
    return true;
  }

  public reset() {
    this.converting.set(false);
    this.result.set(null);
    this.issues.set([]);
    this.config = null;
    this.params = null;
  }

  protected abstract buildConfigFile(params: Params): Record<string, any>;
  public abstract configToParams(config: Record<string, any>): Partial<Params>;
}
