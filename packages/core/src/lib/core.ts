import jsonld from 'jsonld';
import { CompactedExpandedCsvwDescriptor } from './types/descriptor/descriptor.js';
import { CsvwTableGroupDescription } from './types/descriptor/table-group.js';
import { AnyCsvwDescriptor } from './types/descriptor/descriptor.js';
import { csvwNs } from './types/descriptor/namespace.js';
import { Expanded } from './types/descriptor/expanded.js';
import { Csvw2RdfOptions } from './conversion-options.js';
import { defaultResolveFn, defaultResolveStreamFn } from './req-resolve.js';
import { replaceUrl } from './utils/replace-url.js';

export async function normalizeDescriptor(
  descriptor: string | AnyCsvwDescriptor,
  options?: Csvw2RdfOptions
): Promise<DescriptorWrapper> {
  const completeOpts = setDefaults(options);
  const docLoader = async (url: string) => {
    url = replaceUrl(url, completeOpts.pathOverrides);
    return {
      document: JSON.parse(await completeOpts.resolveFn(url)),
      documentUrl: url,
    };
  };

  let parsedDescriptor: AnyCsvwDescriptor;
  if (typeof descriptor === 'string') {
    parsedDescriptor = JSON.parse(descriptor);
  } else {
    parsedDescriptor = descriptor;
  }

  const expanded = await jsonld.expand(
    parsedDescriptor as jsonld.JsonLdDocument,
    { documentLoader: docLoader }
  );
  return new DescriptorWrapper(
    (await jsonld.compact(expanded, {})) as CompactedExpandedCsvwDescriptor
  );
}

function setDefaults(options?: Csvw2RdfOptions): Required<Csvw2RdfOptions> {
  options ??= {};
  return {
    pathOverrides: options.pathOverrides ?? [],
    offline: options.offline ?? false,
    resolveFn: options.resolveFn ?? defaultResolveFn,
    resolveStreamFn: options.resolveStreamFn ?? defaultResolveStreamFn,
  };
}

/** Class for manipulating the descriptor */
export class DescriptorWrapper {
  public get isTableGroup(): boolean {
    return this._isTableGroup(this.descriptor);
  }

  constructor(public descriptor: CompactedExpandedCsvwDescriptor) {}

  private _isTableGroup(
    x: CompactedExpandedCsvwDescriptor
  ): x is Expanded<CsvwTableGroupDescription> {
    return 'http://www.w3.org/ns/csvw#tables' in x;
  }

  public *getTables() {
    if (this._isTableGroup(this.descriptor)) {
      for (const element of this.descriptor[
        'http://www.w3.org/ns/csvw#tables'
      ]) {
        yield element;
      }
    } else {
      yield this.descriptor;
    }
  }

  public *getExternalProps<T>(object: T) {
    for (const key in object) {
      if (key.startsWith(`${csvwNs}#`)) {
        continue;
      }
      yield key as Exclude<
        Extract<keyof T, string>,
        `${typeof csvwNs}#${string}`
      >;
    }
  }
}
