import jsonld from 'jsonld';
import {CompactedExpandedCsvwDescriptor} from "./descriptor/descriptor.js";
import { CsvwTableGroupDescription } from './descriptor/table-group.js';
import { AnyCsvwDescriptor } from './descriptor/descriptor.js';
import { csvwNs } from './descriptor/namespace.js';
import { Expanded } from './descriptor/expanded.js';
import { Csvw2RdfOptions, optionsNs } from './conversion-options.js';

export async function normalizeDescriptor<Options extends Csvw2RdfOptions>(
  descriptor : string | AnyCsvwDescriptor,
  options?: Options
): Promise<DescriptorWrapper<Options>> {
  let parsedDescriptor : AnyCsvwDescriptor;
  if (typeof descriptor === 'string') {
    parsedDescriptor = JSON.parse(descriptor);
  }
  else{
    parsedDescriptor = descriptor;
  }

  const [expanded, expandedOptions] = await Promise.all([
    jsonld.expand(parsedDescriptor as jsonld.JsonLdDocument),
    jsonld.expand({...options} as jsonld.JsonLdDocument)
  ]);
  const [compacted, compactedOptions]: [
    CompactedExpandedCsvwDescriptor,
    Expanded<Options, typeof optionsNs>
  ] = await Promise.all([
    jsonld.compact(expanded, {}) as Promise<CompactedExpandedCsvwDescriptor>,
    jsonld.compact(expandedOptions, {}) as Promise<Expanded<Options, typeof optionsNs>>
  ]);
  return new DescriptorWrapper({
    ...compacted,
    ...compactedOptions
  });
}

function getCustomLoader(options: Csvw2RdfOptions) {

}

/** Class for manipulating the descriptor */
export class DescriptorWrapper<Options> {
  public get isTableGroup(): boolean {
    return this._isTableGroup(this.descriptor);
  }

  constructor(public descriptor: CompactedExpandedCsvwDescriptor & Expanded<Options, typeof optionsNs>) {}

  private _isTableGroup(x: CompactedExpandedCsvwDescriptor): x is Expanded<CsvwTableGroupDescription> {
    return 'http://www.w3.org/ns/csvw#tables' in x;
  }

  public *getTables() {
    if (this._isTableGroup(this.descriptor)){
      for (const element of this.descriptor['http://www.w3.org/ns/csvw#tables']) {
        yield element;     
      };
    }
    else {
      yield this.descriptor;
    }
  }

  public *getExternalProps<T>(object: T) {
    for (const key in object) {
      if (key.startsWith(`${csvwNs}#`)) {
        continue;
      }
      yield key as Exclude<Extract<keyof T, string>, `${typeof csvwNs}#${string}`>;
    }
  }
}
